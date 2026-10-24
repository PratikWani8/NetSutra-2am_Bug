"""Tests for Gemma investigation service, prompt grounding, and response parsing."""

import json
import pytest
from unittest.mock import AsyncMock, patch

from investigation.prompts import build_investigation_prompt
from investigation.service import InvestigationService, extract_json_from_text
from providers.base import BaseGemmaProvider, ProviderUnavailableError
from schemas.investigation import IncidentContext, InvestigateRequest


@pytest.fixture
def sample_incident() -> IncidentContext:
    return IncidentContext(
        incident_id="inc-test-001",
        title="High Outbound Traffic",
        severity="high",
        summary="Unusual outbound traffic detected from 192.0.2.10 to 198.51.100.20.",
        anomaly_ids=["anom-vol-001"],
        evidence=[
            {
                "event_id": "event-001",
                "source_ip": "192.0.2.10",
                "destination_ip": "198.51.100.20",
                "outbound_bytes": 12_000_000,
                "protocol": "tcp",
                "conn_state": "SF",
            }
        ],
    )


def test_grounding_prompt_structure(sample_incident):
    """Investigation prompt must include explicit grounding rules and anti-hallucination constraints."""
    prompt = build_investigation_prompt(sample_incident)

    # Core grounding rules
    assert "Separate observed facts from hypotheses" in prompt
    assert "AVOID claiming that an attack is confirmed" in prompt
    assert "NEVER invent or speculate on process names" in prompt
    assert "NEVER alter the detector's anomaly score or severity" in prompt
    assert "summary" in prompt
    assert "observed_evidence" in prompt
    assert "possible_explanations" in prompt
    assert "recommended_checks" in prompt
    assert "uncertainties" in prompt

    # Evidence grounding
    assert "192.0.2.10" in prompt
    assert "198.51.100.20" in prompt
    assert "12000000" in prompt


def test_investigation_success_valid_json(test_settings, sample_incident, async_runner):
    """Investigation service must parse valid JSON output into InvestigateResponse schema."""
    service = InvestigationService(settings=test_settings)

    mock_llm_json = {
        "summary": "Host 192.0.2.10 transmitted 12 MB to external IP 198.51.100.20.",
        "observed_evidence": [
            "Outbound traffic exceeded the baseline volume.",
            "Connection state SF indicates graceful TCP teardown.",
        ],
        "possible_explanations": [
            "Legitimate large file backup or update sync.",
            "Potential unauthorized data staging or exfiltration.",
        ],
        "recommended_checks": [
            "Verify ownership and reputation of 198.51.100.20.",
            "Check endpoint process connection logs for 192.0.2.10 at the incident timestamp.",
        ],
        "uncertainties": [
            "Application payload content is not available in the connection record.",
        ],
    }

    mock_provider = AsyncMock(spec=BaseGemmaProvider)
    mock_provider.provider_id = "gemma-api"
    mock_provider.model_name = "gemma-2-9b-it"
    mock_provider.generate_investigation.return_value = json.dumps(mock_llm_json)

    with patch.object(service.factory, "get_provider", return_value=mock_provider):
        req = InvestigateRequest(provider="gemma-api", incident=sample_incident)
        res = async_runner(service.investigate(req))

        assert res.incident_id == "inc-test-001"
        assert res.provider == "gemma-api"
        assert res.model == "gemma-2-9b-it"
        assert res.summary == mock_llm_json["summary"]
        assert len(res.observed_evidence) == 2
        assert len(res.possible_explanations) == 2
        assert len(res.recommended_checks) == 2
        assert len(res.uncertainties) == 1


def test_investigation_handles_markdown_code_fences(test_settings, sample_incident, async_runner):
    """Investigation service must handle model responses wrapped in markdown code fences."""
    service = InvestigationService(settings=test_settings)

    fenced_output = """Here is the investigation result:
```json
{
  "summary": "Outbound traffic burst observed.",
  "observed_evidence": ["12 MB sent"],
  "possible_explanations": ["Backup sync"],
  "recommended_checks": ["Check process"],
  "uncertainties": ["No packet capture"]
}
```
"""
    mock_provider = AsyncMock(spec=BaseGemmaProvider)
    mock_provider.provider_id = "ollama"
    mock_provider.model_name = "gemma2"
    mock_provider.generate_investigation.return_value = fenced_output

    with patch.object(service.factory, "get_provider", return_value=mock_provider):
        req = InvestigateRequest(provider="ollama", incident=sample_incident)
        res = async_runner(service.investigate(req))

        assert res.summary == "Outbound traffic burst observed."
        assert res.observed_evidence == ["12 MB sent"]


def test_investigation_handles_invalid_model_output_gracefully(test_settings, sample_incident, async_runner):
    """When the model returns non-JSON or garbled text, it must fallback gracefully without crashing."""
    service = InvestigationService(settings=test_settings)

    garbled_output = "I cannot determine what happened. The IP 192.0.2.10 had high traffic, but my thoughts are unstructured."

    mock_provider = AsyncMock(spec=BaseGemmaProvider)
    mock_provider.provider_id = "gemma-api"
    mock_provider.model_name = "gemma-2-9b-it"
    mock_provider.generate_investigation.return_value = garbled_output

    with patch.object(service.factory, "get_provider", return_value=mock_provider):
        req = InvestigateRequest(provider="gemma-api", incident=sample_incident)
        res = async_runner(service.investigate(req))

        assert res.incident_id == "inc-test-001"
        assert res.summary is not None
        assert len(res.observed_evidence) > 0
        assert len(res.possible_explanations) > 0
        assert len(res.recommended_checks) > 0
        assert any("unstructured" in u.lower() or "limitations" in u.lower() for u in res.uncertainties)


def test_investigation_does_not_auto_switch_on_failure(test_settings, sample_incident, async_runner):
    """When the selected provider fails, it must NOT auto-switch to another provider; it must raise an error."""
    service = InvestigationService(settings=test_settings)

    mock_ollama = AsyncMock(spec=BaseGemmaProvider)
    mock_ollama.provider_id = "ollama"
    mock_ollama.generate_investigation.side_effect = ProviderUnavailableError(
        message="Ollama daemon unreachable",
        provider="ollama",
    )

    with patch.object(service.factory, "get_provider", return_value=mock_ollama):
        req = InvestigateRequest(provider="ollama", incident=sample_incident)
        with pytest.raises(ProviderUnavailableError, match="Ollama daemon unreachable"):
            async_runner(service.investigate(req))
