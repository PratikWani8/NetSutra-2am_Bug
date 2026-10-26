"""Batch-level heuristics for non-connection Zeek logs and cross-event patterns.

These rules use event features, not fixture IPs, UIDs, filenames, or scenario labels.
Every alert is a lead for analyst review, not proof of malicious intent.
"""
from collections import Counter, defaultdict
from datetime import datetime
import math
from statistics import mean, pstdev
from typing import Any, Dict, Iterable, List, Tuple

from config import Settings
from detection.baseline import BaselineManager
from detection.rules import BaseRuleDetector, calculate_severity
from schemas.anomaly import Anomaly, BaselineConfidence, DetectionParameters
from schemas.telemetry import NetworkEvent


FAILED_STATES = {"REJ", "S0", "RSTO", "RSTR", "SH", "SHR"}
SENSITIVE_PATH_PARTS = (
    "/.env", "/.git", "/wp-login", "/phpmyadmin", "/admin",
    "/api/debug", "/actuator", "/config", "/backup", "/server-status",
)
WEAK_TLS_VERSIONS = {"sslv2", "sslv3", "tlsv10", "tlsv11", "tls1.0", "tls1.1", "unknown"}
WEAK_CIPHER_PARTS = ("3des", "rc4", "null", "export", "unknown")
EXECUTABLE_EXTENSIONS = {".exe", ".dll", ".scr", ".ps1", ".bat", ".cmd", ".vbs", ".hta", ".elf"}


def _metadata(event: NetworkEvent) -> Dict[str, Any]:
    value = getattr(event, "metadata", None)
    return value if isinstance(value, dict) else {}


def _number(value: Any) -> float:
    try:
        if value is None or value == "-":
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _entropy(value: str) -> float:
    if not value:
        return 0.0
    counts = Counter(value.lower())
    length = len(value)
    return -sum((n / length) * math.log2(n / length) for n in counts.values())


def _is_tls_event(meta: Dict[str, Any]) -> bool:
    return any(k in meta for k in ("cipher", "server_name", "validation_status", "cert_chain_fuids"))


class MultiLogBehaviorDetector(BaseRuleDetector):
    """Detect HTTP, DNS, TLS, weird/file metadata, beaconing and destination fan-out."""

    def _anomaly(
        self,
        events: List[NetworkEvent],
        method: str,
        score: float,
        reason: str,
        features: Dict[str, Any],
    ) -> Anomaly:
        return Anomaly(
            timestamp=max(e.timestamp for e in events),
            score=round(max(0.0, min(1.0, score)), 2),
            severity=calculate_severity(score),
            method=method,
            reasons=[
                reason,
                "This is a behavioral heuristic; validate the supporting events before concluding malicious intent.",
            ],
            features={**features, "heuristic_only": True},
            evidence_event_ids=[e.event_id for e in events],
            baseline_confidence=BaselineConfidence.LOW,
        )

    def evaluate(
        self,
        events: List[NetworkEvent],
        baseline_manager: BaselineManager,
        params: DetectionParameters,
        settings: Settings,
    ) -> List[Anomaly]:
        if not events:
            return []
        findings: List[Anomaly] = []
        findings.extend(self._periodic_egress(events))
        findings.extend(self._connection_fanout(events))
        findings.extend(self._http_patterns(events))
        findings.extend(self._dns_patterns(events))
        findings.extend(self._tls_patterns(events))
        findings.extend(self._weird_events(events))
        findings.extend(self._file_artifacts(events))
        return findings

    def _periodic_egress(self, events: List[NetworkEvent]) -> List[Anomaly]:
        groups: Dict[Tuple[str, str, Any], List[NetworkEvent]] = defaultdict(list)
        application_keys = {"query", "qtype", "qtype_name", "rcode", "uri", "method", "status_code", "cipher", "server_name", "filename"}
        for event in events:
            meta = _metadata(event)
            if application_keys.intersection(meta):
                continue
            groups[(event.source_ip, event.destination_ip, event.destination_port)].append(event)

        results = []
        for (src, dst, port), group in groups.items():
            group = sorted(group, key=lambda e: e.timestamp)
            if len(group) < 8:
                continue
            times = [e.timestamp.timestamp() for e in group]
            intervals = [b - a for a, b in zip(times, times[1:])]
            if not intervals or mean(intervals) < 30 or mean(intervals) > 1800:
                continue
            cv = pstdev(intervals) / mean(intervals) if mean(intervals) > 0 else 999
            if cv > 0.20:
                continue
            byte_values = [
                max(0, (e.outbound_bytes or 0)) + max(0, (e.inbound_bytes or 0))
                for e in group
            ]
            median_bytes = sorted(byte_values)[len(byte_values) // 2]
            if median_bytes > 4096:
                continue
            results.append(self._anomaly(
                group, "periodic_egress_pattern", 0.66,
                f"Repeated low-volume connections from {src} to {dst}:{port or 'unknown'} occurred {len(group)} times at a regular interval (mean {mean(intervals):.1f}s, interval CV {cv:.2f}). This may indicate scheduled polling or beacon-like behavior.",
                {"source_ip": src, "destination_ip": dst, "destination_port": port,
                 "connection_count": len(group), "mean_interval_seconds": round(mean(intervals), 2),
                 "interval_coefficient_of_variation": round(cv, 3), "median_total_bytes": median_bytes},
            ))
        return results

    def _connection_fanout(self, events: List[NetworkEvent]) -> List[Anomaly]:
        by_source: Dict[str, List[NetworkEvent]] = defaultdict(list)
        for event in events:
            by_source[event.source_ip].append(event)

        results = []
        for src, source_events in by_source.items():
            ordered = sorted(source_events, key=lambda e: e.timestamp)
            timestamps = [e.timestamp.timestamp() for e in ordered]
            for end_idx, end_time in enumerate(timestamps):
                start_idx = end_idx
                while start_idx > 0 and end_time - timestamps[start_idx - 1] <= 120:
                    start_idx -= 1
                window = ordered[start_idx:end_idx + 1]
                if len(window) < 12:
                    continue
                distinct_destinations = {e.destination_ip for e in window}
                distinct_ports = {e.destination_port for e in window if e.destination_port is not None}
                failed = sum(1 for e in window if (e.conn_state or "").upper() in FAILED_STATES)
                fail_ratio = failed / len(window)
                # Require broad fan-out plus failed attempts, or many port attempts with failures.
                broad_host_scan = len(distinct_destinations) >= 10 and fail_ratio >= 0.25
                broad_port_scan = len(distinct_ports) >= 10 and fail_ratio >= 0.25
                if broad_host_scan or broad_port_scan:
                    results.append(self._anomaly(
                        window, "connection_fanout_scan", 0.76,
                        f"Source {src} contacted {len(distinct_destinations)} distinct destinations and {len(distinct_ports)} destination ports in a 120-second window; {failed}/{len(window)} connections had failed states.",
                        {"source_ip": src, "connection_count": len(window),
                         "distinct_destination_count": len(distinct_destinations),
                         "distinct_destination_ports": len(distinct_ports),
                         "failed_connection_ratio": round(fail_ratio, 3), "window_seconds": 120},
                    ))
                    break
        return results

    def _http_patterns(self, events: List[NetworkEvent]) -> List[Anomaly]:
        by_source: Dict[str, List[NetworkEvent]] = defaultdict(list)
        for e in events:
            meta = _metadata(e)
            if any(k in meta for k in ("uri", "method", "status_code", "request_body_len")):
                by_source[e.source_ip].append(e)

        results = []
        for src, group in by_source.items():
            metas = [_metadata(e) for e in group]
            probes = []
            for event, meta in zip(group, metas):
                uri = str(meta.get("uri") or "").lower()
                if any(part in uri for part in SENSITIVE_PATH_PARTS):
                    probes.append(event)
            if len(probes) >= 3:
                results.append(self._anomaly(
                    probes, "http_sensitive_path_probe", 0.78,
                    f"Source {src} made {len(probes)} requests to commonly sensitive administrative, configuration, or debug paths.",
                    {"source_ip": src, "sensitive_path_request_count": len(probes),
                     "sample_paths": list(dict.fromkeys(str(_metadata(e).get("uri", "")) for e in probes[:8]))},
                ))

            post_events = [
                e for e in group
                if str(_metadata(e).get("method") or "").upper() == "POST"
                and _number(_metadata(e).get("request_body_len")) > 0
            ]
            post_bytes = sum(_number(_metadata(e).get("request_body_len")) for e in post_events)
            if len(post_events) >= 3 and post_bytes >= 1_000_000:
                results.append(self._anomaly(
                    post_events, "http_large_post_volume", 0.68,
                    f"Source {src} submitted {len(post_events)} HTTP POST requests with {int(post_bytes):,} bytes of request bodies in this batch.",
                    {"source_ip": src, "post_count": len(post_events), "aggregate_request_body_bytes": int(post_bytes)},
                ))

            status_events = []
            for e in group:
                code = _number(_metadata(e).get("status_code"))
                if code >= 400:
                    status_events.append(e)
            if len(group) >= 10 and len(status_events) / len(group) >= 0.60:
                results.append(self._anomaly(
                    status_events, "http_error_response_burst", 0.63,
                    f"HTTP responses from requests by {src} had a high error/throttling rate: {len(status_events)}/{len(group)} responses were 4xx or 5xx.",
                    {"source_ip": src, "http_request_count": len(group),
                     "error_response_count": len(status_events),
                     "error_ratio": round(len(status_events) / len(group), 3)},
                ))
        return results

    def _dns_patterns(self, events: List[NetworkEvent]) -> List[Anomaly]:
        by_source: Dict[str, List[NetworkEvent]] = defaultdict(list)
        for e in events:
            meta = _metadata(e)
            if any(k in meta for k in ("query", "qtype", "qtype_name", "rcode", "rcode_name")):
                by_source[e.source_ip].append(e)

        results = []
        for src, group in by_source.items():
            metas = [_metadata(e) for e in group]
            nxdomain = []
            for e, meta in zip(group, metas):
                code = str(meta.get("rcode", "")).strip()
                name = str(meta.get("rcode_name", "")).upper()
                if code == "3" or name == "NXDOMAIN":
                    nxdomain.append(e)
            if len(nxdomain) >= 10 and len(nxdomain) / len(group) >= 0.50:
                results.append(self._anomaly(
                    nxdomain, "dns_nxdomain_burst", 0.74,
                    f"Source {src} generated {len(nxdomain)} NXDOMAIN responses out of {len(group)} DNS events.",
                    {"source_ip": src, "dns_event_count": len(group),
                     "nxdomain_count": len(nxdomain), "nxdomain_ratio": round(len(nxdomain) / len(group), 3)},
                ))

            long_label_events = []
            for e, meta in zip(group, metas):
                query = str(meta.get("query") or "").rstrip(".")
                labels = query.split(".") if query else []
                if any(len(label) >= 30 and _entropy(label) >= 3.0 for label in labels):
                    long_label_events.append(e)
            if len(long_label_events) >= 5 and len(long_label_events) / len(group) >= 0.40:
                results.append(self._anomaly(
                    long_label_events, "dns_high_entropy_label_pattern", 0.70,
                    f"Source {src} generated {len(long_label_events)} DNS queries containing long, high-entropy labels. This can occur in DNS tunneling but is not conclusive on its own.",
                    {"source_ip": src, "dns_event_count": len(group),
                     "long_high_entropy_query_count": len(long_label_events),
                     "sample_queries": list(dict.fromkeys(str(_metadata(e).get("query", "")) for e in long_label_events[:5]))},
                ))
        return results

    def _tls_patterns(self, events: List[NetworkEvent]) -> List[Anomaly]:
        by_source: Dict[str, List[NetworkEvent]] = defaultdict(list)
        for e in events:
            meta = _metadata(e)
            if _is_tls_event(meta):
                by_source[e.source_ip].append(e)

        results = []
        for src, group in by_source.items():
            weak = []
            observed = []
            for e in group:
                meta = _metadata(e)
                version = str(meta.get("version") or "").lower().replace(" ", "")
                cipher = str(meta.get("cipher") or "").lower()
                validation = str(meta.get("validation_status") or "").lower()
                is_weak = (
                    version in WEAK_TLS_VERSIONS
                    or any(part in cipher for part in WEAK_CIPHER_PARTS)
                    or validation in {"unknown", "error", "expired", "self-signed", "self_signed"}
                )
                if is_weak:
                    weak.append(e)
                    observed.append({"version": meta.get("version"), "cipher": meta.get("cipher"),
                                     "validation_status": meta.get("validation_status")})
            if len(weak) >= 3 and len(weak) / max(len(group), 1) >= 0.50:
                results.append(self._anomaly(
                    weak, "tls_weak_or_unknown_metadata", 0.69,
                    f"Source {src} had {len(weak)} TLS sessions with legacy/unknown protocol metadata, weak/unknown cipher information, or non-validated certificate status.",
                    {"source_ip": src, "tls_event_count": len(group),
                     "weak_metadata_count": len(weak), "observed_metadata_sample": observed[:5]},
                ))
        return results

    def _weird_events(self, events: List[NetworkEvent]) -> List[Anomaly]:
        by_source: Dict[str, List[NetworkEvent]] = defaultdict(list)
        for e in events:
            meta = _metadata(e)
            if meta.get("name") and (meta.get("peer") or meta.get("notice")):
                by_source[e.source_ip].append(e)
        results = []
        for src, group in by_source.items():
            if len(group) >= 3:
                names = sorted({str(_metadata(e).get("name")) for e in group})
                results.append(self._anomaly(
                    group, "zeek_weird_event_burst", 0.61,
                    f"Zeek recorded {len(group)} unusual protocol events for source {src}; event types include {', '.join(names[:5])}.",
                    {"source_ip": src, "weird_event_count": len(group), "event_names": names},
                ))
        return results

    def _file_artifacts(self, events: List[NetworkEvent]) -> List[Anomaly]:
        suspicious = []
        for e in events:
            meta = _metadata(e)
            filename = str(meta.get("filename") or "").lower()
            if not filename:
                continue
            extension = "." + filename.rsplit(".", 1)[-1] if "." in filename else ""
            size_bytes = max(_number(meta.get("seen_bytes")), _number(meta.get("total_bytes")))
            mime = str(meta.get("mime_type") or "").lower()
            executable = extension in EXECUTABLE_EXTENSIONS
            large_opaque = ("octet-stream" in mime or extension == ".bin") and size_bytes >= 5_000_000
            if (executable and size_bytes >= 500_000) or large_opaque:
                suspicious.append(e)
        if not suspicious:
            return []
        return [self._anomaly(
            suspicious, "suspicious_file_transfer_metadata", 0.76,
            f"{len(suspicious)} file-transfer records describe a sizeable executable or opaque binary artifact. Review file hashes and endpoint context; metadata alone does not establish malware.",
            {"file_event_count": len(suspicious),
             "files": [{"filename": _metadata(e).get("filename"),
                        "mime_type": _metadata(e).get("mime_type"),
                        "bytes": int(max(_number(_metadata(e).get("seen_bytes")),
                                         _number(_metadata(e).get("total_bytes"))))}
                       for e in suspicious[:10]]},
        )]
