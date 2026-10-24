# NetSutra AI and Detection Service

Open-source network anomaly detection and investigation service for the **NetSutra** platform.

This service implements two decoupled responsibilities:
1. **Behavioral Anomaly Detection & Correlation**: Measurable, deterministic statistical detection of network anomalies from connection telemetry (such as Zeek logs) and correlation of anomalies into transparent security incidents.
2. **Grounded AI Incident Investigation**: Using Gemma models (`gemma-api` or locally hosted `ollama`) to synthesize evidence, hypothesize benign and suspicious explanations, recommend analyst checks, and highlight telemetry uncertainties without hallucinations.

> **Core NetSutra Principle**: The LLM is **never** the primary anomaly detector. All detection scores, severities, and baseline evaluations are derived from verifiable features and deterministic statistical rules.

---

## Architecture

```
                    ┌─────────────────────────────────┐
                    │      Node.js Backend / UI       │
                    │   (Public API & Coordination)   │
                    └────────────────┬────────────────┘
                                     │
         Normalized telemetry events │ POST /detect, /correlate
             & investigation queries │ POST /investigate
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│               NetSutra Python Service (FastAPI / Uvicorn)               │
│                                                                        │
│   ┌───────────────────────────┐      ┌─────────────────────────────┐   │
│   │ 1. Behavioral Detection   │      │ 2. Event Correlation        │   │
│   │  • Outbound volume        │ ───► │  • Shared source/dest host  │   │
│   │  • Rare destination       │      │  • Temporal windowing       │   │
│   │  • Connection bursts      │      │  • Transparent reasons      │   │
│   │  • State failure patterns │      │  • Incident synthesis       │   │
│   └───────────────────────────┘      └──────────────┬──────────────┘   │
│                                                     │                  │
│                                                     ▼                  │
│   ┌─────────────────────────────────────────────────────────────┐      │
│   │ 3. Investigation Service & Grounding Guardrails             │      │
│   │    • Filters context to pertinent evidence items            │      │
│   │    • Enforces fact vs. hypothesis separation                │      │
│   │    • Strict JSON schema validation and graceful fallback    │      │
│   └─────────────────────────────┬───────────────────────────────┘      │
│                                 │                                      │
│                                 ▼                                      │
│   ┌─────────────────────────────────────────────────────────────┐      │
│   │ 4. Provider Abstraction Layer (Shared Interface)            │      │
│   │   ┌────────────────────────┐    ┌────────────────────────┐  │      │
│   │   │ Provider A: gemma-api  │    │ Provider B: ollama     │  │      │
│   │   │ (Google AI Studio API) │    │ (Local Gemma daemon)   │  │      │
│   │   └────────────────────────┘    └────────────────────────┘  │      │
│   └─────────────────────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

- **Python**: 3.11+ (tested on Python 3.13)
- **FastAPI**: 0.115+
- **Pydantic**: 2.10+ (strict request and response validation)
- **Uvicorn**: High-performance ASGI server
- **HTTP Client**: `httpx` (async non-blocking HTTP)
- **NumPy & Pandas**: Statistical baseline and deviation calculations
- **Pytest**: Comprehensive test suite (33 unit and end-to-end tests)

---

## Project Structure

```
NetSutra/
├── .env.example              # Example environment configuration
├── config.py                 # Pydantic Settings management
├── main.py                   # FastAPI application entrypoint & lifespan
├── requirements.txt          # Production and development dependencies
├── README.md                 # Complete documentation
│
├── api/
│   ├── __init__.py
│   └── routes.py             # Route handlers (/health, /detect, /correlate, /investigate, /providers)
│
├── schemas/
│   ├── __init__.py
│   ├── telemetry.py          # NetworkEvent schema with Zeek field normalization
│   ├── anomaly.py            # Anomaly, DetectionRequest, DetectionResponse
│   ├── correlation.py        # Incident, CorrelateRequest, CorrelateResponse
│   ├── investigation.py      # InvestigateRequest, InvestigateResponse
│   └── providers.py          # ProvidersListResponse, ProvidersStatusResponse
│
├── detection/
│   ├── __init__.py
│   ├── baseline.py           # Source baseline computation & confidence evaluation
│   ├── rules.py              # Rule engines (volume, rare dest, burst, failures)
│   └── detector.py           # Detector pipeline coordinator
│
├── correlation/
│   ├── __init__.py
│   └── correlator.py         # Multi-dimensional incident clustering engine
│
├── investigation/
│   ├── __init__.py
│   ├── prompts.py            # Strict grounding instructions & evidence templates
│   └── service.py            # LLM prompt execution & robust JSON repair parser
│
├── providers/
│   ├── __init__.py
│   ├── base.py               # BaseGemmaProvider abstract interface & custom errors
│   ├── gemma_api.py          # Google AI Studio / Generative Language provider
│   ├── ollama.py             # Local Ollama daemon provider
│   └── factory.py            # Provider resolver factory
│
├── samples/                  # Sample request & response JSON payloads
│   ├── sample_detect_request.json
│   ├── sample_detect_response.json
│   ├── sample_correlate_request.json
│   ├── sample_correlate_response.json
│   ├── sample_investigate_request.json
│   ├── sample_investigate_response.json
│   └── sample_providers_status_response.json
│
└── tests/                    # Unit and integration tests
    ├── conftest.py
    ├── test_detection.py
    ├── test_correlation.py
    ├── test_providers.py
    ├── test_investigation.py
    └── test_api.py
```

---

## Installation & Setup

### 1. Clone & Set Up Python Environment
```bash
python -m venv .venv
# On Linux / macOS:
source .venv/bin/activate
# On Windows PowerShell:
.venv\Scripts\Activate.ps1

pip install -r requirements.txt
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Environment variable specifications:
```ini
AI_SERVICE_HOST=0.0.0.0
AI_SERVICE_PORT=8000
LOG_LEVEL=INFO

# Provider A: Gemma API
GEMMA_API_KEY=your_google_ai_studio_api_key_here
GEMMA_API_MODEL=gemma-2-9b-it
GEMMA_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta

# Provider B: Ollama (Local)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma2

# Detection & Baselines
MIN_BASELINE_EVENTS=5
HIGH_BASELINE_EVENTS=20
CORRELATION_WINDOW_SECONDS=300.0
VOLUME_ZSCORE_THRESHOLD=3.0
VOLUME_RATIO_THRESHOLD=3.0
FREQUENCY_BURST_THRESHOLD=5.0
FAILED_CONNECTION_RATIO_THRESHOLD=0.5
```

---

## Provider Setup Instructions

### Provider A: `gemma-api` (Google AI Studio)
1. Go to [Google AI Studio](https://aistudio.google.com/) and create an API key.
2. In `.env`, set:
   ```env
   GEMMA_API_KEY=AIzaSy...
   GEMMA_API_MODEL=gemma-2-9b-it
   ```
3. Test availability using:
   ```bash
   curl http://localhost:8000/providers/status
   ```
   > **Security Guarantee**: API keys are server-side only and are **never** exposed in HTTP responses, logs, or status endpoints.

---

### Provider B: `ollama` (Local Gemma Model)
1. Install Ollama from [ollama.com](https://ollama.com/).
2. Start the Ollama background daemon:
   ```bash
   ollama serve
   ```
3. Download and pull the Gemma model:
   ```bash
   # Download Gemma 2 (9B recommended for analysis quality)
   ollama pull gemma2

   # Or lighter 2B model for resource-constrained environments:
   ollama pull gemma2:2b
   ```
4. Verify Ollama is serving the model:
   ```bash
   ollama list
   ```
5. In `.env`, set:
   ```env
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=gemma2
   ```

---

## Running the Service

Start the FastAPI application:
```bash
python main.py
```
Or directly with Uvicorn:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive OpenAPI documentation will be accessible at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## API Endpoints Reference

### 1. `GET /health`
Returns service availability, uptime, and version.

**Response:**
```json
{
  "status": "healthy",
  "service": "NetSutra AI and Detection Service",
  "version": "1.0.0",
  "timestamp": "2026-10-24T12:00:00Z"
}
```

---

### 2. `POST /detect`
Detects behavioral and statistical anomalies across incoming telemetry.
Supports standard NetSutra schema as well as raw Zeek `conn.log` exports (automatic field mapping from `id.orig_h`, `orig_bytes`, `ts`, `conn_state`, etc.).

**Request:**
```bash
curl -X POST http://localhost:8000/detect \
  -H "Content-Type: application/json" \
  -d @samples/sample_detect_request.json
```

**Key Response Fields:**
- `score`: Numeric anomaly score between 0.0 and 1.0.
- `severity`: Standardized classification (`low`, `medium`, `high`, `critical`).
- `method`: Algorithm applied (e.g. `outbound_volume_deviation`, `rare_destination`, `connection_frequency_burst`, `failed_connection_pattern`).
- `baseline_confidence`: `low`, `medium`, or `high`.
- `reasons`: Human-readable explanation.
- `features`: Exact measured features and baseline comparisons.
- `evidence_event_ids`: IDs of supporting telemetry records.

---

### 3. `POST /correlate`
Groups related anomalies and network events into cohesive incidents based on:
- Shared originating host (`source_ip`)
- Shared target destination (`destination_ip`)
- Temporal window proximity (`time_window_seconds`)
- Shared underlying telemetry events

**Request:**
```bash
curl -X POST http://localhost:8000/correlate \
  -H "Content-Type: application/json" \
  -d @samples/sample_correlate_request.json
```

---

### 4. `POST /investigate`
Performs grounded security investigation using the selected provider (`gemma-api` or `ollama`).

**Request Example:**
```json
{
  "provider": "gemma-api",
  "incident": {
    "incident_id": "inc-example-001",
    "anomaly_ids": ["anom-example-001"],
    "evidence": [
      {
        "event_id": "event-example-001",
        "source_ip": "192.0.2.10",
        "destination_ip": "198.51.100.20",
        "outbound_bytes": 12000000
      }
    ],
    "summary": "Unusual outbound traffic was detected."
  }
}
```

**Manual Provider Selection & Resilient Error Handling:**
- The request must specify the provider explicitly.
- **No Automatic Fallback**: If the selected provider is unavailable, the service does not automatically switch providers. Instead, a structured error (HTTP 502/503) is returned so the frontend/operator can take appropriate action or switch providers manually.
- **Provider Failure Isolation**: If AI providers are unavailable, `POST /detect` and `POST /correlate` **continue to operate normally**. Anomaly detection and stored evidence remain 100% accessible.

**Response Example:**
```json
{
  "incident_id": "inc-example-001",
  "provider": "gemma-api",
  "model": "gemma-2-9b-it",
  "summary": "A concise explanation of the observed behavior.",
  "observed_evidence": [
    "Outbound traffic exceeded the recorded baseline."
  ],
  "possible_explanations": [
    "A legitimate transfer or an unusual data movement event."
  ],
  "recommended_checks": [
    "Review the destination and related connections.",
    "Compare the activity with the source's normal behavior."
  ],
  "uncertainties": [
    "The available telemetry does not establish the purpose of the transfer."
  ],
  "created_at": "2026-10-24T12:05:00Z"
}
```

---

### 5. `GET /providers` & `GET /providers/status`
- `GET /providers`: Lists supported provider identifiers `["gemma-api", "ollama"]`.
- `GET /providers/status`: Tests health of configured providers, reports availability and latency without exposing credentials.

---

## Investigation Prompting & Grounding Guardrails

Gemma is passed only relevant incident context and evidence items, not raw unfiltered logs. Prompts strictly enforce:
1. **Facts vs. Hypotheses**: Clear demarcation between observations and interpretations.
2. **Dual-Hypothesis Reasoning**: Generates both plausible benign (e.g. backup, software deployment) and suspicious explanations (e.g. staging, scanning).
3. **Actionable Checks**: Concrete operational steps for the analyst.
4. **Anti-Hallucination Constraints**:
   - Never confirms an attack (anomalies indicate deviations, not confirmed breaches).
   - Never invents hostnames, processes, user identities, or threat intelligence not present in telemetry.
   - Never alters detector anomaly scores or severities.
   - Never treats generated hypotheses as independent evidence.

---

## Running Tests

Execute the automated test suite with pytest:
```bash
pytest -v
```

### Verified Test Scenarios (33 Tests):
- `test_normal_traffic_no_anomalies`: Confirms normal baseline traffic does not raise anomalies.
- `test_synthetic_unusual_outbound_volume`: Validates z-score/ratio calculation, scoring, and features.
- `test_rare_destination_behavior`: Validates detection of new or rare destination IPs/ports.
- `test_insufficient_baseline_history`: Validates low baseline confidence reporting when history is sparse.
- `test_connection_frequency_burst`: Confirms detection of rapid connection spikes.
- `test_failed_connection_pattern`: Confirms detection of REJ/S0 state connection failures.
- `test_zeek_record_normalization`: Tests ingestion of raw Zeek field aliases.
- `test_correlation_by_shared_source_ip` & `test_correlation_by_shared_target_destination`: Confirms transparent clustering.
- `test_avoid_combining_unrelated_events_outside_window`: Confirms temporal separation.
- `test_avoid_combining_unrelated_hosts_at_same_time`: Confirms unrelated events are not merged.
- `test_provider_factory_valid_selection` & `test_provider_factory_invalid_selection`: Provider selection tests.
- `test_gemma_api_missing_key`, `test_gemma_api_unavailable_connect_error`, `test_gemma_api_http_error`: Provider failure handling.
- `test_ollama_unavailable_connect_error`, `test_ollama_model_missing_404`: Ollama error handling.
- `test_provider_status_never_exposes_api_key`: Secret sanitization verification.
- `test_investigation_success_valid_json`: Schema validation for grounded analysis.
- `test_investigation_handles_markdown_code_fences`: Code block extraction.
- `test_investigation_handles_invalid_model_output_gracefully`: Fallback parser for non-JSON model output.
- `test_investigation_does_not_auto_switch_on_failure`: Verification of manual provider control.
- `test_ai_service_failure_detection_remains_operational`: Verifies anomaly detection continues to run when LLM providers fail.

---

## System Limitations & Defensive Considerations

1. **Anomaly Score Interpretation**: A high anomaly score indicates that network behavior significantly deviates from baseline telemetry; **it does not constitute proof of an attack**. Benign events (such as bulk data migrations, operating system updates, or infrastructure changes) frequently cause statistical volume spikes.
2. **Baseline Drift & Cold Start**: Hosts with fewer than `MIN_BASELINE_EVENTS` (default: 5) are flagged with `baseline_confidence: "low"`. The system relies on heuristic thresholds until sufficient telemetry is established.
3. **Encrypted Payloads**: As an L3/L4 behavioral detector operating primarily on connection metadata (Zeek `conn.log`), the service cannot inspect application-layer encrypted payloads (e.g. TLS/HTTPS).
4. **Scope of Anomaly Detection**: The deterministic statistical models are designed for high transparency, auditable rules, and rapid evaluation. They do not claim to identify every novel or low-and-slow Advanced Persistent Threat (APT); performance should be continuously evaluated against representative network traffic.
