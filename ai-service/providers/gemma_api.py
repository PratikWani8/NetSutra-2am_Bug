"""Provider implementation for Gemma API (Google AI Studio / Generative Language)."""

import logging
import time
from typing import Optional
import httpx

from config import Settings
from providers.base import (
    BaseGemmaProvider,
    ProviderNotConfiguredError,
    ProviderResponseError,
    ProviderUnavailableError,
)
from schemas.providers import SingleProviderStatus

logger = logging.getLogger(__name__)


class GemmaApiProvider(BaseGemmaProvider):
    """Integrates with Gemma / Gemini models hosted via Google Generative Language API."""

    def __init__(self, settings: Settings):
        import os
        self.api_key = (
            settings.GEMMA_API_KEY
            or os.environ.get("GEMINI_API_KEY", "")
            or os.environ.get("GEMMA_API_KEY", "")
            or ""
        )
        self.model = (
            os.environ.get("GEMINI_API_MODEL")
            or os.environ.get("GEMMA_API_MODEL")
            or settings.GEMMA_API_MODEL
            or "gemini-3.5-flash"
        )

        self.base_url = (
            settings.GEMMA_API_BASE_URL
            or os.environ.get("GEMINI_API_BASE_URL")
            or "https://generativelanguage.googleapis.com/v1beta"
        ).rstrip("/")
        self.timeout = settings.GEMMA_API_TIMEOUT_SECONDS

    @property
    def provider_id(self) -> str:
        return "gemma-api"

    @property
    def model_name(self) -> str:
        return self.model

    def is_configured(self) -> bool:
        """Check if server-side API key is present."""
        return bool(self.api_key and self.api_key.strip())

    async def generate_investigation(self, prompt: str) -> str:
        """Execute inference against the Gemma API."""
        if not self.is_configured():
            logger.error("Gemma API provider called but GEMMA_API_KEY is not set.")
            raise ProviderNotConfiguredError(
                message="GEMMA_API_KEY is not configured on the server. Please set GEMMA_API_KEY in .env.",
                provider=self.provider_id,
            )

        models_to_try = [self.model]
        for fallback_m in ("gemini-3.5-flash-lite", "gemini-3.5-flash"):
            if fallback_m not in models_to_try:
                models_to_try.append(fallback_m)

        last_error = None

        for current_model in models_to_try:
            url = f"{self.base_url}/models/{current_model}:generateContent?key={self.api_key}"
            headers = {
                "Content-Type": "application/json",
                "x-goog-api-key": self.api_key,
            }
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": prompt}],
                    }
                ],
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 2048,
                    "responseMimeType": "application/json",
                },
            }

            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(url, json=payload, headers=headers)
            except httpx.ConnectError as exc:
                logger.error("Failed to connect to Gemma API endpoint.")
                raise ProviderUnavailableError(
                    message=f"Network error connecting to Gemma API: {str(exc)}",
                    provider=self.provider_id,
                ) from exc
            except httpx.TimeoutException as exc:
                logger.error("Timeout waiting for Gemma API response.")
                raise ProviderUnavailableError(
                    message=f"Request to Gemma API timed out after {self.timeout}s.",
                    provider=self.provider_id,
                ) from exc
            except Exception as exc:
                logger.error("Unexpected error contacting Gemma API: %s", str(exc))
                raise ProviderUnavailableError(
                    message=f"Failed to communicate with Gemma API: {str(exc)}",
                    provider=self.provider_id,
                ) from exc

            if response.status_code == 200:
                try:
                    data = response.json()
                    candidates = data.get("candidates", [])
                    if not candidates:
                        raise ProviderResponseError(
                            message="Gemma API returned an empty candidate list.",
                            provider=self.provider_id,
                        )

                    parts = candidates[0].get("content", {}).get("parts", [])
                    text_parts = [p.get("text", "") for p in parts if "text" in p]
                    combined = "\n".join(t for t in text_parts if t.strip())
                    if combined:
                        self.model = current_model
                        return combined
                except Exception as exc:
                    logger.warning("Failed to parse candidate text for %s: %s", current_model, exc)
            elif response.status_code in (404, 503):
                logger.warning("Model %s returned HTTP %s. Attempting alternate model.", current_model, response.status_code)
                err_detail = ""
                try:
                    err_detail = response.json().get("error", {}).get("message", "")
                except Exception:
                    pass
                last_error = ProviderResponseError(
                    message=f"Gemma API returned HTTP {response.status_code}: {err_detail}",
                    provider=self.provider_id
                )
                continue
            elif response.status_code in (401, 403):
                err_detail = ""
                try:
                    err_detail = response.json().get("error", {}).get("message", "")
                except Exception:
                    pass
                raise ProviderResponseError(
                    message=f"Gemma API authentication failed (HTTP {response.status_code}): {err_detail or 'Invalid API key'}. Verify GEMMA_API_KEY in ai-service/.env.",
                    provider=self.provider_id,
                )
            elif response.status_code == 400:
                err_detail = ""
                try:
                    err_detail = response.json().get("error", {}).get("message", "")
                except Exception:
                    pass
                raise ProviderResponseError(
                    message=f"Gemma API bad request (HTTP 400): {err_detail or 'Check model or API key'}.",
                    provider=self.provider_id,
                )
            elif response.status_code == 429:
                raise ProviderUnavailableError(
                    message="Gemma API rate limit exceeded (HTTP 429).",
                    provider=self.provider_id,
                )
            else:
                last_error = ProviderResponseError(
                    message=f"Gemma API returned error HTTP {response.status_code}: {response.text[:150]}.",
                    provider=self.provider_id,
                )

        if last_error:
            raise last_error

        raise ProviderResponseError(
            message="No response could be obtained from Gemma API models.",
            provider=self.provider_id,
        )

    async def check_status(self) -> SingleProviderStatus:
        """Verify API key configuration and test model endpoint."""
        if not self.is_configured():
            return SingleProviderStatus(
                configured=False,
                available=False,
                model=self.model,
                endpoint=self.base_url,
                message="GEMMA_API_KEY is not configured.",
                latency_ms=None,
            )

        # Lightweight check: GET model metadata without running expensive inference
        url = f"{self.base_url}/models/{self.model}"
        headers = {"x-goog-api-key": self.api_key}
        start_time = time.monotonic()

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(url, headers=headers)
                latency = round((time.monotonic() - start_time) * 1000.0, 2)

                if res.status_code == 200:
                    return SingleProviderStatus(
                        configured=True,
                        available=True,
                        model=self.model,
                        endpoint=self.base_url,
                        message=f"Gemma API is available (model: {self.model}).",
                        latency_ms=latency,
                    )
                # Try fallback model if configured model returned 404
                fallback_url = f"{self.base_url}/models/gemini-3.5-flash"
                res_fb = await client.get(fallback_url, headers=headers)
                if res_fb.status_code == 200:
                    self.model = "gemini-3.5-flash"
                    return SingleProviderStatus(
                        configured=True,
                        available=True,
                        model=self.model,
                        endpoint=self.base_url,
                        message=f"Gemma API is available (model: {self.model}).",
                        latency_ms=latency,
                    )
                return SingleProviderStatus(
                    configured=True,
                    available=False,
                    model=self.model,
                    endpoint=self.base_url,
                    message=f"Gemma API returned HTTP {res.status_code}.",
                    latency_ms=latency,
                )
        except Exception as exc:
            return SingleProviderStatus(
                configured=True,
                available=False,
                model=self.model,
                endpoint=self.base_url,
                message=f"Gemma API check failed: {type(exc).__name__}",
                latency_ms=None,
            )
