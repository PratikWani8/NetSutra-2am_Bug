"""Investigation service managing Gemma reasoning, prompt grounding, and response parsing."""

from datetime import datetime, timezone
import json
import logging
import re
from typing import Any, Dict, Optional

from config import Settings, get_settings
from investigation.prompts import build_investigation_prompt
from providers.base import (
    BaseGemmaProvider,
    ProviderError,
    ProviderResponseError,
)
from providers.factory import ProviderFactory
from schemas.investigation import (
    IncidentContext,
    InvestigateRequest,
    InvestigateResponse,
    InvestigationAnalysis,
)

logger = logging.getLogger(__name__)


def extract_json_from_text(raw_text: str) -> Optional[Dict[str, Any]]:
    """Robustly extract and parse a JSON dictionary from model output."""
    if not raw_text or not raw_text.strip():
        return None

    cleaned = raw_text.strip()

    # 1. Direct JSON parse
    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            return data
    except Exception:
        pass

    # 2. Strip code fences if whole string is wrapped
    no_fence = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE).rstrip()
    if no_fence.endswith("```"):
        no_fence = no_fence[:-3].strip()
    try:
        data = json.loads(no_fence)
        if isinstance(data, dict):
            return data
    except Exception:
        pass

    # 3. Balanced brace extraction to handle embedded JSON or code blocks
    start_idx = cleaned.find("{")
    while start_idx != -1:
        depth = 0
        in_string = False
        escape = False
        for i in range(start_idx, len(cleaned)):
            c = cleaned[i]
            if escape:
                escape = False
                continue
            if c == "\\":
                escape = True
                continue
            if c == '"':
                in_string = not in_string
                continue
            if not in_string:
                if c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0:
                        candidate = cleaned[start_idx : i + 1]
                        try:
                            data = json.loads(candidate)
                            if isinstance(data, dict):
                                return data
                        except Exception:
                            pass
                        break
        start_idx = cleaned.find("{", start_idx + 1)

    return None


class InvestigationService:
    """Orchestrates Gemma-based investigation of correlated incidents."""

    def __init__(self, provider_factory: Optional[ProviderFactory] = None, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()
        self.factory = provider_factory or ProviderFactory(self.settings)

    async def investigate(self, request: InvestigateRequest) -> InvestigateResponse:
        """Analyze an incident using the explicitly requested provider."""
        # 1. Resolve selected provider (no automatic switching)
        provider: BaseGemmaProvider = self.factory.get_provider(request.provider)

        # 2. Build grounded prompt from incident and evidence
        prompt = build_investigation_prompt(request.incident)

        # 3. Invoke provider
        raw_output = await provider.generate_investigation(prompt)

        # 4. Parse and validate model output
        analysis = self._parse_and_validate_response(raw_output, request.incident)

        # 5. Build response conforming to schema
        return InvestigateResponse(
            incident_id=request.incident.incident_id,
            provider=request.provider,
            model=provider.model_name,
            summary=analysis.summary,
            observed_evidence=analysis.observed_evidence,
            possible_explanations=analysis.possible_explanations,
            recommended_checks=analysis.recommended_checks,
            uncertainties=analysis.uncertainties,
            created_at=datetime.now(timezone.utc),
        )

    def _parse_and_validate_response(
        self,
        raw_text: str,
        incident: IncidentContext,
    ) -> InvestigationAnalysis:
        """Parse raw model output into structured InvestigationAnalysis with graceful fallback."""
        parsed_dict = extract_json_from_text(raw_text)

        if parsed_dict:
            try:
                # Ensure all required list fields are lists
                summary = str(parsed_dict.get("summary") or incident.summary)

                def to_list(val: Any) -> list:
                    if isinstance(val, list):
                        return [str(item) for item in val if item]
                    elif isinstance(val, str) and val.strip():
                        return [val.strip()]
                    return []

                observed_evidence = to_list(parsed_dict.get("observed_evidence"))
                if not observed_evidence:
                    observed_evidence = [incident.summary]

                possible_explanations = to_list(parsed_dict.get("possible_explanations"))
                if not possible_explanations:
                    possible_explanations = ["Unusual network activity requiring administrative verification."]

                recommended_checks = to_list(parsed_dict.get("recommended_checks"))
                if not recommended_checks:
                    recommended_checks = [
                        "Review connection timestamps and destination IP ownership.",
                        "Inspect endpoint logs for matching network activity.",
                    ]

                uncertainties = to_list(parsed_dict.get("uncertainties"))
                if not uncertainties:
                    uncertainties = [
                        "Available telemetry does not determine application payload or user intent."
                    ]

                return InvestigationAnalysis(
                    summary=summary,
                    observed_evidence=observed_evidence,
                    possible_explanations=possible_explanations,
                    recommended_checks=recommended_checks,
                    uncertainties=uncertainties,
                )
            except Exception as exc:
                logger.warning("Error transforming parsed JSON to InvestigationAnalysis: %s", exc)

        # Parse model free-text when model returns non-JSON text
        logger.info("Extracting structured analysis directly from model generated narrative.")
        cleaned_text = raw_text.strip() if raw_text else ""
        lines = [line.strip() for line in cleaned_text.splitlines() if line.strip()]

        # Extract summary: First substantive paragraph or sentence from model
        summary_text = ""
        paragraphs = [p.strip() for p in cleaned_text.split("\n\n") if p.strip()]
        if paragraphs:
            summary_text = paragraphs[0]
        elif lines:
            summary_text = lines[0]
        else:
            summary_text = incident.summary

        # Extract bullet items from model output
        model_bullets = [
            l.lstrip("-*•0123456789.) ")
            for l in lines
            if re.match(r"^[-*•0123456789.)]", l)
        ]

        evidence_items = []
        explanation_items = []
        checks_items = []

        for b in model_bullets:
            b_lower = b.lower()
            if any(k in b_lower for k in ["check", "inspect", "verify", "review", "investigate", "recommend"]):
                checks_items.append(b)
            elif any(k in b_lower for k in ["observed", "detected", "bytes", "port", "ip", "connection", "traffic", "telemetry"]):
                evidence_items.append(b)
            else:
                explanation_items.append(b)

        if not evidence_items and len(lines) > 1:
            evidence_items = lines[1:min(4, len(lines))]
        if not explanation_items and len(paragraphs) > 1:
            explanation_items = paragraphs[1:min(3, len(paragraphs))]
        if not checks_items:
            for l in lines:
                if any(w in l.lower() for w in ["firewall", "host", "auth", "endpoint", "packet", "port"]):
                    checks_items.append(l)

        return InvestigationAnalysis(
            summary=summary_text,
            observed_evidence=evidence_items or [f"Observed incident {incident.incident_id}: {incident.summary}"],
            possible_explanations=explanation_items or [f"Model analysis: {summary_text[:300]}"],
            recommended_checks=checks_items or [f"Perform host and network triage for {incident.title}"],
            uncertainties=[
                "The AI model produced an unstructured response requiring analyst review; parsed directly from LLM generation.",
                "Application-layer payload content was not present in connection telemetry."
            ],
        )
