"""Tests for Gemma API and Ollama providers."""

import pytest
import httpx
from unittest.mock import AsyncMock, patch

from config import Settings
from providers.base import (
    ProviderNotConfiguredError,
    ProviderResponseError,
    ProviderUnavailableError,
)
from providers.factory import ProviderFactory
from providers.gemma_api import GemmaApiProvider
from providers.ollama import OllamaProvider


def test_provider_factory_valid_selection(test_settings):
    """Factory must return correct provider instances for 'gemma-api' and 'ollama'."""
    factory = ProviderFactory(test_settings)

    gemma_p = factory.get_provider("gemma-api")
    assert isinstance(gemma_p, GemmaApiProvider)
    assert gemma_p.provider_id == "gemma-api"

    ollama_p = factory.get_provider("ollama")
    assert isinstance(ollama_p, OllamaProvider)
    assert ollama_p.provider_id == "ollama"


def test_provider_factory_invalid_selection(test_settings):
    """Factory must raise ValueError when an unsupported provider is requested."""
    factory = ProviderFactory(test_settings)
    with pytest.raises(ValueError, match="Unsupported provider 'invalid-provider'"):
        factory.get_provider("invalid-provider")


def test_gemma_api_missing_key(async_runner):
    """GemmaApiProvider must raise ProviderNotConfiguredError if GEMMA_API_KEY is empty."""
    empty_settings = Settings(GEMMA_API_KEY="")
    provider = GemmaApiProvider(empty_settings)

    with pytest.raises(ProviderNotConfiguredError, match="GEMMA_API_KEY is not configured"):
        async_runner(provider.generate_investigation("Test prompt"))


def test_gemma_api_unavailable_connect_error(test_settings, async_runner):
    """Gemma API connection failure must raise ProviderUnavailableError."""
    provider = GemmaApiProvider(test_settings)

    with patch("httpx.AsyncClient.post", side_effect=httpx.ConnectError("Failed to resolve host")):
        with pytest.raises(ProviderUnavailableError, match="Network error connecting to Gemma API"):
            async_runner(provider.generate_investigation("Test prompt"))


def test_gemma_api_http_error(test_settings, async_runner):
    """Gemma API non-200 response must raise ProviderResponseError."""
    provider = GemmaApiProvider(test_settings)
    mock_resp = httpx.Response(status_code=403, text="Invalid API Key")

    with patch("httpx.AsyncClient.post", return_value=mock_resp):
        with pytest.raises(ProviderResponseError, match="authentication failed"):
            async_runner(provider.generate_investigation("Test prompt"))


def test_ollama_unavailable_connect_error(test_settings, async_runner):
    """Ollama connection failure must raise ProviderUnavailableError."""
    provider = OllamaProvider(test_settings)

    with patch("httpx.AsyncClient.post", side_effect=httpx.ConnectError("Connection refused")):
        with pytest.raises(ProviderUnavailableError, match="Cannot connect to Ollama service"):
            async_runner(provider.generate_investigation("Test prompt"))


def test_ollama_model_missing_404(test_settings, async_runner):
    """Ollama 404 response for missing model must raise ProviderResponseError with pull hint."""
    provider = OllamaProvider(test_settings)
    mock_resp = httpx.Response(status_code=404, text="model 'gemma2' not found")

    with patch("httpx.AsyncClient.post", return_value=mock_resp):
        with pytest.raises(ProviderResponseError, match="ollama pull"):
            async_runner(provider.generate_investigation("Test prompt"))


def test_provider_status_never_exposes_api_key(test_settings, async_runner):
    """Provider status reporting must never leak GEMMA_API_KEY."""
    provider = GemmaApiProvider(test_settings)
    mock_resp = httpx.Response(status_code=200, json={"name": "models/gemma-2-9b-it"})

    with patch("httpx.AsyncClient.get", return_value=mock_resp):
        status = async_runner(provider.check_status())
        status_dict = status.model_dump()

        # Check all string representations in status output
        status_str = str(status_dict)
        assert test_settings.GEMMA_API_KEY not in status_str
        assert "test-mock-api-key" not in status_str
        assert status.configured is True
        assert status.available is True
