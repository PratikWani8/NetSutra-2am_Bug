"""Provider schemas for /providers and /providers/status."""

from datetime import datetime, timezone
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class ProviderDetails(BaseModel):
    """Detailed provider capabilities."""
    id: str
    name: str
    description: str
    configured_model: str
    is_local: bool


class ProvidersListResponse(BaseModel):
    """Response payload for GET /providers."""
    providers: List[str] = Field(
        ...,
        description="Supported provider identifiers"
    )
    details: Optional[List[ProviderDetails]] = Field(
        None,
        description="Metadata on supported providers"
    )


class SingleProviderStatus(BaseModel):
    """Status details for a specific provider without exposing secrets."""
    configured: bool = Field(
        ...,
        description="Whether the provider is configured with necessary credentials/endpoints"
    )
    available: bool = Field(
        ...,
        description="Whether the provider is actively responding and healthy"
    )
    model: Optional[str] = Field(
        None,
        description="Configured model identifier"
    )
    endpoint: Optional[str] = Field(
        None,
        description="Base URL or service endpoint (API keys are never exposed)"
    )
    message: str = Field(
        ...,
        description="Human-readable status summary or diagnostic message"
    )
    latency_ms: Optional[float] = Field(
        None,
        description="Round-trip health check latency in milliseconds if tested"
    )


class ProvidersStatusResponse(BaseModel):
    """Response payload for GET /providers/status."""
    providers: Dict[str, SingleProviderStatus] = Field(
        ...,
        description="Health and availability status keyed by provider identifier"
    )
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of status evaluation"
    )
