"""Main entry point for NetSutra AI and Detection Service."""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from api.routes import router
from config import get_settings

# Configure logging
settings = get_settings()
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("netsutra")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager."""
    logger.info("Initializing NetSutra AI and Detection Service...")
    logger.info("Gemma API model: %s", settings.GEMMA_API_MODEL)
    logger.info("Ollama endpoint: %s (model: %s)", settings.OLLAMA_BASE_URL, settings.OLLAMA_MODEL)
    yield
    logger.info("Shutting down NetSutra AI and Detection Service.")


app = FastAPI(
    title="NetSutra AI and Detection Service",
    description=(
        "Open-source network anomaly detection and investigation service. "
        "Performs behavioral anomaly detection, incident correlation, "
        "and grounded AI-assisted incident explanations using Gemma."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware for integration with Node.js backend and frontend dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount endpoints
app.include_router(router)


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.AI_SERVICE_HOST,
        port=settings.AI_SERVICE_PORT,
        reload=False,
    )
