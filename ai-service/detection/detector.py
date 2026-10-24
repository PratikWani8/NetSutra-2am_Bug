"""Detection service coordinating baseline profiles and anomaly rule execution."""

from typing import List, Optional
from config import Settings, get_settings
from schemas.anomaly import (
    Anomaly,
    BaselineConfidence,
    DetectionParameters,
    DetectionRequest,
    DetectionResponse,
)
from detection.baseline import BaselineManager
from detection.rules import (
    BaseRuleDetector,
    ConnectionFrequencyBurstDetector,
    FailedConnectionPatternDetector,
    OutboundVolumeDeviationDetector,
    RareDestinationDetector,
)

from detection.multilog_rules import MultiLogBehaviorDetector

class AnomalyDetectorService:
    """Service responsible for behavioral and statistical network anomaly detection."""

    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()
        self.baseline_manager = BaselineManager(
            min_samples=self.settings.MIN_BASELINE_EVENTS,
            high_samples=self.settings.HIGH_BASELINE_EVENTS,
        )
        self.rules: List[BaseRuleDetector] = [
            OutboundVolumeDeviationDetector(),
            RareDestinationDetector(),
            ConnectionFrequencyBurstDetector(),
            FailedConnectionPatternDetector(),
            MultiLogBehaviorDetector(),
        ]

    def detect(self, request: DetectionRequest) -> DetectionResponse:
        """Execute detection pipeline on the provided event batch."""
        params = request.parameters or DetectionParameters()
        min_score = params.min_score if params.min_score is not None else 0.35

        # 1. Update baseline if historical events are provided in request
        baseline_count = 0
        if request.baseline_events:
            self.baseline_manager.build_profiles(request.baseline_events)
            baseline_count = len(request.baseline_events)

        # 2. Evaluate overall baseline confidence
        if baseline_count == 0 and not self.baseline_manager._profiles:
            overall_confidence = BaselineConfidence.LOW
        else:
            overall_confidence = self.baseline_manager.evaluate_confidence(baseline_count)

        # 3. Execute all detection rules
        detected_anomalies: List[Anomaly] = []
        for rule in self.rules:
            rule_anomalies = rule.evaluate(
                events=request.events,
                baseline_manager=self.baseline_manager,
                params=params,
                settings=self.settings,
            )
            detected_anomalies.extend(rule_anomalies)

        # 4. Filter by minimum score
        filtered_anomalies = [a for a in detected_anomalies if a.score >= min_score]

        # Sort anomalies by score descending
        filtered_anomalies.sort(key=lambda a: a.score, reverse=True)

        return DetectionResponse(
            anomalies=filtered_anomalies,
            total_events_analyzed=len(request.events),
            anomalies_detected=len(filtered_anomalies),
            baseline_events_used=baseline_count,
            baseline_confidence=overall_confidence,
        )
