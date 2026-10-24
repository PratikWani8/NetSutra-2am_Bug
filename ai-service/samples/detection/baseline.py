"""Baseline calculation and profiling for network behavioral anomaly detection."""

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime
import math
from typing import Dict, List, Optional, Set
import numpy as np

from schemas.anomaly import BaselineConfidence
from schemas.telemetry import NetworkEvent


@dataclass
class SourceBaseline:
    """Historical baseline metrics for a single source IP."""
    source_ip: str
    sample_count: int = 0
    destination_ips: Set[str] = field(default_factory=set)
    destination_ports: Set[int] = field(default_factory=set)
    destination_frequency: Counter = field(default_factory=Counter)
    mean_outbound_bytes: float = 0.0
    std_outbound_bytes: float = 0.0
    median_outbound_bytes: float = 0.0
    max_outbound_bytes: int = 0
    avg_connection_rate_per_sec: float = 0.0
    failed_connection_ratio: float = 0.0
    confidence: BaselineConfidence = BaselineConfidence.LOW


class BaselineManager:
    """Computes and maintains historical baselines for sources and network telemetry."""

    def __init__(self, min_samples: int = 5, high_samples: int = 20):
        self.min_samples = min_samples
        self.high_samples = high_samples
        # Persistent/rolling baseline cache by source_ip
        self._profiles: Dict[str, SourceBaseline] = {}
        # Global network-wide baseline for fallback
        self._global_outbound_bytes: List[int] = []
        self._global_destinations: Set[str] = set()

    def evaluate_confidence(self, sample_count: int) -> BaselineConfidence:
        """Evaluate baseline confidence based on sample count."""
        if sample_count < self.min_samples:
            return BaselineConfidence.LOW
        elif sample_count < self.high_samples:
            return BaselineConfidence.MEDIUM
        return BaselineConfidence.HIGH

    def build_profiles(self, events: List[NetworkEvent]) -> Dict[str, SourceBaseline]:
        """Build or update baseline profiles from a collection of historical events."""
        if not events:
            return self._profiles

        by_source: Dict[str, List[NetworkEvent]] = defaultdict(list)
        for ev in events:
            by_source[ev.source_ip].append(ev)
            self._global_destinations.add(ev.destination_ip)
            if ev.outbound_bytes is not None and ev.outbound_bytes > 0:
                self._global_outbound_bytes.append(ev.outbound_bytes)

        for src, src_events in by_source.items():
            profile = self._calculate_source_profile(src, src_events)
            self._profiles[src] = profile

        return self._profiles

    def get_source_baseline(self, source_ip: str) -> Optional[SourceBaseline]:
        """Retrieve existing baseline profile for a source host if available."""
        return self._profiles.get(source_ip)

    def _calculate_source_profile(self, source_ip: str, events: List[NetworkEvent]) -> SourceBaseline:
        """Compute statistical baseline metrics from a host's events."""
        sample_count = len(events)
        dest_ips: Set[str] = set()
        dest_ports: Set[int] = set()
        dest_freq: Counter = Counter()
        outbound_bytes_list: List[int] = []
        failed_count = 0
        timestamps: List[float] = []

        failed_states = {"REJ", "S0", "RSTO", "RSTR", "SH", "SHR"}

        for ev in events:
            dest_ips.add(ev.destination_ip)
            dest_freq[ev.destination_ip] += 1
            if ev.destination_port is not None:
                dest_ports.add(ev.destination_port)

            if ev.outbound_bytes is not None:
                outbound_bytes_list.append(ev.outbound_bytes)

            if ev.conn_state and ev.conn_state.upper() in failed_states:
                failed_count += 1

            timestamps.append(ev.timestamp.timestamp())

        # Statistical calculations
        if outbound_bytes_list:
            arr = np.array(outbound_bytes_list, dtype=np.float64)
            mean_bytes = float(np.mean(arr))
            std_bytes = float(np.std(arr))
            med_bytes = float(np.median(arr))
            max_bytes = int(np.max(arr))
        else:
            mean_bytes = 0.0
            std_bytes = 0.0
            med_bytes = 0.0
            max_bytes = 0

        # Connection rate per second
        rate_per_sec = 0.0
        if len(timestamps) > 1:
            duration = max(timestamps) - min(timestamps)
            if duration > 1.0:
                rate_per_sec = len(timestamps) / duration
            else:
                rate_per_sec = float(len(timestamps))

        fail_ratio = (failed_count / sample_count) if sample_count > 0 else 0.0
        confidence = self.evaluate_confidence(sample_count)

        return SourceBaseline(
            source_ip=source_ip,
            sample_count=sample_count,
            destination_ips=dest_ips,
            destination_ports=dest_ports,
            destination_frequency=dest_freq,
            mean_outbound_bytes=mean_bytes,
            std_outbound_bytes=std_bytes,
            median_outbound_bytes=med_bytes,
            max_outbound_bytes=max_bytes,
            avg_connection_rate_per_sec=rate_per_sec,
            failed_connection_ratio=fail_ratio,
            confidence=confidence,
        )
