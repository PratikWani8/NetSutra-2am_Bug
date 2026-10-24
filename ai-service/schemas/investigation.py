"""Investigation request and response schemas for Gemma-powered analysis."""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class SupportedProvider(str, Enum):
    """Supported LLM providers for investigation."""
    GEMMA_API = "gemma-api"
    OLLAMA = "ollama"


class IncidentContext(BaseModel):
    """Normalized incident payload provided for Gemma investigation."""
    incident_id: str = Field(..., description="Unique incident identifier")
    anomaly_ids: List[str] = Field(default_factory=list, description="IDs of correlated anomalies")
    evidence: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Selected relevant evidence events (do not pass entire raw logs)"
    )
    summary: str = Field(..., description="Factual summary of the incident")
    title: Optional[str] = Field(None, description="Optional incident title")
    severity: Optional[str] = Field(None, description="Optional incident severity")


class InvestigateRequest(BaseModel):
    """Request payload for POST /investigate."""
    provider: Literal["gemma-api", "ollama"] = Field(
        ...,
        description="Target investigation provider ('gemma-api' or 'ollama')"
    )
    incident: IncidentContext = Field(
        ...,
        description="Incident context and selected evidence to investigate"
    )


class InvestigationAnalysis(BaseModel):
    """Structured output expected from Gemma investigation."""
    summary: str = Field(
        ...,
        description="A concise explanation of the observed behavior"
    )
    observed_evidence: List[str] = Field(
        default_factory=list,
        description="Factual evidence directly observed in telemetry"
    )
    possible_explanations: List[str] = Field(
        default_factory=list,
        description="Plausible benign and suspicious explanations"
    )
    recommended_checks: List[str] = Field(
        default_factory=list,
        description="Concrete investigation steps an analyst can perform"
    )
    uncertainties: List[str] = Field(
        default_factory=list,
        description="Missing evidence or telemetry limitations"
    )


class InvestigateResponse(BaseModel):
    """Response payload from POST /investigate matching required schema."""
    incident_id: str = Field(..., description="Investigated incident ID")
    provider: str = Field(..., description="Selected provider used ('gemma-api' or 'ollama')")
    model: str = Field(..., description="Model identifier used for generation")
    summary: str = Field(..., description="A concise explanation of the observed behavior")
    observed_evidence: List[str] = Field(
        default_factory=list,
        description="Factual evidence observed in telemetry"
    )
    possible_explanations: List[str] = Field(
        default_factory=list,
        description="Plausible benign and suspicious explanations"
    )
    recommended_checks: List[str] = Field(
        default_factory=list,
        description="Concrete investigation steps for an analyst"
    )
    uncertainties: List[str] = Field(
        default_factory=list,
        description="Uncertainties and missing evidence"
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Investigation completion timestamp"
    )
