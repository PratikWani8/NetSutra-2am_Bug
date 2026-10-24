"""Anomaly data models and detection request/response schemas."""

from datetime import datetime, timezone
from enum import Enum
import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from schemas.telemetry import NetworkEvent


class Severity(str, Enum):
    """Anomaly severity classification."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class BaselineConfidence(str, Enum):
    """Confidence level of baseline profile used during detection."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Anomaly(BaseModel):
    """Detected behavioral or statistical network anomaly."""
    anomaly_id: str = Field(
        default_factory=lambda: f"anom-{uuid.uuid4().hex[:12]}",
        description="Unique anomaly identifier"
    )
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Detection or event timestamp"
    )
    score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Calculated anomaly score between 0.0 and 1.0"
    )
    severity: Severity = Field(
        ...,
        description="Severity classification (low, medium, high, critical)"
    )
    method: str = Field(
        ...,
        description="Detection method or algorithm applied"
    )
    reasons: List[str] = Field(
        ...,
        description="Human-readable explanations for the anomaly"
    )
    features: Dict[str, Any] = Field(
        ...,
        description="Measured features and baseline comparisons"
    )
    evidence_event_ids: List[str] = Field(
        ...,
        description="Supporting event IDs associated with this anomaly"
    )
    baseline_confidence: BaselineConfidence = Field(
        ...,
        description="Confidence of baseline data available for comparison"
    )


class DetectionParameters(BaseModel):
    """Configurable parameters for anomaly detection algorithms."""
    min_baseline_events: Optional[int] = Field(
        None,
        description="Minimum number of baseline events required for medium/high confidence"
    )
    volume_zscore_threshold: Optional[float] = Field(
        None,
        description="Z-score threshold for outbound volume deviation (e.g. 3.0)"
    )
    volume_ratio_threshold: Optional[float] = Field(
        None,
        description="Ratio threshold for outbound volume relative to baseline (e.g. 3.0)"
    )
    frequency_burst_threshold: Optional[float] = Field(
        None,
        description="Rate multiplier threshold for connection bursts (e.g. 5.0)"
    )
    failed_connection_ratio_threshold: Optional[float] = Field(
        None,
        description="Failure ratio threshold for connection failure detection (e.g. 0.5)"
    )
    window_seconds: Optional[float] = Field(
        None,
        description="Time window duration in seconds for rolling calculations"
    )
    min_score: Optional[float] = Field(
        0.35,
        description="Minimum score threshold to include in response"
    )


class DetectionRequest(BaseModel):
    """Request payload for POST /detect."""
    events: List[NetworkEvent] = Field(
        ...,
        description="Batch of incoming network events/telemetry to analyze"
    )
    baseline_events: Optional[List[NetworkEvent]] = Field(
        None,
        description="Optional historical baseline events for profiling normal behavior"
    )
    parameters: Optional[DetectionParameters] = Field(
        None,
        description="Optional algorithmic thresholds and parameters"
    )


class DetectionResponse(BaseModel):
    """Response payload from POST /detect."""
    anomalies: List[Anomaly] = Field(
        default_factory=list,
        description="List of detected anomalies"
    )
    total_events_analyzed: int = Field(
        ...,
        description="Total number of events analyzed in current batch"
    )
    anomalies_detected: int = Field(
        ...,
        description="Count of anomalies detected"
    )
    baseline_events_used: int = Field(
        0,
        description="Number of baseline events used for comparison"
    )
    baseline_confidence: BaselineConfidence = Field(
        ...,
        description="Overall baseline confidence level"
    )
