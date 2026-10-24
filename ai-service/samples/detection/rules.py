"""Detection algorithms and rule evaluations for network behavior."""

from abc import ABC, abstractmethod
from collections import defaultdict
from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional
import uuid

from config import Settings
from schemas.anomaly import Anomaly, BaselineConfidence, DetectionParameters, Severity
from schemas.telemetry import NetworkEvent
from detection.baseline import BaselineManager, SourceBaseline


def calculate_severity(score: float) -> Severity:
    """Map numeric score (0.0 - 1.0) to standardized severity tier."""
    if score >= 0.90:
        return Severity.CRITICAL
    elif score >= 0.70:
        return Severity.HIGH
    elif score >= 0.40:
        return Severity.MEDIUM
    return Severity.LOW


class BaseRuleDetector(ABC):
    """Abstract base class for behavioral detection rules."""

    @abstractmethod
    def evaluate(
        self,
        events: List[NetworkEvent],
        baseline_manager: BaselineManager,
        params: DetectionParameters,
        settings: Settings,
    ) -> List[Anomaly]:
        """Evaluate events against baseline and return detected anomalies."""
        pass


class OutboundVolumeDeviationDetector(BaseRuleDetector):
    """Detects unusually high outbound byte counts or traffic volume deviations."""

    def evaluate(
        self,
        events: List[NetworkEvent],
        baseline_manager: BaselineManager,
        params: DetectionParameters,
        settings: Settings,
    ) -> List[Anomaly]:
        anomalies: List[Anomaly] = []
        zscore_thresh = params.volume_zscore_threshold or settings.VOLUME_ZSCORE_THRESHOLD
        ratio_thresh = params.volume_ratio_threshold or settings.VOLUME_RATIO_THRESHOLD

        for ev in events:
            if ev.outbound_bytes is None or ev.outbound_bytes <= 0:
                continue

            bytes_val = ev.outbound_bytes
            src_baseline = baseline_manager.get_source_baseline(ev.source_ip)

            if src_baseline is None or src_baseline.confidence == BaselineConfidence.LOW:
                # Low baseline confidence scenario
                baseline_conf = BaselineConfidence.LOW
                # Check absolute heuristic threshold for extreme volume
                heuristic_threshold = 10_000_000  # 10 MB
                if bytes_val >= heuristic_threshold:
                    score = min(0.75, 0.40 + (math.log10(bytes_val / 1_000_000) * 0.15))
                    anomalies.append(
                        Anomaly(
                            anomaly_id=f"anom-vol-{uuid.uuid4().hex[:10]}",
                            timestamp=ev.timestamp,
                            score=round(score, 2),
                            severity=calculate_severity(score),
                            method="outbound_volume_deviation",
                            reasons=[
                                f"High outbound volume ({bytes_val:,} bytes) observed without sufficient historical baseline.",
                                "Baseline confidence is low due to limited observation history for this host."
                            ],
                            features={
                                "outbound_bytes": bytes_val,
                                "baseline_outbound_bytes": None,
                                "baseline_confidence": "low",
                                "heuristic_threshold": heuristic_threshold,
                            },
                            evidence_event_ids=[ev.event_id],
                            baseline_confidence=baseline_conf,
                        )
                    )
                continue

            # We have medium or high baseline history
            baseline_conf = src_baseline.confidence
            mean_bytes = src_baseline.mean_outbound_bytes
            std_bytes = max(src_baseline.std_outbound_bytes, 10_000.0)  # Avoid zero division
            ratio = bytes_val / max(mean_bytes, 1.0)
            z_score = (bytes_val - mean_bytes) / std_bytes

            if ratio >= ratio_thresh or z_score >= zscore_thresh:
                # Score formula mapping z-score and ratio to [0.5, 0.98]
                z_component = min(0.35, max(0.0, (z_score - 2.0) * 0.07))
                ratio_component = min(0.20, max(0.0, (ratio - 2.0) * 0.05))
                score = min(0.98, max(0.50, 0.50 + z_component + ratio_component))

                anomalies.append(
                    Anomaly(
                        anomaly_id=f"anom-vol-{uuid.uuid4().hex[:10]}",
                        timestamp=ev.timestamp,
                        score=round(score, 2),
                        severity=calculate_severity(score),
                        method="outbound_volume_deviation",
                        reasons=[
                            f"Outbound traffic volume ({bytes_val:,} bytes) exceeded the established baseline ({int(mean_bytes):,} bytes) by {ratio:.2f}x (z-score: {z_score:.2f})."
                        ],
                        features={
                            "outbound_bytes": bytes_val,
                            "baseline_outbound_bytes": int(mean_bytes),
                            "z_score": round(z_score, 2),
                            "deviation_ratio": round(ratio, 2),
                        },
                        evidence_event_ids=[ev.event_id],
                        baseline_confidence=baseline_conf,
                    )
                )

        return anomalies


class RareDestinationDetector(BaseRuleDetector):
    """Detects connections to new or rare destinations relative to baseline."""

    def evaluate(
        self,
        events: List[NetworkEvent],
        baseline_manager: BaselineManager,
        params: DetectionParameters,
        settings: Settings,
    ) -> List[Anomaly]:
        anomalies: List[Anomaly] = []

        # Track destinations seen in current batch to avoid duplicate anomalies
        already_reported: set = set()

        for ev in events:
            dest_key = (ev.source_ip, ev.destination_ip)
            if dest_key in already_reported:
                continue

            src_baseline = baseline_manager.get_source_baseline(ev.source_ip)

            # Insufficient baseline check
            if src_baseline is None or src_baseline.confidence == BaselineConfidence.LOW:
                # Cannot reliably detect rare destination without sufficient history
                continue

            if ev.destination_ip not in src_baseline.destination_ips:
                already_reported.add(dest_key)
                # Calculate anomaly score based on baseline strength
                score = 0.72 if src_baseline.confidence == BaselineConfidence.HIGH else 0.65

                # Adjust if destination port is unusual / non-standard (e.g. != 80, 443, 53)
                common_ports = {80, 443, 53, 123}
                is_unusual_port = ev.destination_port is not None and ev.destination_port not in common_ports
                if is_unusual_port:
                    score = min(0.88, score + 0.12)

                reasons = [
                    f"Source {ev.source_ip} established connection to destination {ev.destination_ip}, which has not been observed in baseline history."
                ]
                if is_unusual_port:
                    reasons.append(f"Connection targeted unusual port {ev.destination_port}.")

                anomalies.append(
                    Anomaly(
                        anomaly_id=f"anom-rare-{uuid.uuid4().hex[:10]}",
                        timestamp=ev.timestamp,
                        score=round(score, 2),
                        severity=calculate_severity(score),
                        method="rare_destination",
                        reasons=reasons,
                        features={
                            "source_ip": ev.source_ip,
                            "destination_ip": ev.destination_ip,
                            "destination_port": ev.destination_port,
                            "historical_occurrences": 0,
                            "known_destinations_count": len(src_baseline.destination_ips),
                        },
                        evidence_event_ids=[ev.event_id],
                        baseline_confidence=src_baseline.confidence,
                    )
                )

        return anomalies


class ConnectionFrequencyBurstDetector(BaseRuleDetector):
    """Detects unusual connection frequency spikes within a rolling time window."""

    def evaluate(
        self,
        events: List[NetworkEvent],
        baseline_manager: BaselineManager,
        params: DetectionParameters,
        settings: Settings,
    ) -> List[Anomaly]:
        if not events:
            return []

        anomalies: List[Anomaly] = []
        burst_threshold = params.frequency_burst_threshold or settings.FREQUENCY_BURST_THRESHOLD

        # Group events by source IP
        by_source: Dict[str, List[NetworkEvent]] = defaultdict(list)
        for ev in events:
            by_source[ev.source_ip].append(ev)

        for src, src_events in by_source.items():
            if len(src_events) < 3:
                continue

            timestamps = sorted([ev.timestamp.timestamp() for ev in src_events])
            window_duration = max(timestamps[-1] - timestamps[0], 1.0)
            conn_count = len(src_events)
            current_rate = conn_count / window_duration

            src_baseline = baseline_manager.get_source_baseline(src)

            if src_baseline is None or src_baseline.confidence == BaselineConfidence.LOW:
                # If high absolute connection volume in short window (> 20 connections in < 10 seconds)
                if conn_count >= 20 and current_rate >= 2.0:
                    score = 0.70
                    anomalies.append(
                        Anomaly(
                            anomaly_id=f"anom-burst-{uuid.uuid4().hex[:10]}",
                            timestamp=src_events[-1].timestamp,
                            score=score,
                            severity=calculate_severity(score),
                            method="connection_frequency_burst",
                            reasons=[
                                f"Rapid burst of {conn_count} connections observed within {window_duration:.1f} seconds ({current_rate:.2f} conn/sec).",
                                "Baseline confidence is low due to limited observation history."
                            ],
                            features={
                                "connection_count": conn_count,
                                "window_seconds": round(window_duration, 2),
                                "rate_per_sec": round(current_rate, 3),
                                "baseline_rate_per_sec": None,
                            },
                            evidence_event_ids=[ev.event_id for ev in src_events],
                            baseline_confidence=BaselineConfidence.LOW,
                        )
                    )
                continue

            # Baseline exists
            baseline_rate = max(src_baseline.avg_connection_rate_per_sec, 0.05)
            rate_ratio = current_rate / baseline_rate

            if rate_ratio >= burst_threshold and conn_count >= 5:
                score = min(0.95, 0.55 + min(0.40, (rate_ratio / burst_threshold) * 0.15))
                anomalies.append(
                    Anomaly(
                        anomaly_id=f"anom-burst-{uuid.uuid4().hex[:10]}",
                        timestamp=src_events[-1].timestamp,
                        score=round(score, 2),
                        severity=calculate_severity(score),
                        method="connection_frequency_burst",
                        reasons=[
                            f"Connection frequency ({current_rate:.2f} conn/sec, {conn_count} connections in {window_duration:.1f}s) exceeded baseline rate ({baseline_rate:.2f} conn/sec) by {rate_ratio:.1f}x."
                        ],
                        features={
                            "connection_count": conn_count,
                            "window_seconds": round(window_duration, 2),
                            "rate_per_sec": round(current_rate, 3),
                            "baseline_rate_per_sec": round(baseline_rate, 3),
                            "rate_ratio": round(rate_ratio, 2),
                        },
                        evidence_event_ids=[ev.event_id for ev in src_events],
                        baseline_confidence=src_baseline.confidence,
                    )
                )

        return anomalies


class FailedConnectionPatternDetector(BaseRuleDetector):
    """Detects repeated failed or unusual connection patterns (REJ, S0, RSTO)."""

    FAILED_STATES = {"REJ", "S0", "RSTO", "RSTR", "SH", "SHR"}

    def evaluate(
        self,
        events: List[NetworkEvent],
        baseline_manager: BaselineManager,
        params: DetectionParameters,
        settings: Settings,
    ) -> List[Anomaly]:
        anomalies: List[Anomaly] = []
        fail_ratio_thresh = params.failed_connection_ratio_threshold or settings.FAILED_CONNECTION_RATIO_THRESHOLD

        by_source: Dict[str, List[NetworkEvent]] = defaultdict(list)
        for ev in events:
            by_source[ev.source_ip].append(ev)

        for src, src_events in by_source.items():
            failed_events = [
                ev for ev in src_events
                if ev.conn_state and ev.conn_state.upper() in self.FAILED_STATES
            ]
            failed_count = len(failed_events)
            total_count = len(src_events)

            if failed_count < 3:
                continue

            failure_ratio = failed_count / total_count
            observed_states = sorted(list({ev.conn_state.upper() for ev in failed_events if ev.conn_state}))

            if failure_ratio >= fail_ratio_thresh:
                src_baseline = baseline_manager.get_source_baseline(src)
                baseline_conf = src_baseline.confidence if src_baseline else BaselineConfidence.LOW

                score = min(0.92, 0.50 + (failure_ratio * 0.30) + min(0.12, (failed_count / 20.0)))
                anomalies.append(
                    Anomaly(
                        anomaly_id=f"anom-fail-{uuid.uuid4().hex[:10]}",
                        timestamp=failed_events[-1].timestamp,
                        score=round(score, 2),
                        severity=calculate_severity(score),
                        method="failed_connection_pattern",
                        reasons=[
                            f"Repeated connection failures ({failed_count}/{total_count}, {failure_ratio * 100:.1f}%) observed with states {observed_states}."
                        ],
                        features={
                            "failed_connection_count": failed_count,
                            "total_connections": total_count,
                            "failure_ratio": round(failure_ratio, 2),
                            "observed_states": observed_states,
                        },
                        evidence_event_ids=[ev.event_id for ev in failed_events],
                        baseline_confidence=baseline_conf,
                    )
                )

        return anomalies
