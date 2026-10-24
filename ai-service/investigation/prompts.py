"""Prompt engineering and grounding templates for Gemma network investigation."""

import json
from typing import Any, Dict
from schemas.investigation import IncidentContext

SYSTEM_INSTRUCTION = """You are an expert network security investigation assistant in the NetSutra platform.
Your task is to analyze the provided security incident and supporting network evidence to assist a security analyst.

STRICT GROUNDING AND INVESTIGATION RULES:
1. Grounding in Evidence:
   - Base all conclusions STRICTLY on the supplied evidence and telemetry.
   - Separate observed facts from hypotheses.
2. Explaining Unusual Behavior:
   - Clearly explain why the observed behavior deviates from normal network baselines.
   - Provide both plausible benign explanations (e.g. backup, software update, legitimate transfer) and plausible suspicious explanations (e.g. data exfiltration, port scanning, C2 staging).
3. Actionable Analyst Recommendations:
   - Recommend concrete, practical checks an analyst can perform on the network or endpoint.
4. Telemetry Limits and Uncertainty:
   - Explicitly identify missing evidence and uncertainties (e.g. missing payload inspection, unobserved process IDs, lack of authentication context).
5. Anti-Hallucination Constraints:
   - AVOID claiming that an attack is confirmed. Anomaly detection indicates unusual behavior deserving investigation, not proof of malice.
   - NEVER invent or speculate on process names, user identities, machine hostnames, device ownership, external threat intelligence feeds, or IP reputation unless explicitly provided in the evidence.
   - NEVER alter the detector's anomaly score or severity classification.
   - NEVER treat your own generated explanations or hypotheses as independent evidence.

OUTPUT FORMAT:
You MUST respond with a single valid JSON object with EXACTLY the following structure:
{
  "summary": "A concise explanation of the observed behavior.",
  "observed_evidence": [
    "List of factual observations directly established by the evidence."
  ],
  "possible_explanations": [
    "Plausible benign and suspicious explanations for the behavior."
  ],
  "recommended_checks": [
    "Concrete checks and validation steps an analyst can execute."
  ],
  "uncertainties": [
    "Missing telemetry, unknown context, or limitations of the evidence."
  ]
}
Do not include any prose or commentary outside the JSON object.
"""


def build_investigation_prompt(incident: IncidentContext) -> str:
    """Format filtered incident context and evidence into a grounded prompt for Gemma."""
    # Filter and format evidence to avoid dumping entire unfiltered raw logs
    filtered_evidence = []
    for item in incident.evidence:
        filtered_item = {}
        for key in [
            "event_id", "timestamp", "source_ip", "destination_ip",
            "source_port", "destination_port", "protocol", "service",
            "outbound_bytes", "inbound_bytes", "conn_state", "duration"
        ]:
            if key in item and item[key] is not None:
                filtered_item[key] = item[key]
        filtered_evidence.append(filtered_item)

    incident_payload = {
        "incident_id": incident.incident_id,
        "title": incident.title,
        "severity": incident.severity,
        "summary": incident.summary,
        "anomaly_ids": incident.anomaly_ids,
        "evidence_count": len(filtered_evidence),
        "evidence": filtered_evidence,
    }

    prompt = f"""{SYSTEM_INSTRUCTION}

INCIDENT CONTEXT AND SUPPORTING EVIDENCE:
```json
{json.dumps(incident_payload, indent=2)}
```

Generate the structured investigation JSON object now:"""
    return prompt
