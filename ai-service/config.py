"""Application configuration for NetSutra AI and Detection Service."""

from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Service settings loaded from environment variables and .env file."""

    # Server settings
    AI_SERVICE_HOST: str = "0.0.0.0"
    AI_SERVICE_PORT: int = 8000
    LOG_LEVEL: str = "INFO"

    # Gemma API provider settings
    GEMMA_API_KEY: str = ""
    GEMMA_API_MODEL: str = "gemini-3.5-flash"
    GEMMA_API_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta"
    GEMMA_API_TIMEOUT_SECONDS: float = 30.0

    # Ollama provider settings
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "gemma2"
    OLLAMA_TIMEOUT_SECONDS: float = 45.0

    # Detection & Correlation defaults
    MIN_BASELINE_EVENTS: int = 5
    HIGH_BASELINE_EVENTS: int = 20
    CORRELATION_WINDOW_SECONDS: float = 300.0
    VOLUME_ZSCORE_THRESHOLD: float = 3.0
    VOLUME_RATIO_THRESHOLD: float = 3.0
    FREQUENCY_BURST_THRESHOLD: float = 5.0
    FAILED_CONNECTION_RATIO_THRESHOLD: float = 0.5

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )


@lru_cache()
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()
