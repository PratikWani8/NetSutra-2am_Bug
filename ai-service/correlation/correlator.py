"""Event correlation engine grouping related anomalies into transparent incidents."""

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
import uuid

from config import Settings, get_settings
from schemas.anomaly import Anomaly, Severity
from schemas.correlation import (
    CorrelateRequest,
    CorrelateResponse,
    CorrelationParameters,
    Incident,
)
from schemas.telemetry import NetworkEvent


class EventCorrelator:
    """Correlates anomalies and telemetry events into actionable security incidents."""

    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()

    def correlate(self, request: CorrelateRequest) -> CorrelateResponse:
        """Group related anomalies into incidents using entity and temporal correlation."""
        anomalies = request.anomalies
        if not anomalies:
            return CorrelateResponse(
                incidents=[],
                total_anomalies_correlated=0,
                incident_count=0,
            )

        params = request.parameters or CorrelationParameters()
        time_window = params.time_window_seconds or self.settings.CORRELATION_WINDOW_SECONDS

        # Build lookup table for events if provided
        events_by_id: Dict[str, NetworkEvent] = {}
        if request.events:
            for ev in request.events:
                events_by_id[ev.event_id] = ev

        # Extract entity associations for each anomaly
        anomaly_entities: List[Dict[str, Any]] = []
        for anom in anomalies:
            src_ip = anom.features.get("source_ip")
            dst_ip = anom.features.get("destination_ip")

            # If not in features, look up from evidence event IDs
            if not src_ip or not dst_ip:
                for eid in anom.evidence_event_ids:
                    if eid in events_by_id:
                        ev = events_by_id[eid]
                        if not src_ip:
                            src_ip = ev.source_ip
                        if not dst_ip:
                            dst_ip = ev.destination_ip
                        break

            anomaly_entities.append({
                "anomaly": anom,
                "source_ip": src_ip,
                "destination_ip": dst_ip,
                "timestamp": anom.timestamp.timestamp(),
                "evidence_ids": set(anom.evidence_event_ids),
            })

        # Disjoint set / adjacency clustering
        n = len(anomaly_entities)
        adj: List[List[Tuple[int, str]]] = [[] for _ in range(n)]

        for i in range(n):
            for j in range(i + 1, n):
                a1 = anomaly_entities[i]
                a2 = anomaly_entities[j]

                # Check temporal proximity
                time_diff = abs(a1["timestamp"] - a2["timestamp"])
                if time_diff > time_window:
                    continue

                reasons: List[str] = []

                # Dimension 1: Shared source IP
                if params.group_by_source and a1["source_ip"] and a2["source_ip"]:
                    if a1["source_ip"] == a2["source_ip"]:
                        reasons.append(
                            f"Shared source IP {a1['source_ip']} within {int(time_diff)}s window"
                        )

                # Dimension 2: Shared destination IP
                if params.group_by_destination and a1["destination_ip"] and a2["destination_ip"]:
                    if a1["destination_ip"] == a2["destination_ip"]:
                        reasons.append(
                            f"Shared target destination IP {a1['destination_ip']} within {int(time_diff)}s window"
                        )

                # Dimension 3: Shared underlying event IDs
                shared_events = a1["evidence_ids"].intersection(a2["evidence_ids"])
                if shared_events:
                    reasons.append(
                        f"Shared supporting telemetry events ({len(shared_events)} common event IDs)"
                    )

                if reasons:
                    reason_str = "; ".join(reasons)
                    adj[i].append((j, reason_str))
                    adj[j].append((i, reason_str))

        # Find connected components (clusters)
        visited = [False] * n
        clusters: List[List[int]] = []
        cluster_reasons: Dict[int, List[str]] = defaultdict(list)

        for i in range(n):
            if not visited[i]:
                component: List[int] = []
                queue = [i]
                visited[i] = True
                while queue:
                    curr = queue.pop(0)
                    component.append(curr)
                    for neighbor, reason in adj[curr]:
                        cluster_reasons[len(clusters)].append(reason)
                        if not visited[neighbor]:
                            visited[neighbor] = True
                            queue.append(neighbor)
                clusters.append(component)

        # Build Incident objects
        incidents: List[Incident] = []
        severity_rank = {
            Severity.LOW: 1,
            Severity.MEDIUM: 2,
            Severity.HIGH: 3,
            Severity.CRITICAL: 4,
        }
        rank_to_severity = {v: k for k, v in severity_rank.items()}

        for cluster_idx, member_indices in enumerate(clusters):
            if len(member_indices) < params.min_anomalies_per_incident:
                continue

            member_anomalies = [anomaly_entities[idx]["anomaly"] for idx in member_indices]
            anomaly_ids = [a.anomaly_id for a in member_anomalies]

            # Aggregate evidence event IDs
            all_evidence_ids: List[str] = []
            seen_eids: Set[str] = set()
            for a in member_anomalies:
                for eid in a.evidence_event_ids:
                    if eid not in seen_eids:
                        seen_eids.add(eid)
                        all_evidence_ids.append(eid)

            # Timestamps
            timestamps = [a.timestamp for a in member_anomalies]
            first_obs = min(timestamps)
            last_obs = max(timestamps)

            # Aggregate severity
            max_rank = max(severity_rank[a.severity] for a in member_anomalies)
            aggregate_sev = rank_to_severity[max_rank]

            # Determine primary source and destination IPs
            src_ips = [anomaly_entities[idx]["source_ip"] for idx in member_indices if anomaly_entities[idx]["source_ip"]]
            dst_ips = [anomaly_entities[idx]["destination_ip"] for idx in member_indices if anomaly_entities[idx]["destination_ip"]]
            primary_src = src_ips[0] if src_ips else None
            primary_dst = dst_ips[0] if dst_ips else None

            # Transparent correlation reasons
            reasons = sorted(list(set(cluster_reasons[cluster_idx])))
            if not reasons:
                # Single anomaly cluster
                a = member_anomalies[0]
                reasons = [f"Independent behavioral anomaly ({a.method}) detected with score {a.score:.2f}."]

            # Build concise factual summary
            methods = sorted(list({a.method for a in member_anomalies}))
            methods_str = ", ".join(methods)
            if primary_src and len(member_anomalies) > 1:
                summary = (
                    f"Cluster of {len(member_anomalies)} anomalies ({methods_str}) "
                    f"observed from source {primary_src} between "
                    f"{first_obs.strftime('%H:%M:%SZ')} and {last_obs.strftime('%H:%M:%SZ')}."
                )
            elif primary_src:
                summary = (
                    f"Anomaly ({methods_str}) detected for source {primary_src} "
                    f"with severity {aggregate_sev.value}."
                )
            else:
                summary = f"Detected network incident involving {len(member_anomalies)} anomalies ({methods_str})."

            title = f"{aggregate_sev.value.upper()}: {methods_str} on {primary_src or 'host'}"

            # Collect evidence items for investigation
            evidence_items: List[Dict[str, Any]] = []
            for eid in all_evidence_ids:
                if eid in events_by_id:
                    ev = events_by_id[eid]
                    evidence_items.append({
                        "event_id": ev.event_id,
                        "source_ip": ev.source_ip,
                        "destination_ip": ev.destination_ip,
                        "source_port": ev.source_port,
                        "destination_port": ev.destination_port,
                        "protocol": ev.protocol,
                        "service": ev.service,
                        "outbound_bytes": ev.outbound_bytes,
                        "inbound_bytes": ev.inbound_bytes,
                        "conn_state": ev.conn_state,
                        "timestamp": ev.timestamp.isoformat(),
                    })
                else:
                    # Provide stub with known features
                    stub = {
                        "event_id": eid,
                        "source_ip": primary_src,
                        "destination_ip": primary_dst,
                    }
                    evidence_items.append(stub)

            incidents.append(
                Incident(
                    incident_id=f"inc-{uuid.uuid4().hex[:10]}",
                    title=title,
                    anomaly_ids=anomaly_ids,
                    evidence_event_ids=all_evidence_ids,
                    correlation_reasons=reasons,
                    first_observed=first_obs,
                    last_observed=last_obs,
                    severity=aggregate_sev,
                    summary=summary,
                    primary_source_ip=primary_src,
                    primary_destination_ip=primary_dst,
                    evidence=evidence_items,
                )
            )

        # Sort incidents by severity descending
        incidents.sort(key=lambda inc: severity_rank[inc.severity], reverse=True)

        return CorrelateResponse(
            incidents=incidents,
            total_anomalies_correlated=sum(len(inc.anomaly_ids) for inc in incidents),
            incident_count=len(incidents),
        )
