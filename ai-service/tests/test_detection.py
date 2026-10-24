"""Tests for behavioral network anomaly detection."""

from datetime import datetime, timezone, timedelta
import pytest
from detection.detector import AnomalyDetectorService
from schemas.anomaly import BaselineConfidence, DetectionRequest, Severity
from schemas.telemetry import NetworkEvent


def test_normal_traffic_no_anomalies(test_settings, normal_baseline_events, normal_traffic_batch):
    """Normal traffic within baseline parameters should not trigger anomalies."""
    detector = AnomalyDetectorService(test_settings)
    req = DetectionRequest(
        events=normal_traffic_batch,
        baseline_events=normal_baseline_events,
    )
    res = detector.detect(req)

    assert res.total_events_analyzed == 2
    assert res.anomalies_detected == 0
    assert len(res.anomalies) == 0
    assert res.baseline_confidence in (BaselineConfidence.MEDIUM, BaselineConfidence.HIGH)


def test_synthetic_unusual_outbound_volume(test_settings, normal_baseline_events, high_volume_event):
    """Synthetic unusual outbound volume must trigger an outbound_volume_deviation anomaly."""
    detector = AnomalyDetectorService(test_settings)
    req = DetectionRequest(
        events=[high_volume_event],
        baseline_events=normal_baseline_events,
    )
    res = detector.detect(req)

    assert res.anomalies_detected == 1
    anomaly = res.anomalies[0]

    assert anomaly.method == "outbound_volume_deviation"
    assert anomaly.score >= 0.70
    assert anomaly.severity in (Severity.HIGH, Severity.CRITICAL)
    assert "high-vol-001" in anomaly.evidence_event_ids
    assert anomaly.baseline_confidence == BaselineConfidence.HIGH
    assert len(anomaly.reasons) > 0

    # Verify features and baseline comparison
    assert anomaly.features["outbound_bytes"] == 15_000_000
    assert "baseline_outbound_bytes" in anomaly.features
    assert anomaly.features["baseline_outbound_bytes"] > 0
    assert anomaly.features["deviation_ratio"] > 3.0
    assert anomaly.features["z_score"] > 3.0


def test_rare_destination_behavior(test_settings, normal_baseline_events, rare_destination_event):
    """Contacting a new destination not in baseline should trigger rare_destination anomaly."""
    detector = AnomalyDetectorService(test_settings)
    req = DetectionRequest(
        events=[rare_destination_event],
        baseline_events=normal_baseline_events,
    )
    res = detector.detect(req)

    assert res.anomalies_detected >= 1
    rare_anom = next(a for a in res.anomalies if a.method == "rare_destination")

    assert rare_anom.features["destination_ip"] == "203.0.113.99"
    assert rare_anom.features["destination_port"] == 8443
    assert rare_anom.features["historical_occurrences"] == 0
    assert rare_anom.evidence_event_ids == ["rare-dest-001"]
    assert any("203.0.113.99" in r for r in rare_anom.reasons)


def test_insufficient_baseline_history(test_settings, base_time):
    """When baseline history is below MIN_BASELINE_EVENTS, report low baseline confidence."""
    detector = AnomalyDetectorService(test_settings)

    # Only 2 baseline events (< MIN_BASELINE_EVENTS=5)
    sparse_baseline = [
        NetworkEvent(
            event_id="sparse-001",
            timestamp=base_time - timedelta(minutes=10),
            source_ip="192.0.2.50",
            destination_ip="198.51.100.5",
            outbound_bytes=1000,
        ),
        NetworkEvent(
            event_id="sparse-002",
            timestamp=base_time - timedelta(minutes=5),
            source_ip="192.0.2.50",
            destination_ip="198.51.100.5",
            outbound_bytes=1200,
        ),
    ]

    # Extreme traffic from the same host
    extreme_event = NetworkEvent(
        event_id="sparse-extreme",
        timestamp=base_time,
        source_ip="192.0.2.50",
        destination_ip="198.51.100.5",
        outbound_bytes=25_000_000,  # 25 MB
    )

    req = DetectionRequest(
        events=[extreme_event],
        baseline_events=sparse_baseline,
    )
    res = detector.detect(req)

    # Must report low confidence
    assert res.baseline_confidence == BaselineConfidence.LOW
    if res.anomalies_detected > 0:
        anom = res.anomalies[0]
        assert anom.baseline_confidence == BaselineConfidence.LOW
        assert any("low" in r.lower() or "baseline" in r.lower() for r in anom.reasons)


def test_connection_frequency_burst(test_settings, base_time, normal_baseline_events):
    """Rapid spike of connections in a short window should trigger frequency burst anomaly."""
    detector = AnomalyDetectorService(test_settings)

    # Generate 30 rapid connections within 15 seconds
    burst_events = []
    for i in range(30):
        burst_events.append(
            NetworkEvent(
                event_id=f"burst-{i:03d}",
                timestamp=base_time + timedelta(seconds=i * 0.5),
                source_ip="192.0.2.10",
                destination_ip="198.51.100.1",
                source_port=45000 + i,
                destination_port=443,
                protocol="tcp",
                conn_state="SF",
            )
        )

    req = DetectionRequest(
        events=burst_events,
        baseline_events=normal_baseline_events,
    )
    res = detector.detect(req)

    burst_anoms = [a for a in res.anomalies if a.method == "connection_frequency_burst"]
    assert len(burst_anoms) >= 1
    anom = burst_anoms[0]
    assert anom.features["connection_count"] == 30
    assert anom.features["rate_per_sec"] > 1.0


def test_failed_connection_pattern(test_settings, base_time):
    """High ratio of rejected / reset connections should trigger failed_connection_pattern."""
    detector = AnomalyDetectorService(test_settings)

    # Generate 12 failed connections with REJ and S0
    failed_events = []
    for i in range(12):
        state = "REJ" if i % 2 == 0 else "S0"
        failed_events.append(
            NetworkEvent(
                event_id=f"fail-{i:03d}",
                timestamp=base_time + timedelta(seconds=i * 2),
                source_ip="192.0.2.88",
                destination_ip=f"198.51.100.{20 + i}",
                source_port=52000 + i,
                destination_port=22,
                conn_state=state,
            )
        )

    req = DetectionRequest(events=failed_events)
    res = detector.detect(req)

    fail_anoms = [a for a in res.anomalies if a.method == "failed_connection_pattern"]
    assert len(fail_anoms) >= 1
    anom = fail_anoms[0]
    assert anom.features["failed_connection_count"] == 12
    assert anom.features["failure_ratio"] == 1.0
    assert "REJ" in anom.features["observed_states"]


def test_zeek_record_normalization():
    """Verify that raw Zeek conn.log field aliases are normalized correctly without assuming all fields exist."""
    raw_zeek = {
        "ts": 1700000000.5,
        "uid": "CHkAv212567abcdef",
        "id.orig_h": "10.0.0.15",
        "id.resp_h": "93.184.216.34",
        "id.orig_p": 49152,
        "id.resp_p": 80,
        "proto": "tcp",
        "orig_bytes": 1048576,
        "resp_bytes": 524288,
        "conn_state": "SF",
        "history": "ShADadFf",
    }

    event = NetworkEvent.model_validate(raw_zeek)
    assert event.event_id == "CHkAv212567abcdef"
    assert event.source_ip == "10.0.0.15"
    assert event.destination_ip == "93.184.216.34"
    assert event.source_port == 49152
    assert event.destination_port == 80
    assert event.outbound_bytes == 1048576
    assert event.inbound_bytes == 524288
    assert event.conn_state == "SF"
    assert event.timestamp.timestamp() == pytest.approx(1700000000.5)
