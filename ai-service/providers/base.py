"""Base interface and error types for Gemma LLM providers."""

from abc import ABC, abstractmethod
from typing import Optional
from schemas.providers import SingleProviderStatus


class ProviderError(Exception):
    """Base exception for provider communication errors."""
    def __init__(self, message: str, provider: str, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.provider = provider
        self.status_code = status_code


class ProviderNotConfiguredError(ProviderError):
    """Raised when the selected provider lacks necessary configuration (e.g. missing API key)."""
    def __init__(self, message: str, provider: str):
        super().__init__(message=message, provider=provider, status_code=503)


class ProviderUnavailableError(ProviderError):
    """Raised when the provider endpoint cannot be reached or is down."""
    def __init__(self, message: str, provider: str):
        super().__init__(message=message, provider=provider, status_code=503)


class ProviderResponseError(ProviderError):
    """Raised when the provider returns an unexpected or invalid response."""
    def __init__(self, message: str, provider: str):
        super().__init__(message=message, provider=provider, status_code=502)


class BaseGemmaProvider(ABC):
    """Abstract interface for Gemma inference providers."""

    @property
    @abstractmethod
    def provider_id(self) -> str:
        """Identifier matching InvestigateRequest.provider (e.g. 'gemma-api' or 'ollama')."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Name of the model currently configured."""
        pass

    @abstractmethod
    async def generate_investigation(self, prompt: str) -> str:
        """Send prompt to the model and return raw generated response string."""
        pass

    @abstractmethod
    async def check_status(self) -> SingleProviderStatus:
        """Check provider health and return status without exposing sensitive credentials."""
        pass
