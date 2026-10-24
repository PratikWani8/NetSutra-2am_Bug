"""Correlation data models and request/response schemas."""

from datetime import datetime, timezone
import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from schemas.anomaly import Anomaly, Severity
from schemas.telemetry import NetworkEvent


class CorrelationParameters(BaseModel):
    """Configurable parameters for event correlation."""
    time_window_seconds: float = Field(
        300.0,
        description="Temporal clustering window in seconds (default 5 minutes)"
    )
    group_by_source: bool = Field(
        True,
        description="Correlate anomalies and events sharing the same source IP"
    )
    group_by_destination: bool = Field(
        True,
        description="Correlate anomalies sharing the same destination IP"
    )
    min_anomalies_per_incident: int = Field(
        1,
        description="Minimum number of anomalies required to form an incident"
    )


class CorrelateRequest(BaseModel):
    """Request payload for POST /correlate."""
    anomalies: List[Anomaly] = Field(
        ...,
        description="List of detected anomalies to correlate"
    )
    events: Optional[List[NetworkEvent]] = Field(
        default=None,
        description="Optional network events for additional evidence extraction"
    )
    parameters: Optional[CorrelationParameters] = Field(
        default_factory=CorrelationParameters,
        description="Correlation configuration parameters"
    )


class IncidentEvidenceItem(BaseModel):
    """Relevant evidence item included in an incident."""
    event_id: str
    source_ip: Optional[str] = None
    destination_ip: Optional[str] = None
    source_port: Optional[int] = None
    destination_port: Optional[int] = None
    protocol: Optional[str] = None
    service: Optional[str] = None
    outbound_bytes: Optional[int] = None
    inbound_bytes: Optional[int] = None
    conn_state: Optional[str] = None
    timestamp: Optional[datetime] = None
    extra: Dict[str, Any] = Field(default_factory=dict)


class Incident(BaseModel):
    """Correlated incident grouping related anomalies and supporting evidence."""
    incident_id: str = Field(
        default_factory=lambda: f"inc-{uuid.uuid4().hex[:12]}",
        description="Unique incident identifier"
    )
    title: str = Field(..., description="Short descriptive title of the incident")
    anomaly_ids: List[str] = Field(
        ...,
        description="List of correlated anomaly IDs"
    )
    evidence_event_ids: List[str] = Field(
        ...,
        description="List of supporting event IDs"
    )
    correlation_reasons: List[str] = Field(
        ...,
        description="Specific transparent reasons why these anomalies were correlated"
    )
    first_observed: datetime = Field(
        ...,
        description="Earliest timestamp in the correlation cluster"
    )
    last_observed: datetime = Field(
        ...,
        description="Latest timestamp in the correlation cluster"
    )
    severity: Severity = Field(
        ...,
        description="Aggregate incident severity"
    )
    summary: str = Field(
        ...,
        description="Concise factual summary of the incident"
    )
    primary_source_ip: Optional[str] = Field(
        None,
        description="Primary originating IP address involved in incident"
    )
    primary_destination_ip: Optional[str] = Field(
        None,
        description="Primary target IP address involved in incident"
    )
    evidence: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Selected structured evidence items ready for investigation"
    )


class CorrelateResponse(BaseModel):
    """Response payload from POST /correlate."""
    incidents: List[Incident] = Field(
        default_factory=list,
        description="List of identified correlation groups/incidents"
    )
    total_anomalies_correlated: int = Field(
        ...,
        description="Count of input anomalies successfully assigned to incidents"
    )
    incident_count: int = Field(
        ...,
        description="Total number of incidents created"
    )
