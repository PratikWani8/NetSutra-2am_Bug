"""Comprehensive automated tests validating provider selection, routing, contracts, and failure handling."""

import json
from unittest.mock import AsyncMock, patch
import pytest
import httpx
from fastapi.testclient import TestClient

from config import Settings
from investigation.service import InvestigationService
from main import app
from providers.base import (
    BaseGemmaProvider,
    ProviderNotConfiguredError,
    ProviderResponseError,
    ProviderUnavailableError,
)
from providers.factory import ProviderFactory
from providers.gemma_api import GemmaApiProvider
from providers.ollama import OllamaProvider
from schemas.investigation import (
    IncidentContext,
    InvestigateRequest,
    InvestigateResponse,
)
from schemas.providers import SingleProviderStatus


@pytest.fixture
def test_incident() -> IncidentContext:
    """Fixture providing standardized incident evidence for contract verification."""
    return IncidentContext(
        incident_id="inc-secops-001",
        title="High-Volume Data Exfiltration",
        severity="critical",
        summary="Sustained outbound data transfer from 192.0.2.10 to external IP 198.51.100.20.",
        anomaly_ids=["anom-vol-001"],
        evidence=[
            {
                "event_id": "zeek-evt-101",
                "timestamp": "2026-10-25T02:00:00Z",
                "source_ip": "192.0.2.10",
                "destination_ip": "198.51.100.20",
                "source_port": 49152,
                "destination_port": 443,
                "protocol": "tcp",
                "service": "ssl",
                "outbound_bytes": 150_000_000,
                "inbound_bytes": 450_000,
                "duration": 42.5,
                "conn_state": "SF",
            }
        ],
    )


# =========================================================================
# TEST 1 & 2: Routing to Configured Providers
# =========================================================================

def test_gemma_api_routing_endpoint_and_headers(test_settings, test_incident, async_runner):
    """Verify selecting Gemma API routes to the configured hosted API endpoint with auth headers."""
    provider = GemmaApiProvider(test_settings)
    mock_response_text = json.dumps({
        "summary": "Outbound data flow verified.",
        "observed_evidence": ["150 MB outbound transmitted."],
        "possible_explanations": ["Authorized backup", "Data exfiltration"],
        "recommended_checks": ["Verify host authentication logs"],
        "uncertainties": ["Payload uninspected"],
    })
    mock_http_resp = httpx.Response(
        status_code=200,
        json={"candidates": [{"content": {"parts": [{"text": mock_response_text}]}}]},
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_http_resp
        output = async_runner(provider.generate_investigation("Sample prompt"))

        # Verify routed URL target
        assert mock_post.called
        call_url = mock_post.call_args[0][0]
        assert "generativelanguage.googleapis.com" in call_url
        assert test_settings.GEMMA_API_MODEL in call_url
        assert test_settings.GEMMA_API_KEY in call_url

        # Verify auth headers
        call_headers = mock_post.call_args[1].get("headers", {})
        assert call_headers.get("x-goog-api-key") == test_settings.GEMMA_API_KEY
        assert output == mock_response_text


def test_ollama_routing_endpoint_and_model(test_settings, test_incident, async_runner):
    """Verify selecting Ollama routes to the local Ollama daemon /api/generate with local model."""
    provider = OllamaProvider(test_settings)
    mock_response_text = json.dumps({
        "summary": "Ollama local inference response.",
        "observed_evidence": ["150 MB outbound."],
        "possible_explanations": ["Local forensic reasoning."],
        "recommended_checks": ["Inspect destination endpoint."],
        "uncertainties": ["Zero egress inspection."],
    })
    mock_http_resp = httpx.Response(
        status_code=200,
        json={"response": mock_response_text},
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_http_resp
        output = async_runner(provider.generate_investigation("Sample prompt"))

        # Verify routed URL target
        assert mock_post.called
        call_url = mock_post.call_args[0][0]
        assert call_url == f"{test_settings.OLLAMA_BASE_URL}/api/generate"

        # Verify local model payload
        call_payload = mock_post.call_args[1].get("json", {})
        assert call_payload.get("model") == test_settings.OLLAMA_MODEL
        assert call_payload.get("format") == "json"
        assert output == mock_response_text


# =========================================================================
# TEST 3: Identical Contract & Schema Verification
# =========================================================================

def test_both_providers_receive_same_evidence_and_return_same_schema(test_settings, test_incident, async_runner):
    """Confirm both Gemma API and Ollama receive identical incident context and return the exact response schema."""
    service = InvestigationService(settings=test_settings)

    standard_analysis = {
        "summary": "High volume transfer from host 192.0.2.10 to 198.51.100.20.",
        "observed_evidence": ["150 MB transmitted in 42.5 seconds."],
        "possible_explanations": ["Scheduled offsite backup", "Unauthorized data staging"],
        "recommended_checks": ["Inspect process creation logs on 192.0.2.10."],
        "uncertainties": ["Payload encrypted with TLS."],
    }

    # 1. Evaluate with gemma-api
    with patch("providers.gemma_api.GemmaApiProvider.generate_investigation", new_callable=AsyncMock) as mock_gemma:
        mock_gemma.return_value = json.dumps(standard_analysis)
        req_gemma = InvestigateRequest(provider="gemma-api", incident=test_incident)
        res_gemma = async_runner(service.investigate(req_gemma))

        # Evidence passed in prompt must match incident
        gemma_prompt = mock_gemma.call_args[0][0]
        assert "192.0.2.10" in gemma_prompt
        assert "198.51.100.20" in gemma_prompt
        assert "150000000" in gemma_prompt
        assert res_gemma.provider == "gemma-api"
        assert isinstance(res_gemma, InvestigateResponse)

    # 2. Evaluate with ollama
    with patch("providers.ollama.OllamaProvider.generate_investigation", new_callable=AsyncMock) as mock_ollama:
        mock_ollama.return_value = json.dumps(standard_analysis)
        req_ollama = InvestigateRequest(provider="ollama", incident=test_incident)
        res_ollama = async_runner(service.investigate(req_ollama))

        # Evidence passed in prompt must match exactly
        ollama_prompt = mock_ollama.call_args[0][0]
        assert "192.0.2.10" in ollama_prompt
        assert "198.51.100.20" in ollama_prompt
        assert "150000000" in ollama_prompt
        assert res_ollama.provider == "ollama"
        assert isinstance(res_ollama, InvestigateResponse)

    # Contract equivalence
    assert res_gemma.incident_id == res_ollama.incident_id == "inc-secops-001"
    assert res_gemma.summary == res_ollama.summary
    assert res_gemma.observed_evidence == res_ollama.observed_evidence
    assert res_gemma.possible_explanations == res_ollama.possible_explanations
    assert res_gemma.recommended_checks == res_ollama.recommended_checks
    assert res_gemma.uncertainties == res_ollama.uncertainties


# =========================================================================
# TEST 4: Separate Failure Condition Checks
# =========================================================================

# Condition 4.1: API request succeeds
def test_condition_api_request_succeeds(client: TestClient, test_incident):
    """Condition 4.1: API request succeeds and returns HTTP 200 with InvestigateResponse."""
    payload = {
        "provider": "gemma-api",
        "incident": test_incident.model_dump(),
    }
    llm_output = json.dumps({
        "summary": "Transfer to external target validated.",
        "observed_evidence": ["150 MB observed"],
        "possible_explanations": ["Backup"],
        "recommended_checks": ["Check logs"],
        "uncertainties": ["No packet capture"],
    })
    with patch("providers.gemma_api.GemmaApiProvider.generate_investigation", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = llm_output
        res = client.post("/investigate", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["incident_id"] == "inc-secops-001"
        assert data["provider"] == "gemma-api"
        assert "summary" in data


# Condition 4.2a: API key is missing
def test_condition_api_key_missing(client: TestClient, test_incident):
    """Condition 4.2a: Missing GEMMA_API_KEY raises ProviderNotConfiguredError and returns HTTP 503."""
    payload = {
        "provider": "gemma-api",
        "incident": test_incident.model_dump(),
    }
    with patch("providers.gemma_api.GemmaApiProvider.is_configured", return_value=False):
        res = client.post("/investigate", json=payload)
        assert res.status_code == 503
        data = res.json()
        assert data["provider"] == "gemma-api"
        assert data["error_type"] == "PROVIDER_NOT_CONFIGURED"
        assert "GEMMA_API_KEY is not configured" in data["detail"]


# Condition 4.2b: API key is invalid (HTTP 401 / 403 from Google AI Studio)
def test_condition_api_key_invalid(test_settings, async_runner):
    """Condition 4.2b: Invalid API key returning 401 raises ProviderResponseError with auth message."""
    provider = GemmaApiProvider(test_settings)
    mock_resp = httpx.Response(
        status_code=401,
        json={"error": {"code": 401, "message": "API_KEY_INVALID"}},
    )
    with patch("httpx.AsyncClient.post", return_value=mock_resp):
        with pytest.raises(ProviderResponseError, match="authentication failed"):
            async_runner(provider.generate_investigation("Prompt"))


# Condition 4.3a: API request times out
def test_condition_api_request_timeout(test_settings, async_runner):
    """Condition 4.3a: Gemma API timeout raises ProviderUnavailableError."""
    provider = GemmaApiProvider(test_settings)
    with patch("httpx.AsyncClient.post", side_effect=httpx.TimeoutException("Read timed out")):
        with pytest.raises(ProviderUnavailableError, match="timed out"):
            async_runner(provider.generate_investigation("Prompt"))


# Condition 4.3b: API request returns HTTP 500 error
def test_condition_api_request_http_error(test_settings, async_runner):
    """Condition 4.3b: Upstream 500 from Gemma API raises ProviderResponseError."""
    provider = GemmaApiProvider(test_settings)
    mock_resp = httpx.Response(status_code=500, text="Internal Server Error")
    with patch("httpx.AsyncClient.post", return_value=mock_resp):
        with pytest.raises(ProviderResponseError, match="returned error HTTP 500"):
            async_runner(provider.generate_investigation("Prompt"))


# Condition 4.4: Ollama is unavailable (Connection refused)
def test_condition_ollama_unavailable(client: TestClient, test_incident):
    """Condition 4.4: Unreachable Ollama returns HTTP 503 with daemon guidance."""
    payload = {
        "provider": "ollama",
        "incident": test_incident.model_dump(),
    }
    with patch(
        "providers.ollama.OllamaProvider.generate_investigation",
        side_effect=ProviderUnavailableError(
            message="Cannot connect to Ollama service at http://localhost:11434. Ensure the Ollama daemon is running.",
            provider="ollama",
        ),
    ):
        res = client.post("/investigate", json=payload)
        assert res.status_code == 503
        data = res.json()
        assert data["provider"] == "ollama"
        assert data["error_type"] == "PROVIDER_UNAVAILABLE"
        assert "Ollama daemon is running" in data["detail"]


# Condition 4.5: Selected local model is not installed (Ollama 404)
def test_condition_ollama_model_not_installed(test_settings, async_runner):
    """Condition 4.5: Ollama 404 for uninstalled model raises ProviderResponseError with pull hint."""
    provider = OllamaProvider(test_settings)
    mock_resp = httpx.Response(status_code=404, text="model 'gemma2' not found")
    with patch("httpx.AsyncClient.post", return_value=mock_resp):
        with pytest.raises(ProviderResponseError, match="ollama pull"):
            async_runner(provider.generate_investigation("Prompt"))


# Condition 4.6: Provider returns malformed or incomplete output
def test_condition_malformed_incomplete_output_gracefully_handled(test_settings, test_incident, async_runner):
    """Condition 4.6: Garbled/unstructured model text is safely wrapped into schema without crashing."""
    service = InvestigationService(settings=test_settings)

    malformed_outputs = [
        "Plain text without JSON formatting: high traffic to external IP.",
        "```json\n{ incomplete json without closing bracket",
        "{ \"summary\": null }",
        "",
    ]

    for raw_bad in malformed_outputs:
        mock_p = AsyncMock(spec=BaseGemmaProvider)
        mock_p.provider_id = "ollama"
        mock_p.model_name = "gemma2"
        mock_p.generate_investigation.return_value = raw_bad

        with patch.object(service.factory, "get_provider", return_value=mock_p):
            req = InvestigateRequest(provider="ollama", incident=test_incident)
            res = async_runner(service.investigate(req))

            assert res.incident_id == "inc-secops-001"
            assert res.summary is not None
            assert isinstance(res.observed_evidence, list)
            assert len(res.observed_evidence) > 0
            assert isinstance(res.uncertainties, list)
            assert len(res.uncertainties) > 0


# =========================================================================
# TEST 6: Strict Prohibition of Silent Provider Fallback
# =========================================================================

def test_strict_no_silent_fallback_on_failure(test_settings, test_incident, async_runner):
    """When a chosen provider fails, it must NEVER silently invoke the other provider."""
    service = InvestigationService(settings=test_settings)

    mock_ollama = AsyncMock(spec=BaseGemmaProvider)
    mock_ollama.provider_id = "ollama"
    mock_ollama.generate_investigation.side_effect = ProviderUnavailableError(
        message="Ollama offline",
        provider="ollama",
    )

    mock_gemma = AsyncMock(spec=BaseGemmaProvider)
    mock_gemma.provider_id = "gemma-api"

    service.factory._providers["ollama"] = mock_ollama
    service.factory._providers["gemma-api"] = mock_gemma

    req = InvestigateRequest(provider="ollama", incident=test_incident)

    with pytest.raises(ProviderUnavailableError):
        async_runner(service.investigate(req))

    # Assert Gemma API was NOT silently invoked
    assert not mock_gemma.generate_investigation.called


# =========================================================================
# TEST 8: Secrets Never Exposed to Frontend
# =========================================================================

def test_providers_status_never_exposes_api_secret(client: TestClient, test_settings):
    """Verify GET /providers/status never leaks GEMMA_API_KEY or credentials."""
    res = client.get("/providers/status")
    assert res.status_code == 200
    res_str = res.text
    assert test_settings.GEMMA_API_KEY not in res_str
    assert "test-mock-api-key" not in res_str
    assert "AIzaSy" not in res_str


# =========================================================================
# TEST 9: Offline Capability Verification
# =========================================================================

def test_offline_execution_with_local_ollama(test_settings, test_incident, async_runner):
    """Verify that with local Ollama, investigation operates 100% offline with zero cloud egress."""
    service = InvestigationService(settings=test_settings)

    offline_llm_json = {
        "summary": "Local Ollama forensic assessment completed in air-gapped mode.",
        "observed_evidence": ["150 MB outbound from 192.0.2.10."],
        "possible_explanations": ["Local network backup."],
        "recommended_checks": ["Review local host syslog."],
        "uncertainties": ["Zero external telemetry accessed."],
    }

    mock_ollama = AsyncMock(spec=BaseGemmaProvider)
    mock_ollama.provider_id = "ollama"
    mock_ollama.model_name = "gemma2"
    mock_ollama.generate_investigation.return_value = json.dumps(offline_llm_json)

    with patch.object(service.factory, "get_provider", return_value=mock_ollama):
        # Even with Google Generative Language blocked / no internet:
        with patch("httpx.AsyncClient.post", side_effect=httpx.ConnectError("No internet route")):
            req = InvestigateRequest(provider="ollama", incident=test_incident)
            res = async_runner(service.investigate(req))

            assert res.provider == "ollama"
            assert res.model == "gemma2"
            assert "Local Ollama" in res.summary
