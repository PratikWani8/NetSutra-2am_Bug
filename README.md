# NetSutra

**Open-source Network Anomaly Detection and Investigation Platform**

NetSutra helps security analysts identify unusual network behavior, investigate suspicious activity, and understand which network events deserve attention first.

It combines behavioral anomaly detection, network event correlation, searchable evidence, and AI-assisted investigation in a real-time dashboard.

> **Important:** An anomaly is not proof of an attack. NetSutra provides signals and investigation guidance, not definitive threat attribution.

## Features

### Network Monitoring
- Ingest and normalize network telemetry from Zeek JSON logs.
- Search and filter network events.
- View source and destination information, protocols, timestamps, and traffic metrics when available.
- Support replaying sample logs for demonstrations and testing.

### Behavioral Anomaly Detection
- Identify unusual connection frequency and traffic volume.
- Detect rare destinations and deviations from historical behavior.
- Use configurable statistical baselines and transparent detection rules.
- Assign anomaly scores, severity levels, and explanatory reasons.
- Track supporting event IDs for investigation.

### Incident Correlation
- Group related anomalies and network events.
- Correlate events by source, destination, time window, and behavioral patterns.
- Display related evidence and incident timelines.

### AI-Assisted Investigation
- Generate evidence-grounded incident summaries.
- Separate observed facts from possible explanations.
- Recommend practical investigation steps.
- Highlight missing evidence and uncertainty.

### Manual AI Provider Switching
Choose between two providers:

- **Gemma API:** hosted model inference through a configured API.
- **Ollama:** local inference using a locally available Gemma model.

Switch providers through the dashboard. NetSutra does not silently switch providers when the selected provider is unavailable.

### Real-Time Dashboard
- Live network event updates.
- New anomaly notifications.
- Incident status updates.
- Sensor and AI provider status.
- Charts, timelines, and severity summaries.

### Service responsibilities

| Component | Responsibility | Default address |
|---|---|---|
| Frontend | Dashboard, events, incidents, provider settings | `http://localhost:5173` |
| Backend | REST API, ingestion, orchestration, Socket.IO | `http://localhost:5000` |
| AI service | Detection, correlation, AI investigation | `http://localhost:8000` |
| OpenSearch | Network events and anomaly storage | `http://localhost:9200` |
| Ollama | Local Gemma inference | `http://localhost:11434` |

Zeek runs separately from the web application. For the MVP, existing Zeek logs can be replayed instead of capturing live traffic.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Charts and UI | Recharts, Lucide React, optional Framer Motion |
| Backend | Node.js, Express.js |
| Real-time communication | Socket.IO |
| Search and storage | OpenSearch |
| Detection and investigation | Python, FastAPI, Pydantic |
| Network telemetry | Zeek |
| AI inference | Gemma API, Ollama |
| Optional application metadata | MongoDB |

OpenSearch is the primary store for searchable network events and anomaly records. MongoDB is optional and should be used only if the application needs separate metadata or workflow storage.

## Project Structure

A suggested monorepo layout:

```text
netsutra/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── App.jsx
│   ├── .env.example
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── ingestion/
│   │   ├── sockets/
│   │   └── app.js
│   ├── .env.example
│   └── package.json
│
├── ai-service/
│   ├── api/
│   ├── detection/
│   ├── correlation/
│   ├── investigation/
│   ├── providers/
│   ├── tests/
│   ├── main.py
│   ├── config.py
│   ├── requirements.txt
│   └── .env.example
│
├── sensor/
│   └── samples/
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

The exact structure may differ depending on implementation. Keep service boundaries and API contracts consistent.

## Prerequisites

Install the following tools before starting:

- Node.js and npm
- Python 3.11 or later
- Git
- OpenSearch
- Zeek, if parsing or generating your own network telemetry
- Ollama, if using local Gemma inference

You also need either a configured Gemma API credential or a locally available Gemma model to use AI investigation.

## Getting Started

### 1. Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd netsutra
```

Replace `<YOUR_REPOSITORY_URL>` with the actual repository URL.

### 2. Configure OpenSearch

Start a local OpenSearch instance using your preferred installation method.

Verify that it is reachable:

```bash
curl http://localhost:9200
```

Your local security configuration may require HTTPS and authentication. Configure the backend to use the actual endpoint and credentials.

On first startup, the backend should create the required indexes and mappings if they do not exist.

Suggested indexes:

- `netsutra-events`
- `netsutra-anomalies`

### 3. Set up the backend

```bash
cd backend
npm install
```

Create a `.env` file based on `.env.example`:

```env
PORT=5000
FRONTEND_ORIGIN=http://localhost:5173
OPENSEARCH_URL=http://localhost:9200
AI_SERVICE_URL=http://localhost:8000

# Optional: use only if MongoDB is implemented
MONGODB_URI=mongodb://localhost:27017/netsutra
```

Start the backend using the script defined in `package.json`. For example:

```bash
npm run dev
```

Verify that the health endpoint responds:

```bash
curl http://localhost:5000/api/health
```

### 4. Set up the Python AI service

Open a new terminal:

```bash
cd ai-service
python -m venv .venv
```

Activate the environment.

**macOS/Linux:**

```bash
source .venv/bin/activate
```

**Windows PowerShell:**

```powershell
.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a `.env` file:

```env
AI_SERVICE_HOST=0.0.0.0
AI_SERVICE_PORT=8000

GEMMA_API_KEY=
GEMMA_API_MODEL=

OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=
```

Fill in the provider configuration you intend to use. Never commit real credentials.

Start the service:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Check the service:

```bash
curl http://localhost:8000/health
```

Adjust the `uvicorn` module path if the application entry point differs.

### 5. Configure Ollama (optional)

Install Ollama and download a Gemma model supported by your environment.

For example, if your installed Ollama version provides the selected model:

```bash
ollama pull gemma3:4b
```

Set the model name to the exact model identifier you installed:

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma3:4b
```

The model above is an example. Choose a model that your machine can run and that is supported by your implementation.

Verify Ollama is running and the model is available before selecting the Ollama provider in NetSutra.

### 6. Set up the frontend

Open a new terminal:

```bash
cd frontend
npm install
```

Create `.env` based on `.env.example`:

```env
VITE_API_BASE_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

Start the development server:

```bash
npm run dev
```

Open the URL printed by Vite, normally:

`http://localhost:5173`

## Environment Configuration

Do not commit `.env` files containing secrets. Commit `.env.example` files with empty or non-sensitive placeholder values.

| Variable | Service | Purpose |
|---|---|---|
| `PORT` | Backend | Express server port |
| `FRONTEND_ORIGIN` | Backend | Allowed frontend origin |
| `OPENSEARCH_URL` | Backend | OpenSearch endpoint |
| `AI_SERVICE_URL` | Backend | Python service endpoint |
| `MONGODB_URI` | Backend | Optional MongoDB connection |
| `AI_SERVICE_HOST` | AI service | FastAPI bind address |
| `AI_SERVICE_PORT` | AI service | FastAPI port |
| `GEMMA_API_KEY` | AI service | Hosted inference credential |
| `GEMMA_API_MODEL` | AI service | Configured hosted model identifier |
| `OLLAMA_BASE_URL` | AI service | Ollama endpoint |
| `OLLAMA_MODEL` | AI service | Installed local model identifier |
| `VITE_API_BASE_URL` | Frontend | Backend API URL |
| `VITE_SOCKET_URL` | Frontend | Socket.IO URL |

Only variables actually used by your implementation need to be required at startup.

## Running the Application

Start the services in this order:

1. OpenSearch
2. Ollama, if using local inference
3. Python AI service
4. Node.js backend
5. React frontend
6. Zeek log ingestion or replay

Keep each service running in its own terminal unless you have configured a process manager or Docker Compose.

### End-to-end smoke test

1. Check the backend and AI service health endpoints.
2. Verify the backend can connect to OpenSearch.
3. Load a sample Zeek JSON log.
4. Confirm that normalized events appear in the events API.
5. Feed events into the detector and verify that anomaly records are created when appropriate.
6. Confirm that related anomalies can be correlated into incidents.
7. Run an AI investigation and verify the structured response.
8. Switch providers from the dashboard and verify the saved selection is used.
9. Confirm live events reach the frontend over Socket.IO.

Use synthetic or authorized network data for testing.

## AI Provider Configuration

NetSutra supports manual provider selection.

### Gemma API

Configure the API credential and model identifier in the Python service environment. Restart the service if your configuration is not reloaded dynamically.

Select `gemma-api` in the dashboard.

### Ollama

Start Ollama, download the desired model, and configure the local model identifier.

Select `ollama` in the dashboard.

### Provider failure behavior

If the selected provider is unavailable:

- Return a structured error.
- Keep network events, anomalies, and evidence available.
- Do not silently change the selected provider.
- Let the analyst manually select another provider.
- Keep detection operational independently of AI inference.

## API Endpoints

All frontend requests go through the Node.js backend.

### Health and dashboard

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Backend health |
| `GET` | `/api/dashboard/summary` | Dashboard metrics |

### Network events

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/events` | Search and list network events |

### Anomalies

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/anomalies` | List anomalies |
| `GET` | `/api/anomalies/:id` | Get anomaly details |
| `POST` | `/api/anomalies/:id/investigate` | Request AI investigation |

### Incidents

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/incidents` | List incidents |
| `GET` | `/api/incidents/:id` | Get incident details |
| `PATCH` | `/api/incidents/:id/status` | Update incident status |

### AI provider settings

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/settings/ai-provider` | Get selected provider |
| `PUT` | `/api/settings/ai-provider` | Change selected provider |
| `GET` | `/api/ai/providers/status` | Check provider availability |

The Python service exposes internal endpoints:

- `GET /health`
- `POST /detect`
- `POST /correlate`
- `POST /investigate`
- `GET /providers`
- `GET /providers/status`

Internal service endpoints should not be exposed publicly without appropriate access controls.

### Response format

Successful requests should use a consistent structure:

```json
{
  "success": true,
  "data": {}
}
```

Errors should use a consistent structure:

```json
{
  "success": false,
  "error": {
    "code": "PROVIDER_UNAVAILABLE",
    "message": "The selected AI provider is unavailable."
  }
}
```

These examples describe the intended contract. Refer to the implemented schemas for exact fields and validation requirements.

## Real-Time Events

The backend broadcasts updates through Socket.IO.

| Event | Purpose |
|---|---|
| `network:event` | New network event |
| `anomaly:detected` | New anomaly detected |
| `incident:updated` | Incident created or updated |
| `sensor:status` | Sensor health or status change |
| `ai:status` | AI provider availability change |

Each event should include relevant record identifiers and timestamps. Persist records before broadcasting updates so the dashboard can retrieve the same records through the API.

## Detection and Investigation Workflow

1. Zeek produces network telemetry.
2. The backend ingests and normalizes supported events.
3. Events are indexed in OpenSearch.
4. The detection service evaluates behavioral features and baselines.
5. Detected anomalies are stored with scores, reasons, and evidence references.
6. The correlation service groups related anomalies and events.
7. The analyst requests an AI investigation.
8. The backend passes relevant evidence and the selected provider to the Python service.
9. Gemma returns a structured explanation, potential explanations, recommended checks, and uncertainties.
10. The dashboard displays the findings and receives live updates.

AI explanations must not alter the detector's scores or independently confirm that an attack occurred.

## Testing

Run the frontend, backend, and Python tests from their respective project directories.

Typical commands, depending on the configured scripts:

```bash
# Frontend
npm test

# Backend
npm test

# Python AI service
pytest
```

For a useful MVP test suite, include:

- Normal network activity
- Unusually high outbound traffic
- Rare destination activity
- Insufficient baseline history
- Related and unrelated events
- Invalid API requests
- OpenSearch connection failures
- Gemma API unavailability
- Ollama unavailability
- Malformed AI responses
- Manual provider switching
- Real-time event delivery

If the project does not yet define these test scripts, add them before relying on these commands.

## Security Considerations

- Run sensors only on networks you are authorized to monitor.
- Never expose AI API credentials to the frontend.
- Keep `.env` files out of version control.
- Validate and normalize all incoming telemetry.
- Limit query time ranges and result sizes.
- Protect internal service endpoints and OpenSearch from unauthorized access.
- Avoid logging credentials, tokens, or unnecessary sensitive telemetry.
- Treat model output as untrusted text.
- Do not automatically block hosts or modify network traffic based on anomaly scores or AI recommendations.

Before production deployment, add appropriate authentication, authorization, TLS, audit logging, secret management, and retention controls.


## Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Keep changes focused and documented.
4. Add tests for new detection rules, API behavior, or provider integrations.
5. Verify that the frontend, backend, and AI service continue to follow the shared contracts.
6. Submit a pull request with a concise explanation of the change.

Please do not commit credentials, private network captures, or sensitive telemetry.

---

**NetSutra — Detect unusual behavior. Investigate with evidence.**
