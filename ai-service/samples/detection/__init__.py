"""Detection module exporting AnomalyDetectorService and components."""

from detection.baseline import BaselineManager, SourceBaseline
from detection.detector import AnomalyDetectorService
from detection.rules import (
    BaseRuleDetector,
    ConnectionFrequencyBurstDetector,
    FailedConnectionPatternDetector,
    OutboundVolumeDeviationDetector,
    RareDestinationDetector,
    calculate_severity,
)

__all__ = [
    "AnomalyDetectorService",
    "BaselineManager",
    "SourceBaseline",
    "BaseRuleDetector",
    "OutboundVolumeDeviationDetector",
    "RareDestinationDetector",
    "ConnectionFrequencyBurstDetector",
    "FailedConnectionPatternDetector",
    "calculate_severity",
]
