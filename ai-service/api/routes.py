"""FastAPI routes for NetSutra AI and Detection Service."""

from datetime import datetime, timezone
import logging
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from config import Settings, get_settings
from correlation.correlator import EventCorrelator
from detection.detector import AnomalyDetectorService
from investigation.service import InvestigationService
from providers.base import (
    ProviderError,
    ProviderNotConfiguredError,
    ProviderResponseError,
    ProviderUnavailableError,
)
from providers.factory import ProviderFactory
from schemas.anomaly import DetectionRequest, DetectionResponse
from schemas.correlation import CorrelateRequest, CorrelateResponse
from schemas.investigation import InvestigateRequest, InvestigateResponse
from schemas.providers import (
    ProviderDetails,
    ProvidersListResponse,
    ProvidersStatusResponse,
    SingleProviderStatus,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Dependency singletons
_detector = None
_correlator = None
_provider_factory = None
_investigation_service = None


async def get_settings_dep() -> Settings:
    return get_settings()


async def get_detector(settings: Settings = Depends(get_settings_dep)) -> AnomalyDetectorService:
    global _detector
    if _detector is None:
        cfg = settings if isinstance(settings, Settings) else get_settings()
        _detector = AnomalyDetectorService(cfg)
    return _detector


async def get_correlator(settings: Settings = Depends(get_settings_dep)) -> EventCorrelator:
    global _correlator
    if _correlator is None:
        cfg = settings if isinstance(settings, Settings) else get_settings()
        _correlator = EventCorrelator(cfg)
    return _correlator


async def get_factory(settings: Settings = Depends(get_settings_dep)) -> ProviderFactory:
    global _provider_factory
    if _provider_factory is None:
        cfg = settings if isinstance(settings, Settings) else get_settings()
        _provider_factory = ProviderFactory(cfg)
    return _provider_factory


async def get_investigation_service(
    factory: ProviderFactory = Depends(get_factory),
    settings: Settings = Depends(get_settings_dep),
) -> InvestigationService:
    global _investigation_service
    if _investigation_service is None:
        f = factory if isinstance(factory, ProviderFactory) else get_factory()
        s = settings if isinstance(settings, Settings) else get_settings()
        _investigation_service = InvestigationService(f, s)
    return _investigation_service


@router.get("/health", tags=["System"])
async def health_check() -> Dict[str, Any]:
    """Service health check endpoint."""
    return {
        "status": "healthy",
        "service": "NetSutra AI and Detection Service",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/detect", response_model=DetectionResponse, tags=["Detection"])
async def detect_anomalies(
    request: DetectionRequest,
    detector: AnomalyDetectorService = Depends(get_detector),
) -> DetectionResponse:
    """Detect behavioral and statistical network anomalies from telemetry."""
    try:
        return detector.detect(request)
    except Exception as exc:
        logger.exception("Error during anomaly detection: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Detection engine encountered an error: {str(exc)}",
        )


@router.post("/correlate", response_model=CorrelateResponse, tags=["Correlation"])
async def correlate_events(
    request: CorrelateRequest,
    correlator: EventCorrelator = Depends(get_correlator),
) -> CorrelateResponse:
    """Correlate detected anomalies and events into cohesive security incidents."""
    try:
        return correlator.correlate(request)
    except Exception as exc:
        logger.exception("Error during event correlation: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Correlation engine encountered an error: {str(exc)}",
        )


@router.post("/investigate", response_model=InvestigateResponse, tags=["Investigation"])
async def investigate_incident(
    request: InvestigateRequest,
    service: InvestigationService = Depends(get_investigation_service),
) -> InvestigateResponse:
    """Analyze a security incident with the manually selected Gemma provider."""
    try:
        return await service.investigate(request)
    except ProviderNotConfiguredError as exc:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "detail": exc.message,
                "provider": exc.provider,
                "error_type": "PROVIDER_NOT_CONFIGURED",
            },
        )
    except ProviderUnavailableError as exc:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "detail": exc.message,
                "provider": exc.provider,
                "error_type": "PROVIDER_UNAVAILABLE",
            },
        )
    except ProviderResponseError as exc:
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={
                "detail": exc.message,
                "provider": exc.provider,
                "error_type": "PROVIDER_RESPONSE_ERROR",
            },
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:
        logger.exception("Unexpected error in investigation endpoint: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Investigation failed: {str(exc)}",
        )


@router.get("/providers", response_model=ProvidersListResponse, tags=["Providers"])
async def list_providers(
    factory: ProviderFactory = Depends(get_factory),
    settings: Settings = Depends(get_settings_dep),
) -> ProvidersListResponse:
    """Return supported investigation provider identifiers."""
    supported = factory.list_supported_providers()
    details = [
        ProviderDetails(
            id="gemma-api",
            name="Google Gemma API",
            description="Hosted Gemma model via Google AI Studio Generative Language API",
            configured_model=settings.GEMMA_API_MODEL,
            is_local=False,
        ),
        ProviderDetails(
            id="ollama",
            name="Local Ollama",
            description="Locally downloaded Gemma model served by Ollama daemon",
            configured_model=settings.OLLAMA_MODEL,
            is_local=True,
        ),
    ]
    return ProvidersListResponse(providers=supported, details=details)


@router.get("/providers/status", response_model=ProvidersStatusResponse, tags=["Providers"])
async def get_providers_status(
    factory: ProviderFactory = Depends(get_factory),
) -> ProvidersStatusResponse:
    """Check configured providers and report availability without exposing secrets."""
    statuses: Dict[str, SingleProviderStatus] = {}
    for provider_id, provider in factory.get_all_providers().items():
        try:
            status_res = await provider.check_status()
            statuses[provider_id] = status_res
        except Exception as exc:
            statuses[provider_id] = SingleProviderStatus(
                configured=False,
                available=False,
                model=provider.model_name,
                message=f"Status check failed: {type(exc).__name__}",
            )

    return ProvidersStatusResponse(
        providers=statuses,
        timestamp=datetime.now(timezone.utc),
    )
