"""End-to-end API route tests for NetSutra AI and Detection Service."""

import json
from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

from main import app
from providers.base import ProviderUnavailableError
from schemas.providers import SingleProviderStatus


def test_health_endpoint(client: TestClient):
    """GET /health must return 200 OK and service details."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "NetSutra" in data["service"]
    assert "version" in data


def test_detect_endpoint(client: TestClient):
    """POST /detect must accept telemetry batch and return structured DetectionResponse."""
    payload = {
        "events": [
            {
                "event_id": "api-ev-001",
                "source_ip": "10.0.0.5",
                "destination_ip": "198.51.100.1",
                "outbound_bytes": 1000,
                "conn_state": "SF",
            }
        ],
        "baseline_events": [],
    }
    response = client.post("/detect", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_events_analyzed"] == 1
    assert "anomalies" in data
    assert "baseline_confidence" in data


def test_correlate_endpoint(client: TestClient):
    """POST /correlate must group anomalies into incidents."""
    payload = {
        "anomalies": [
            {
                "anomaly_id": "anom-01",
                "timestamp": "2026-10-24T12:00:00Z",
                "score": 0.85,
                "severity": "high",
                "method": "outbound_volume_deviation",
                "reasons": ["Exceeded volume"],
                "features": {"source_ip": "192.0.2.10"},
                "evidence_event_ids": ["ev-1"],
                "baseline_confidence": "high",
            },
            {
                "anomaly_id": "anom-02",
                "timestamp": "2026-10-24T12:01:00Z",
                "score": 0.70,
                "severity": "medium",
                "method": "rare_destination",
                "reasons": ["Rare target"],
                "features": {"source_ip": "192.0.2.10"},
                "evidence_event_ids": ["ev-2"],
                "baseline_confidence": "high",
            },
        ],
        "parameters": {
            "time_window_seconds": 300.0,
        },
    }
    response = client.post("/correlate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["incident_count"] == 1
    inc = data["incidents"][0]
    assert inc["primary_source_ip"] == "192.0.2.10"
    assert len(inc["anomaly_ids"]) == 2


def test_get_providers_endpoint(client: TestClient):
    """GET /providers returns list of supported providers."""
    response = client.get("/providers")
    assert response.status_code == 200
    data = response.json()
    assert "gemma-api" in data["providers"]
    assert "ollama" in data["providers"]


def test_get_providers_status_endpoint(client: TestClient):
    """GET /providers/status reports health without exposing secrets."""
    mock_status = SingleProviderStatus(
        configured=True,
        available=True,
        model="gemma-2-9b-it",
        message="Available",
    )
    with patch("providers.gemma_api.GemmaApiProvider.check_status", new_callable=AsyncMock) as m_gemma, \
         patch("providers.ollama.OllamaProvider.check_status", new_callable=AsyncMock) as m_ollama:
        m_gemma.return_value = mock_status
        m_ollama.return_value = SingleProviderStatus(
            configured=True,
            available=False,
            model="gemma2",
            message="Connection refused",
        )

        response = client.get("/providers/status")
        assert response.status_code == 200
        data = response.json()
        assert "gemma-api" in data["providers"]
        assert "ollama" in data["providers"]
        assert data["providers"]["gemma-api"]["available"] is True
        assert data["providers"]["ollama"]["available"] is False


def test_investigate_valid_provider(client: TestClient):
    """POST /investigate with valid provider returns structured analysis."""
    payload = {
        "provider": "gemma-api",
        "incident": {
            "incident_id": "inc-example-001",
            "anomaly_ids": ["anom-example-001"],
            "evidence": [
                {
                    "event_id": "event-example-001",
                    "source_ip": "192.0.2.10",
                    "destination_ip": "198.51.100.20",
                    "outbound_bytes": 12000000,
                }
            ],
            "summary": "Unusual outbound traffic was detected.",
        },
    }

    mock_json_reply = json.dumps({
        "summary": "High volume outbound transfer observed to external target.",
        "observed_evidence": ["12 MB transmitted"],
        "possible_explanations": ["Backup sync", "Data exfiltration attempt"],
        "recommended_checks": ["Check process logs", "Verify destination ownership"],
        "uncertainties": ["No payload inspection"],
    })

    with patch("providers.gemma_api.GemmaApiProvider.generate_investigation", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = mock_json_reply
        response = client.post("/investigate", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["incident_id"] == "inc-example-001"
        assert data["provider"] == "gemma-api"
        assert len(data["possible_explanations"]) == 2


def test_investigate_invalid_provider_rejected(client: TestClient):
    """POST /investigate with an invalid provider name must return 422 validation error."""
    payload = {
        "provider": "unsupported-provider",
        "incident": {
            "incident_id": "inc-001",
            "summary": "Test incident",
            "evidence": [],
        },
    }
    response = client.post("/investigate", json=payload)
    assert response.status_code == 422


def test_investigate_provider_failure_returns_structured_error(client: TestClient):
    """When the selected provider fails, return structured 503 error without auto-fallback."""
    payload = {
        "provider": "ollama",
        "incident": {
            "incident_id": "inc-001",
            "summary": "Test incident",
            "evidence": [],
        },
    }

    with patch(
        "providers.ollama.OllamaProvider.generate_investigation",
        side_effect=ProviderUnavailableError(
            message="Ollama connection refused at http://localhost:11434",
            provider="ollama",
        ),
    ):
        response = client.post("/investigate", json=payload)
        assert response.status_code == 503
        data = response.json()
        assert data["provider"] == "ollama"
        assert data["error_type"] == "PROVIDER_UNAVAILABLE"
        assert "Ollama connection refused" in data["detail"]


def test_ai_service_failure_detection_remains_operational(client: TestClient):
    """Crucial requirement: Detection and correlation must remain fully operational when AI providers fail."""
    # Even if Gemma API and Ollama are completely broken or failing:
    with patch(
        "providers.gemma_api.GemmaApiProvider.generate_investigation",
        side_effect=ProviderUnavailableError("Gemma API down", provider="gemma-api")
    ):
        # 1. Detection works
        detect_payload = {
            "events": [
                {
                    "event_id": "ev-survive-01",
                    "source_ip": "10.0.0.1",
                    "destination_ip": "10.0.0.2",
                    "outbound_bytes": 500,
                }
            ],
            "baseline_events": [],
        }
        detect_res = client.post("/detect", json=detect_payload)
        assert detect_res.status_code == 200
        assert detect_res.json()["total_events_analyzed"] == 1

        # 2. Correlation works
        corr_payload = {
            "anomalies": [
                {
                    "anomaly_id": "anom-survive-01",
                    "timestamp": "2026-10-24T12:00:00Z",
                    "score": 0.8,
                    "severity": "high",
                    "method": "outbound_volume_deviation",
                    "reasons": ["High volume"],
                    "features": {"source_ip": "10.0.0.1"},
                    "evidence_event_ids": ["ev-survive-01"],
                    "baseline_confidence": "low",
                }
            ]
        }
        corr_res = client.post("/correlate", json=corr_payload)
        assert corr_res.status_code == 200
        assert corr_res.json()["incident_count"] == 1

        # 3. Investigation fails gracefully with structured error
        inv_payload = {
            "provider": "gemma-api",
            "incident": {
                "incident_id": "inc-survive-01",
                "summary": "Test",
                "evidence": [],
            },
        }
        inv_res = client.post("/investigate", json=inv_payload)
        assert inv_res.status_code == 503
        assert inv_res.json()["error_type"] == "PROVIDER_UNAVAILABLE"
