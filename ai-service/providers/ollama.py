"""Provider implementation for locally hosted Ollama running a Gemma model."""

import logging
import time
from typing import Optional
import httpx

from config import Settings
from providers.base import (
    BaseGemmaProvider,
    ProviderResponseError,
    ProviderUnavailableError,
)
from schemas.providers import SingleProviderStatus

logger = logging.getLogger(__name__)


class OllamaProvider(BaseGemmaProvider):
    """Integrates with a locally running Ollama instance hosting a Gemma model."""

    def __init__(self, settings: Settings):
        self.base_url = (settings.OLLAMA_BASE_URL or "http://localhost:11434").rstrip("/")
        self.model = settings.OLLAMA_MODEL or "gemma2"
        self.timeout = settings.OLLAMA_TIMEOUT_SECONDS

    @property
    def provider_id(self) -> str:
        return "ollama"

    @property
    def model_name(self) -> str:
        return self.model

    async def generate_investigation(self, prompt: str) -> str:
        """Call Ollama /api/generate with JSON formatting enabled."""
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0.2,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload)
        except httpx.ConnectError as exc:
            logger.error("Connection failed to Ollama at %s", self.base_url)
            raise ProviderUnavailableError(
                message=f"Cannot connect to Ollama service at {self.base_url}. Ensure the Ollama daemon is running.",
                provider=self.provider_id,
            ) from exc
        except httpx.TimeoutException as exc:
            logger.error("Timeout communicating with Ollama service (%ss).", self.timeout)
            raise ProviderUnavailableError(
                message=f"Ollama request timed out after {self.timeout}s while generating response.",
                provider=self.provider_id,
            ) from exc
        except Exception as exc:
            logger.error("Error communicating with Ollama: %s", str(exc))
            raise ProviderUnavailableError(
                message=f"Error contacting Ollama: {str(exc)}",
                provider=self.provider_id,
            ) from exc

        if response.status_code == 404:
            raise ProviderResponseError(
                message=f"Model '{self.model}' not found in Ollama. Run 'ollama pull {self.model}' to download it.",
                provider=self.provider_id,
            )
        elif response.status_code != 200:
            raise ProviderResponseError(
                message=f"Ollama returned HTTP error {response.status_code}: {response.text[:200]}",
                provider=self.provider_id,
            )

        try:
            data = response.json()
            raw_text = data.get("response")
            if raw_text is None:
                raise ProviderResponseError(
                    message="Ollama returned a response object without 'response' text.",
                    provider=self.provider_id,
                )
            return raw_text
        except (ValueError, KeyError) as exc:
            logger.error("Failed to parse Ollama JSON response.")
            raise ProviderResponseError(
                message="Malformed JSON response from Ollama.",
                provider=self.provider_id,
            ) from exc

    async def check_status(self) -> SingleProviderStatus:
        """Check if Ollama service is reachable and verify if the configured model exists."""
        url = f"{self.base_url}/api/tags"
        start_time = time.monotonic()

        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(url)
                latency = round((time.monotonic() - start_time) * 1000.0, 2)

                if res.status_code == 200:
                    data = res.json()
                    models = [m.get("name", "") for m in data.get("models", [])]
                    # Check matching model name with or without :latest
                    has_model = any(
                        self.model == m or m.startswith(f"{self.model}:") or self.model in m
                        for m in models
                    )

                    if has_model:
                        return SingleProviderStatus(
                            configured=True,
                            available=True,
                            model=self.model,
                            endpoint=self.base_url,
                            message=f"Ollama is running and model '{self.model}' is available.",
                            latency_ms=latency,
                        )
                    else:
                        return SingleProviderStatus(
                            configured=True,
                            available=False,
                            model=self.model,
                            endpoint=self.base_url,
                            message=f"Ollama is running, but model '{self.model}' is not installed. Run 'ollama pull {self.model}'.",
                            latency_ms=latency,
                        )
                else:
                    return SingleProviderStatus(
                        configured=True,
                        available=False,
                        model=self.model,
                        endpoint=self.base_url,
                        message=f"Ollama returned HTTP {res.status_code}.",
                        latency_ms=latency,
                    )
        except httpx.ConnectError:
            return SingleProviderStatus(
                configured=True,
                available=False,
                model=self.model,
                endpoint=self.base_url,
                message=f"Connection refused to Ollama endpoint at {self.base_url}.",
                latency_ms=None,
            )
        except Exception as exc:
            return SingleProviderStatus(
                configured=True,
                available=False,
                model=self.model,
                endpoint=self.base_url,
                message=f"Ollama health check failed: {type(exc).__name__}",
                latency_ms=None,
            )
