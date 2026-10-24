"""Factory for creating and resolving Gemma providers."""

from typing import Dict, List, Optional
from config import Settings, get_settings
from providers.base import BaseGemmaProvider
from providers.gemma_api import GemmaApiProvider
from providers.ollama import OllamaProvider


class ProviderFactory:
    """Instantiates and registers supported Gemma LLM providers."""

    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()
        self._providers: Dict[str, BaseGemmaProvider] = {
            "gemma-api": GemmaApiProvider(self.settings),
            "ollama": OllamaProvider(self.settings),
        }

    def get_provider(self, provider_id: str) -> BaseGemmaProvider:
        """Retrieve the provider instance for the given identifier."""
        if provider_id not in self._providers:
            supported = ", ".join(self._providers.keys())
            raise ValueError(
                f"Unsupported provider '{provider_id}'. Valid providers are: {supported}"
            )
        return self._providers[provider_id]

    def list_supported_providers(self) -> List[str]:
        """Return list of supported provider IDs."""
        return list(self._providers.keys())

    def get_all_providers(self) -> Dict[str, BaseGemmaProvider]:
        """Return dictionary of all registered providers."""
        return self._providers
