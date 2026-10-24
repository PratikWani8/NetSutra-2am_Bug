"""Shared pytest fixtures and sandboxed ASGI test harness for NetSutra."""

import asyncio
from datetime import datetime, timezone, timedelta
import socket
import sys
from typing import Any, Callable, Coroutine
import httpx
import pytest

# On Windows in sandboxed environments, socket.socketpair hangs due to loopback TCP restrictions.
# Patching with UDP socket pair enables WindowsSelectorEventLoop without network dependency.
if sys.platform == "win32":
    socket.socketpair = lambda *a, **kw: (
        socket.socket(socket.AF_INET, socket.SOCK_DGRAM),
        socket.socket(socket.AF_INET, socket.SOCK_DGRAM),
    )
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from config import Settings
from main import app
from schemas.telemetry import NetworkEvent
from schemas.anomaly import BaselineConfidence, Severity


class SandboxedASGIClient:
    """Synchronous test client executing against FastAPI using ASGITransport without thread hangs."""

    def __init__(self, app_instance):
        self.app = app_instance
        self.loop = asyncio.SelectorEventLoop()
        asyncio.set_event_loop(self.loop)

    def get(self, path: str, **kwargs) -> httpx.Response:
        async def _run():
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=self.app),
                base_url="http://127.0.0.1:8000",
            ) as client:
                return await client.get(path, **kwargs)
        return self.loop.run_until_complete(_run())

    def post(self, path: str, **kwargs) -> httpx.Response:
        async def _run():
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=self.app),
                base_url="http://127.0.0.1:8000",
            ) as client:
                return await client.post(path, **kwargs)
        return self.loop.run_until_complete(_run())

    def close(self):
        if not self.loop.is_closed():
            self.loop.close()


@pytest.fixture
def client():
    """FastAPI TestClient fixture."""
    cli = SandboxedASGIClient(app)
    yield cli
    cli.close()


@pytest.fixture
def async_runner() -> Callable[[Coroutine[Any, Any, Any]], Any]:
    """Runner to execute async coroutines synchronously in tests."""
    loop = asyncio.SelectorEventLoop()
    asyncio.set_event_loop(loop)
    try:
        yield loop.run_until_complete
    finally:
        if not loop.is_closed():
            loop.close()


@pytest.fixture
def test_settings() -> Settings:
    """Fixture providing isolated test configuration."""
    return Settings(
        AI_SERVICE_HOST="127.0.0.1",
        AI_SERVICE_PORT=8000,
        GEMMA_API_KEY="test-mock-api-key",
        GEMMA_API_MODEL="gemma-2-9b-it",
        OLLAMA_BASE_URL="http://localhost:11434",
        OLLAMA_MODEL="gemma2",
        MIN_BASELINE_EVENTS=5,
        HIGH_BASELINE_EVENTS=20,
        CORRELATION_WINDOW_SECONDS=300.0,
        VOLUME_ZSCORE_THRESHOLD=3.0,
        VOLUME_RATIO_THRESHOLD=3.0,
        FREQUENCY_BURST_THRESHOLD=5.0,
    )


@pytest.fixture
def base_time() -> datetime:
    """Reference timestamp for synthetic events."""
    return datetime(2026, 10, 24, 12, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def normal_baseline_events(base_time: datetime) -> list[NetworkEvent]:
    """Generates 25 baseline events depicting normal traffic for source 192.0.2.10."""
    events = []
    known_dests = ["198.51.100.1", "198.51.100.2", "198.51.100.3"]

    for i in range(25):
        t = base_time - timedelta(minutes=60 - i * 2)
        events.append(
            NetworkEvent(
                event_id=f"base-event-{i:03d}",
                timestamp=t,
                source_ip="192.0.2.10",
                destination_ip=known_dests[i % len(known_dests)],
                source_port=40000 + i,
                destination_port=443,
                protocol="tcp",
                service="ssl",
                outbound_bytes=2_000_000 + (i * 20_000),
                inbound_bytes=500_000,
                duration=1.5,
                conn_state="SF",
            )
        )
    return events


@pytest.fixture
def normal_traffic_batch(base_time: datetime) -> list[NetworkEvent]:
    """Normal traffic event batch that should NOT trigger an anomaly."""
    return [
        NetworkEvent(
            event_id="norm-001",
            timestamp=base_time + timedelta(seconds=10),
            source_ip="192.0.2.10",
            destination_ip="198.51.100.1",
            source_port=50001,
            destination_port=443,
            protocol="tcp",
            outbound_bytes=2_100_000,
            inbound_bytes=480_000,
            conn_state="SF",
        ),
        NetworkEvent(
            event_id="norm-002",
            timestamp=base_time + timedelta(seconds=20),
            source_ip="192.0.2.10",
            destination_ip="198.51.100.2",
            source_port=50002,
            destination_port=443,
            protocol="tcp",
            outbound_bytes=2_050_000,
            inbound_bytes=510_000,
            conn_state="SF",
        ),
    ]


@pytest.fixture
def high_volume_event(base_time: datetime) -> NetworkEvent:
    """Synthetic event with unusually high outbound volume."""
    return NetworkEvent(
        event_id="high-vol-001",
        timestamp=base_time + timedelta(seconds=30),
        source_ip="192.0.2.10",
        destination_ip="198.51.100.1",
        source_port=50010,
        destination_port=443,
        protocol="tcp",
        outbound_bytes=15_000_000,
        inbound_bytes=300_000,
        conn_state="SF",
    )


@pytest.fixture
def rare_destination_event(base_time: datetime) -> NetworkEvent:
    """Synthetic event contacting a new, previously unobserved destination."""
    return NetworkEvent(
        event_id="rare-dest-001",
        timestamp=base_time + timedelta(seconds=40),
        source_ip="192.0.2.10",
        destination_ip="203.0.113.99",
        source_port=50020,
        destination_port=8443,
        protocol="tcp",
        outbound_bytes=50_000,
        inbound_bytes=10_000,
        conn_state="SF",
    )
