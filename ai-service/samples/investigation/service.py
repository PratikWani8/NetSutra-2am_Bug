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

    # 2. Extract from markdown code blocks: ```json ... ``` or ``` ... ```
    code_block_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, re.DOTALL)
    if code_block_match:
        try:
            data = json.loads(code_block_match.group(1))
            if isinstance(data, dict):
                return data
        except Exception:
            pass

    # 3. Find outer braces: { ... }
    brace_match = re.search(r"(\{.*\})", cleaned, re.DOTALL)
    if brace_match:
        try:
            data = json.loads(brace_match.group(1))
            if isinstance(data, dict):
                return data
        except Exception:
            pass

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

        # Graceful fallback when model returns non-JSON or malformed text
        logger.warning("Gemma provider returned non-JSON text. Using structured fallback.")
        cleaned_text = raw_text.strip() if raw_text else "No explanation generated."
        summary_snippet = cleaned_text.split("\n")[0][:200]

        return InvestigationAnalysis(
            summary=f"Automated analysis: {summary_snippet}",
            observed_evidence=[
                f"Incident {incident.incident_id}: {incident.summary}",
                f"{len(incident.evidence)} supporting evidence records captured.",
            ],
            possible_explanations=[
                "Activity may represent anomalous data movement, unauthorized scan, or legitimate scheduled workflow.",
                f"Model response notes: {cleaned_text[:300]}",
            ],
            recommended_checks=[
                "Validate whether the destination IP is an authorized service.",
                "Review host authentication and process logs around the incident window.",
                "Compare traffic volume with previous baseline periods.",
            ],
            uncertainties=[
                "The AI model produced an unstructured response requiring analyst review.",
                "Application-layer payload content was not present in connection telemetry.",
            ],
        )
