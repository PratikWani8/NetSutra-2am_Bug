# NetSutra Backend

The core backend service for **NetSutra**, an open-source network anomaly detection and investigation platform.

The backend acts as the coordination and integration layer between network telemetry (Zeek logs or live sensors), OpenSearch, the Python AI Service, and the React dashboard. It exposes a typed REST API, manages OpenSearch document indexing, orchestrates LLM investigations, and broadcasts real-time telemetry updates via Socket.IO.

---

## Architecture

```
  ┌─────────────────────────────────────────────────────────┐
  │ Network Telemetry / Replayed Zeek Logs (JSON / JSONL)   │
  └────────────────────────────┬────────────────────────────┘
                               │
                               ▼
  ┌─────────────────────────────────────────────────────────┐
  │         NetSutra Backend Ingestion Engine               │
  │  • Normalization to standard NetworkEvent schema        │
  │  • Deterministic & idempotent stable Event IDs          │
  │  • Missing fields preserved as unavailable (no fakes)   │
  └──────────────┬──────────────────────────┬───────────────┘
                 │                          │
                 ▼                          ▼
  ┌─────────────────────────┐    ┌──────────────────────────┐
  │ OpenSearch Primary      │    │ NetSutra Python Service  │
  │  • netsutra-events      │    │  • POST /detect          │
  │  • netsutra-anomalies   │◄───┤  • POST /correlate       │
  │  • netsutra-incidents   │    │  • POST /investigate     │
  └──────────────┬──────────┘    └──────────────────────────┘
                 │
                 ▼
  ┌─────────────────────────────────────────────────────────┐
  │             REST API & Socket.IO Gateway                │
  │  • REST Endpoints (/events, /anomalies, /incidents)     │
  │  • Real-Time Broadcasts (network:event, anomaly:detected│
  │    incident:updated, sensor:status, ai:status)          │
  └────────────────────────────┬────────────────────────────┘
                               │
                               ▼
  ┌─────────────────────────────────────────────────────────┐
  │             NetSutra React Dashboard                    │
  └─────────────────────────────────────────────────────────┘
```

---

## Technology Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Language**: TypeScript (strict mode)
- **Primary Data Store**: OpenSearch (`@opensearch-project/opensearch`)
- **Real-Time Communication**: Socket.IO
- **Validation**: Zod
- **Internal HTTP Client**: Axios
- **File Uploads**: Multer
- **Testing**: Jest, Supertest, ts-jest (28 automated unit and integration tests)

---

## Directory Structure

```
server/
├── .env.example              # Environment variables template
├── .gitignore
├── package.json              # Scripts and dependencies
├── tsconfig.json             # TypeScript compiler configuration
├── jest.config.js            # Jest testing configuration
├── README.md                 # Documentation
│
├── samples/                  # Sample Zeek logs for testing
│   ├── zeek_conn_sample.json # JSON array format
│   ├── zeek_conn_sample.log  # Newline-delimited JSON (NDJSON)
│   └── zeek_attack_sample.json # Synthetic exfiltration and scan records
│
├── src/
│   ├── index.ts              # Entrypoint (HTTP server + Socket.IO)
│   ├── app.ts                # Express application and middleware setup
│   │
│   ├── config/
│   │   ├── env.ts            # Validated environment configuration (Zod)
│   │   └── opensearch.ts     # OpenSearch client, index mappings, init
│   │
│   ├── types/
│   │   ├── common.ts         # Standard API response interfaces
│   │   ├── events.ts         # NetworkEvent and Zeek raw schemas
│   │   ├── anomalies.ts      # Anomaly and detection schemas
│   │   ├── incidents.ts      # Incident and correlation schemas
│   │   ├── investigation.ts  # Investigation request/response schemas
│   │   └── settings.ts       # AI provider settings and status types
│   │
│   ├── schemas/              # Zod validation schemas
│   │   ├── event.schema.ts
│   │   ├── anomaly.schema.ts
│   │   ├── incident.schema.ts
│   │   └── settings.schema.ts
│   │
│   ├── repositories/         # Storage abstraction layer
│   │   ├── interfaces.ts     # Repository contracts
│   │   ├── eventRepository.ts    # OpenSearch netsutra-events
│   │   ├── anomalyRepository.ts  # OpenSearch netsutra-anomalies
│   │   ├── incidentRepository.ts # OpenSearch netsutra-incidents
│   │   └── settingsRepository.ts # Persistent AI provider store
│   │
│   ├── services/
│   │   ├── aiService.ts          # Client for Python AI service
│   │   ├── ingestionService.ts   # Zeek parser, normalization, pipeline
│   │   ├── anomalyService.ts     # Anomaly queries and investigation
│   │   ├── incidentService.ts    # Incident management and hydration
│   │   ├── settingsService.ts    # AI provider manual switching
│   │   ├── dashboardService.ts   # Aggregations & summary metrics
│   │   └── socketService.ts      # Socket.IO broadcasting service
│   │
│   ├── controllers/
│   │   ├── healthController.ts
│   │   ├── dashboardController.ts
│   │   ├── eventController.ts
│   │   ├── anomalyController.ts
│   │   ├── incidentController.ts
│   │   └── settingsController.ts
│   │
│   ├── routes/
│   │   ├── index.ts
│   │   ├── health.routes.ts
│   │   ├── dashboard.routes.ts
│   │   ├── event.routes.ts
│   │   ├── anomaly.routes.ts
│   │   ├── incident.routes.ts
│   │   └── settings.routes.ts
│   │
│   ├── middleware/
│   │   ├── errorHandler.ts       # Standard error format & sanitization
│   │   ├── validate.ts           # Zod schema validation middleware
│   │   └── requestLogger.ts      # Structured request logging
│   │
│   ├── utils/
│   │   ├── logger.ts             # Structured JSON / formatted logger
│   │   ├── response.ts           # Standard response helpers (sendSuccess, sendError)
│   │   └── normalizer.ts         # Zeek to NetworkEvent mapping & hashing
│   │
│   └── scripts/
│       └── ingestCli.ts          # CLI tool for ingesting Zeek logs from terminal
│
└── tests/
    ├── unit/
    │   └── normalizer.test.ts
    └── integration/
        ├── health_dashboard.test.ts
        ├── ingestion_events.test.ts
        ├── anomalies_investigation.test.ts
        ├── incidents.test.ts
        └── provider_settings.test.ts
```

---

## Environment Configuration

Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Node.js backend listening port | `5000` |
| `FRONTEND_ORIGIN` | Allowed CORS origin for React dashboard | `http://localhost:5173` |
| `OPENSEARCH_URL` | OpenSearch cluster endpoint | `http://localhost:9200` |
| `AI_SERVICE_URL` | Base URL of Python AI detection service | `http://localhost:8000` |
| `MONGODB_URI` | Optional MongoDB connection string | `mongodb://localhost:27017/netsutra` |
| `DEFAULT_AI_PROVIDER`| Initial AI provider (`gemma-api` or `ollama`) | `gemma-api` |
| `LOG_LEVEL` | Logging verbosity (`debug`, `info`, `warn`, `error`) | `info` |

> **Note**: Unused optional variables are kept out of the required startup path. If OpenSearch or MongoDB are temporarily unavailable or starting up, the backend gracefully utilizes its resilient local fallback storage so development and tests can run without failure.

---

## Installation & Startup

### 1. Install Dependencies
```bash
npm install
```

### 2. Start in Development Mode (Live Reloading via tsx)
```bash
npm run dev
```

### 3. Build for Production
```bash
npm run build
```

### 4. Start in Production Mode
```bash
npm start
```

### 5. Run Automated Tests
```bash
npm test
```

### 6. CLI Ingestion Tool
Ingest sample Zeek logs directly into the running storage and detection pipeline:
```bash
npm run ingest samples/zeek_conn_sample.json
npm run ingest samples/zeek_attack_sample.json
```

---

## API Endpoints Reference

All API responses follow the standard JSON contract:

**Success Response Format:**
```json
{
  "success": true,
  "data": {}
}
```

**Error Response Format:**
```json
{
  "success": false,
  "error": {
    "code": "PROVIDER_UNAVAILABLE",
    "message": "The selected AI provider is unavailable."
  }
}
```

### 1. Health and Dashboard

#### `GET /api/health`
Returns the status of the backend and connected internal services.
- **Response**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "NetSutra Backend",
    "version": "1.0.0",
    "uptime_seconds": 128,
    "timestamp": "2026-10-24T14:00:00.000Z",
    "services": {
      "opensearch": { "connected": true },
      "ai_service": { "status": "connected" },
      "socket_io": { "connected_clients": 2 }
    }
  }
}
```

#### `GET /api/dashboard/summary`
Returns aggregated metrics for the React security dashboard.
- **Response**:
```json
{
  "success": true,
  "data": {
    "total_events": 1420,
    "total_anomalies": 12,
    "active_incidents": 3,
    "severity_breakdown": {
      "critical": 2,
      "high": 4,
      "medium": 5,
      "low": 1
    },
    "top_source_ips": [{ "ip": "192.0.2.10", "count": 450 }],
    "top_destination_ips": [{ "ip": "198.51.100.20", "count": 310 }],
    "recent_anomalies": [...],
    "selected_ai_provider": "gemma-api",
    "timestamp": "2026-10-24T14:00:00.000Z"
  }
}
```

---

### 2. Network Events

#### `GET /api/events`
Query normalized network events.
- **Query Parameters**:
  - `time_start`: ISO 8601 start timestamp
  - `time_end`: ISO 8601 end timestamp
  - `source_ip`: Filter by originating host IP
  - `destination_ip`: Filter by target host IP
  - `protocol`: Filter by transport protocol (`tcp`, `udp`, `icmp`)
  - `service`: Filter by application service (`ssl`, `dns`, `http`)
  - `page`: Page number (default: `1`)
  - `limit`: Records per page (default: `50`, max: `1000`)
- **Response**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "event_id": "CHkAvZ1YdQj12401",
        "timestamp": "2026-10-24T14:00:00.000Z",
        "source_ip": "192.168.1.100",
        "destination_ip": "142.250.190.46",
        "source_port": 54320,
        "destination_port": 443,
        "protocol": "tcp",
        "service": "ssl",
        "outbound_bytes": 1420,
        "inbound_bytes": 4520,
        "duration": 0.825,
        "conn_state": "SF"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

#### `POST /api/ingest/zeek`
Ingests Zeek JSON records (JSON array, JSONL, or multipart file upload).
- Triggers field normalization.
- Assigns stable, idempotent event IDs.
- Stores events in OpenSearch `netsutra-events`.
- Submits telemetry to the AI service for behavioral anomaly detection.
- Persists detected anomalies into OpenSearch before broadcasting.
- Emits real-time updates via Socket.IO.

---

### 3. Anomalies & AI Investigation

#### `GET /api/anomalies`
Lists detected anomalies with filtering by `severity`, `method`, time range, and pagination.

#### `GET /api/anomalies/:id`
Retrieves a single anomaly record by its identifier, including its features and supporting evidence event IDs.

#### `POST /api/anomalies/:id/investigate`
Coordinates grounded AI investigation of the anomaly:
1. Retrieves the anomaly record.
2. Fetches the actual supporting evidence network events from OpenSearch.
3. Retrieves the currently selected AI provider (`gemma-api` or `ollama`).
4. Calls `POST /investigate` on the Python AI service.
5. Emits `ai:status` on Socket.IO.
6. Returns the structured investigation result.

> **Provider Failure Guarantee**: If the selected provider is unavailable, the backend returns a structured `PROVIDER_UNAVAILABLE` error (HTTP 502/503). It **never silently switches providers**.

- **Response Example**:
```json
{
  "success": true,
  "data": {
    "incident_id": "inc-anom-example-001",
    "provider": "gemma-api",
    "model": "gemma-2-9b-it",
    "summary": "Host 192.0.2.10 transmitted an abnormal outbound data burst.",
    "observed_evidence": [
      "150 MB outbound data transmitted to destination 198.51.100.20 over port 443."
    ],
    "possible_explanations": [
      "Scheduled cloud backup or data synchronization job.",
      "Unauthorized staging or data exfiltration."
    ],
    "recommended_checks": [
      "Verify if 198.51.100.20 is an approved backup target.",
      "Check running processes on 192.0.2.10 during the connection window."
    ],
    "uncertainties": [
      "Encrypted TLS payload prevents inspection of file contents."
    ],
    "created_at": "2026-10-24T14:05:00.000Z"
  }
}
```

---

### 4. Incidents

#### `GET /api/incidents`
Lists correlated security incidents with status and severity filters.

#### `GET /api/incidents/:id`
Retrieves an incident with fully hydrated linked `anomalies` and supporting `events`.

#### `PATCH /api/incidents/:id/status`
Updates the workflow status of an incident.
- **Request Body**:
```json
{
  "status": "investigating"
}
```
*Valid values*: `open`, `investigating`, `resolved`, `closed`.
- Broadcasts `incident:updated` on Socket.IO.

---

### 5. AI Provider Configuration

#### `GET /api/settings/ai-provider`
Returns the currently selected AI provider and list of available providers:
```json
{
  "success": true,
  "data": {
    "provider": "gemma-api",
    "available_providers": ["gemma-api", "ollama"]
  }
}
```

#### `PUT /api/settings/ai-provider`
Manually switches the active AI provider.
- **Request Body**:
```json
{
  "provider": "ollama"
}
```
*Accepted values*: `gemma-api`, `ollama`.
- Persists choice to disk configuration.
- Emits `ai:status` on Socket.IO.

#### `GET /api/ai/providers/status`
Returns real-time health, latency, and model availability for both providers without exposing API keys.

---

## Real-Time Events (Socket.IO)

The backend exposes a Socket.IO server on the same HTTP port. All data is persisted to OpenSearch before broadcast.

| Event | Payload Fields | Description |
| :--- | :--- | :--- |
| `network:event` | `{ id, timestamp, event }` | Emitted when a new network event is ingested |
| `anomaly:detected` | `{ id, timestamp, anomaly }` | Emitted when a behavioral anomaly is detected |
| `incident:updated` | `{ id, timestamp, incident }` | Emitted when an incident is created or its status changes |
| `sensor:status` | `{ sensor_id, status, timestamp, details }` | Telemetry sensor health and ingestion status |
| `ai:status` | `{ provider, status, timestamp, details }` | AI provider selection or investigation progress |

---

## Zeek Ingestion & Normalization

1. **Missing Fields**: Missing fields are left unavailable (`null`/`undefined`) rather than fabricating values.
2. **Idempotency**: If a Zeek `uid` is present, it is used as the document ID. If absent, a deterministic SHA-256 hash of the connection tuple (`timestamp|orig_h|orig_p|resp_h|resp_p|protocol`) is generated. Re-ingesting the same log produces identical IDs, preventing duplicate records.
3. **Resilience**: If the AI service is temporarily offline, raw network telemetry is still safely ingested and indexed into OpenSearch without interruption.

---

## Running the Automated Test Suite

Run the full Jest test suite:
```bash
npm test
```

### Verified Test Scenarios (28 Tests):
- **Zeek Normalizer**:
  - Full conn.log normalization with alias resolution
  - Missing field handling (no fabricated values)
  - Deterministic stable event ID generation and idempotency
  - NDJSON and JSON array parsing
- **Health & Dashboard API**:
  - Standard JSON response format verification
  - Service health aggregation (OpenSearch, AI service, Socket.IO)
  - Metrics and severity distribution
- **Ingestion & Events API**:
  - Zeek batch ingestion and idempotency
  - Query filtering (source IP, protocol, time range)
  - Bounded pagination and validation error handling
- **Incidents API**:
  - Incident listing and filtering
  - Incident retrieval with hydrated linked anomalies and supporting events
  - Workflow status updates (`open` -> `investigating`)
  - Status validation (rejects invalid states)
- **AI Provider Settings**:
  - Provider retrieval and manual switching (`gemma-api` <-> `ollama`)
  - Configuration persistence across restarts
  - Validation error on unsupported providers
  - Providers status reporting
- **Investigation & Fault Isolation**:
  - Grounded AI investigation with supporting evidence passing
  - Provider failure isolation (`PROVIDER_UNAVAILABLE` on 502/503)
  - Verification that providers are never silently switched on failure
