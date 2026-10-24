"""Tests for event and anomaly correlation."""

from datetime import datetime, timezone, timedelta
import pytest
from correlation.correlator import EventCorrelator
from schemas.anomaly import Anomaly, BaselineConfidence, Severity
from schemas.correlation import CorrelateRequest, CorrelationParameters
from schemas.telemetry import NetworkEvent


def test_correlation_by_shared_source_ip(test_settings, base_time):
    """Anomalies sharing the same source IP within the time window should correlate into a single incident."""
    correlator = EventCorrelator(test_settings)

    anom1 = Anomaly(
        anomaly_id="anom-001",
        timestamp=base_time,
        score=0.85,
        severity=Severity.HIGH,
        method="outbound_volume_deviation",
        reasons=["High volume"],
        features={"source_ip": "192.0.2.10", "destination_ip": "198.51.100.1"},
        evidence_event_ids=["ev-001"],
        baseline_confidence=BaselineConfidence.HIGH,
    )

    anom2 = Anomaly(
        anomaly_id="anom-002",
        timestamp=base_time + timedelta(seconds=60),  # 60s later, within 300s window
        score=0.75,
        severity=Severity.HIGH,
        method="rare_destination",
        reasons=["Rare destination"],
        features={"source_ip": "192.0.2.10", "destination_ip": "203.0.113.99"},
        evidence_event_ids=["ev-002"],
        baseline_confidence=BaselineConfidence.HIGH,
    )

    req = CorrelateRequest(
        anomalies=[anom1, anom2],
        parameters=CorrelationParameters(time_window_seconds=300.0),
    )
    res = correlator.correlate(req)

    assert res.incident_count == 1
    incident = res.incidents[0]
    assert set(incident.anomaly_ids) == {"anom-001", "anom-002"}
    assert set(incident.evidence_event_ids) == {"ev-001", "ev-002"}
    assert incident.primary_source_ip == "192.0.2.10"
    assert incident.first_observed == base_time
    assert incident.last_observed == base_time + timedelta(seconds=60)
    assert any("192.0.2.10" in r for r in incident.correlation_reasons)


def test_correlation_by_shared_target_destination(test_settings, base_time):
    """Anomalies from distinct sources attacking the same target destination IP should correlate."""
    correlator = EventCorrelator(test_settings)

    anom1 = Anomaly(
        anomaly_id="anom-target-1",
        timestamp=base_time,
        score=0.80,
        severity=Severity.HIGH,
        method="failed_connection_pattern",
        reasons=["Scan activity"],
        features={"source_ip": "192.0.2.100", "destination_ip": "198.51.100.50"},
        evidence_event_ids=["ev-scan-1"],
        baseline_confidence=BaselineConfidence.MEDIUM,
    )

    anom2 = Anomaly(
        anomaly_id="anom-target-2",
        timestamp=base_time + timedelta(seconds=45),
        score=0.82,
        severity=Severity.HIGH,
        method="failed_connection_pattern",
        reasons=["Scan activity"],
        features={"source_ip": "192.0.2.200", "destination_ip": "198.51.100.50"},
        evidence_event_ids=["ev-scan-2"],
        baseline_confidence=BaselineConfidence.MEDIUM,
    )

    req = CorrelateRequest(anomalies=[anom1, anom2])
    res = correlator.correlate(req)

    assert res.incident_count == 1
    incident = res.incidents[0]
    assert incident.primary_destination_ip == "198.51.100.50"
    assert any("target destination" in r.lower() for r in incident.correlation_reasons)


def test_avoid_combining_unrelated_events_outside_window(test_settings, base_time):
    """Anomalies separated by more than time_window_seconds should NOT be combined."""
    correlator = EventCorrelator(test_settings)

    # 10 minutes apart (> 5 minute window)
    anom1 = Anomaly(
        anomaly_id="anom-early",
        timestamp=base_time,
        score=0.85,
        severity=Severity.HIGH,
        method="outbound_volume_deviation",
        reasons=["High volume"],
        features={"source_ip": "192.0.2.10"},
        evidence_event_ids=["ev-early"],
        baseline_confidence=BaselineConfidence.HIGH,
    )

    anom2 = Anomaly(
        anomaly_id="anom-late",
        timestamp=base_time + timedelta(minutes=10),
        score=0.85,
        severity=Severity.HIGH,
        method="outbound_volume_deviation",
        reasons=["High volume"],
        features={"source_ip": "192.0.2.10"},
        evidence_event_ids=["ev-late"],
        baseline_confidence=BaselineConfidence.HIGH,
    )

    req = CorrelateRequest(
        anomalies=[anom1, anom2],
        parameters=CorrelationParameters(time_window_seconds=300.0),
    )
    res = correlator.correlate(req)

    # Must produce 2 separate incidents
    assert res.incident_count == 2
    assert res.incidents[0].anomaly_ids != res.incidents[1].anomaly_ids


def test_avoid_combining_unrelated_hosts_at_same_time(test_settings, base_time):
    """Anomalies occurring at the same timestamp but between completely unrelated hosts must NOT be merged."""
    correlator = EventCorrelator(test_settings)

    anom_host_a = Anomaly(
        anomaly_id="anom-host-a",
        timestamp=base_time,
        score=0.85,
        severity=Severity.HIGH,
        method="outbound_volume_deviation",
        reasons=["High volume from host A"],
        features={"source_ip": "10.1.1.5", "destination_ip": "198.51.100.1"},
        evidence_event_ids=["ev-a"],
        baseline_confidence=BaselineConfidence.HIGH,
    )

    anom_host_b = Anomaly(
        anomaly_id="anom-host-b",
        timestamp=base_time,
        score=0.75,
        severity=Severity.HIGH,
        method="failed_connection_pattern",
        reasons=["Scan from host B"],
        features={"source_ip": "172.16.5.99", "destination_ip": "203.0.113.8"},
        evidence_event_ids=["ev-b"],
        baseline_confidence=BaselineConfidence.HIGH,
    )

    req = CorrelateRequest(anomalies=[anom_host_a, anom_host_b])
    res = correlator.correlate(req)

    # Must produce 2 independent incidents
    assert res.incident_count == 2
    inc_a = next(inc for inc in res.incidents if "anom-host-a" in inc.anomaly_ids)
    inc_b = next(inc for inc in res.incidents if "anom-host-b" in inc.anomaly_ids)
    assert inc_a.primary_source_ip == "10.1.1.5"
    assert inc_b.primary_source_ip == "172.16.5.99"
