#!/usr/bin/env python3
"""NetSutra - Standalone Anomaly Detector & Incident Correlator Runner

Directly runs the unsupervised detection algorithms (outbound_volume_deviation,
failed_connection_pattern, connection_frequency_burst, rare_destination)
and event correlation on any Zeek connection log or JSON file.

Usage:
    python scripts/run_detector.py [--file <path>] [--json]
"""

import argparse
from datetime import datetime, timezone
import json
import os
import sys

# Ensure ai-service modules can be imported
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
AI_SERVICE_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), "ai-service")
if AI_SERVICE_DIR not in sys.path:
    sys.path.insert(0, AI_SERVICE_DIR)

from detection.detector import AnomalyDetectorService
from correlation.correlator import EventCorrelator
from schemas.telemetry import NetworkEvent
from schemas.anomaly import DetectionRequest
from schemas.correlation import CorrelateRequest


def parse_zeek_records(file_path: str):
    """Parses Zeek NDJSON lines or JSON array into NetworkEvent objects."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    events = []
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read().strip()

    if content.startswith("[") and content.endswith("]"):
        items = json.loads(content)
        for r in items:
            if not isinstance(r, dict) or r.get("_comment"):
                continue
            ev = build_network_event(r)
            if ev:
                events.append(ev)
    else:
        for line in content.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            try:
                r = json.loads(line)
                if isinstance(r, dict):
                    ev = build_network_event(r)
                    if ev:
                        events.append(ev)
            except json.JSONDecodeError:
                continue

    return events


def build_network_event(r: dict):
    """Builds a validated NetworkEvent from a raw Zeek connection dictionary."""
    src_ip = r.get("id.orig_h") or r.get("source_ip") or r.get("orig_h") or r.get("src_ip")
    dst_ip = r.get("id.resp_h") or r.get("destination_ip") or r.get("resp_h") or r.get("dest_ip")

    if not src_ip or not dst_ip:
        return None

    raw_ts = r.get("ts") or r.get("timestamp")
    if isinstance(raw_ts, (int, float)):
        ts_val = raw_ts if raw_ts < 1e11 else raw_ts / 1000.0
        dt = datetime.fromtimestamp(ts_val, tz=timezone.utc)
    elif isinstance(raw_ts, str):
        try:
            dt = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
        except ValueError:
            dt = datetime.now(timezone.utc)
    else:
        dt = datetime.now(timezone.utc)

    uid = r.get("uid") or r.get("event_id") or r.get("id") or f"evt-{len(r)}"

    return NetworkEvent(
        event_id=str(uid),
        timestamp=dt,
        source_ip=str(src_ip),
        destination_ip=str(dst_ip),
        source_port=r.get("id.orig_p") or r.get("source_port") or r.get("orig_p"),
        destination_port=r.get("id.resp_p") or r.get("destination_port") or r.get("resp_p"),
        protocol=r.get("proto") or r.get("protocol"),
        service=r.get("service"),
        outbound_bytes=r.get("orig_bytes") or r.get("outbound_bytes"),
        inbound_bytes=r.get("resp_bytes") or r.get("inbound_bytes"),
        duration=r.get("duration"),
        conn_state=r.get("conn_state"),
        history=r.get("history"),
        missed_bytes=r.get("missed_bytes")
    )


def main():
    parser = argparse.ArgumentParser(description="NetSutra Standalone Anomaly Detector Runner")
    default_log = os.path.join(os.path.dirname(SCRIPT_DIR), "server", "samples", "lab_simulation_zeek.log")
    parser.add_argument("--file", "-f", default=default_log, help="Path to Zeek log file")
    parser.add_argument("--json", "-j", action="store_true", help="Output raw JSON results")
    parser.add_argument("--baseline-count", "-b", type=int, default=5, help="Number of initial events used as baseline")
    args = parser.parse_args()

    events = parse_zeek_records(args.file)
    if not events:
        print(f"No valid network events found in {args.file}")
        sys.exit(1)

    baseline_idx = min(args.baseline_count, len(events))
    baseline_events = events[:baseline_idx]
    eval_events = events[baseline_idx:] if baseline_idx < len(events) else events

    detector = AnomalyDetectorService()
    detection_request = DetectionRequest(events=eval_events, baseline_events=baseline_events)
    detection_response = detector.detect(detection_request)

    correlator = EventCorrelator()
    correlate_request = CorrelateRequest(anomalies=detection_response.anomalies, events=eval_events)
    correlate_response = correlator.correlate(correlate_request)

    if args.json:
        output = {
            "total_events": len(events),
            "baseline_events_used": len(baseline_events),
            "events_evaluated": len(eval_events),
            "anomalies_detected": detection_response.anomalies_detected,
            "incidents_created": correlate_response.incident_count,
            "anomalies": [a.model_dump(mode="json") for a in detection_response.anomalies],
            "incidents": [inc.model_dump(mode="json") for inc in correlate_response.incidents]
        }
        print(json.dumps(output, indent=2))
        return

    print("========================================================================")
    print("  NetSutra Anomaly Detection & Incident Correlation Results")
    print("========================================================================")
    print(f"Log File:               {args.file}")
    print(f"Total Events Parsed:    {len(events)}")
    print(f"Baseline Events:        {len(baseline_events)}")
    print(f"Evaluated Events:       {len(eval_events)}")
    print(f"Anomalies Flagged:      {detection_response.anomalies_detected}")
    print(f"Incidents Correlated:   {correlate_response.incident_count}")
    print("------------------------------------------------------------------------")
    print("Detected Anomalies:")
    for a in detection_response.anomalies:
        print(f"  • [{a.severity.value.upper()}] {a.method} (Score: {a.score})")
        print(f"    Reasons: {'; '.join(a.reasons)}")
        print(f"    Evidence: {a.evidence_event_ids} | Features: {a.features}")
    print("------------------------------------------------------------------------")
    print("Correlated Incidents:")
    for inc in correlate_response.incidents:
        print(f"  • Incident ID:  {inc.incident_id}")
        print(f"    Title:        {inc.title}")
        print(f"    Severity:     {inc.severity.value.upper()}")
        print(f"    Summary:      {inc.summary}")
        print(f"    Linked IDs:   {inc.anomaly_ids}")
    print("========================================================================\n")


if __name__ == "__main__":
    main()
