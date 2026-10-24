import axios from 'axios';
import {
  DEMO_SUMMARY,
  DEMO_ANOMALIES,
  DEMO_EVENTS,
  DEMO_INCIDENTS,
  DEMO_AI_PROVIDERS,
} from '../data/mockData';
import { SAMPLE_ZEEK_LOGS } from '../data/sampleZeekLogs';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Track backend connection status in memory
let isBackendReachable = true;
const connectionListeners = new Set();

export const onBackendStatusChange = (callback) => {
  connectionListeners.add(callback);
  return () => connectionListeners.delete(callback);
};

const notifyStatus = (status) => {
  if (isBackendReachable !== status) {
    isBackendReachable = status;
    connectionListeners.forEach((cb) => cb(status));
  }
};

export const getBackendStatus = () => isBackendReachable;

/**
 * Normalizes an anomaly object to provide consistent camelCase and snake_case properties.
 */
export function normalizeAnomaly(a) {
  if (!a || typeof a !== 'object') return a;
  const id = a.id || a.anomaly_id || a._id;
  const rawSrc = a.sourceIp || a.source_ip || a.features?.source_ip || a.features?.['id.orig_h'] || a.features?.src_ip || a.evidence?.[0]?.source_ip || a.evidence?.[0]?.['id.orig_h'];
  const srcIp = rawSrc && rawSrc !== 'N/A' && rawSrc !== 'undefined' ? rawSrc : (a.source_ip && a.source_ip !== 'N/A' ? a.source_ip : 'N/A');
  const srcPort = a.sourcePort ?? a.source_port ?? a.features?.source_port ?? a.features?.['id.orig_p'] ?? a.evidence?.[0]?.source_port ?? null;
  const rawDst = a.destinationIp || a.destination_ip || a.features?.destination_ip || a.features?.['id.resp_h'] || a.features?.dest_ip || a.evidence?.[0]?.destination_ip || a.evidence?.[0]?.['id.resp_h'];
  const dstIp = rawDst && rawDst !== 'N/A' && rawDst !== 'undefined' ? rawDst : (a.destination_ip && a.destination_ip !== 'N/A' ? a.destination_ip : 'N/A');
  const dstPort = a.destinationPort ?? a.destination_port ?? a.features?.destination_port ?? a.features?.['id.resp_p'] ?? a.evidence?.[0]?.destination_port ?? null;
  const vector = a.vector || a.method || (a.reasons && a.reasons[0]) || 'Network Anomaly';
  const ruleId = a.ruleId || a.rule_id || a.method || 'anom-detector';
  const status = a.investigationStatus || a.status || 'open';
  const score = a.score !== undefined ? a.score : 0.5;
  const severity = (a.severity || 'MEDIUM').toUpperCase();
  const detectionMethod = a.detectionMethod || a.method || 'Isolation Forest / Behavioral Outlier Detection';
  const timestamp = a.timestamp || new Date().toISOString();
  const reasons = Array.isArray(a.reasons) ? a.reasons : (a.reasons ? [a.reasons] : []);

  let measuredFeatures = Array.isArray(a.measuredFeatures) ? a.measuredFeatures : [];
  if (measuredFeatures.length === 0 && a.features && typeof a.features === 'object') {
    measuredFeatures = Object.entries(a.features).map(([key, val]) => ({
      feature: key.replace(/_/g, ' ').toUpperCase(),
      observed: String(val),
      baseline: a.features?.baseline_outbound_bytes || a.features?.baseline_rate_per_sec || 'Standard Baseline',
      deviation: a.features?.z_score ? `z: ${a.features.z_score}` : (a.features?.deviation_ratio ? `${a.features.deviation_ratio}x` : 'Flagged'),
    }));
  }

  return {
    ...a,
    id,
    anomaly_id: id,
    sourceIp: srcIp,
    source_ip: srcIp,
    sourcePort: srcPort,
    source_port: srcPort,
    destinationIp: dstIp,
    destination_ip: dstIp,
    destinationPort: dstPort,
    destination_port: dstPort,
    vector,
    ruleId,
    rule_id: ruleId,
    investigationStatus: status,
    status,
    score,
    severity,
    detectionMethod,
    timestamp,
    reasons,
    measuredFeatures,
  };
}

/**
 * Normalizes an incident object to guarantee valid IDs and fields.
 */
export function normalizeIncident(inc) {
  if (!inc || typeof inc !== 'object') return inc;
  const id = inc.id || inc.incident_id || inc._id;
  const title = inc.title || `Incident: ${inc.primary_source_ip || 'Security Alert'}`;
  const severity = (inc.severity || 'MEDIUM').toUpperCase();
  const status = inc.status || 'open';
  const summary = inc.summary || (inc.correlation_reasons ? inc.correlation_reasons.join('; ') : 'Correlated network behavioral anomaly alert.');
  const firstObserved = inc.firstObserved || inc.first_observed || inc.created_at || new Date().toISOString();
  const lastObserved = inc.lastObserved || inc.last_observed || inc.updated_at || new Date().toISOString();
  const affectedHosts = inc.affectedHosts || (inc.primary_source_ip ? [inc.primary_source_ip] : []);
  const assignedAnalyst = inc.assignedAnalyst || 'SecOps AI Agent';
  
  let evidenceTimeline = Array.isArray(inc.evidenceTimeline) ? inc.evidenceTimeline : [];
  if (evidenceTimeline.length === 0 && Array.isArray(inc.evidence)) {
    evidenceTimeline = inc.evidence.map((e) => ({
      timestamp: e.timestamp || firstObserved,
      event: `${e.source_ip || ''}:${e.source_port || ''} -> ${e.destination_ip || ''}:${e.destination_port || ''} (${e.protocol || 'TCP'}) [${e.conn_state || 'FLOW'}]`,
      source: e.source_ip || 'Host',
    }));
  }

  return {
    ...inc,
    id,
    incident_id: id,
    title,
    severity,
    status,
    summary,
    firstObserved,
    first_observed: firstObserved,
    lastObserved,
    last_observed: lastObserved,
    affectedHosts,
    assignedAnalyst,
    evidenceTimeline,
  };
}

/**
 * Normalizes a network event object.
 */
export function normalizeEvent(evt) {
  if (!evt || typeof evt !== 'object') return evt;
  const unwrapped = evt.event && typeof evt.event === 'object' ? { ...evt.event, ...evt } : evt;

  const id = unwrapped.id || unwrapped.event_id || unwrapped._id || unwrapped.uid;
  const sourceIp = unwrapped.sourceIp || unwrapped.source_ip || unwrapped['id.orig_h'] || unwrapped.orig_h || unwrapped.src_ip || unwrapped.source || 'N/A';
  const rawSourcePort = unwrapped.sourcePort ?? unwrapped.source_port ?? unwrapped['id.orig_p'] ?? unwrapped.orig_p ?? unwrapped.src_port ?? null;
  const sourcePort = rawSourcePort !== null && rawSourcePort !== undefined && rawSourcePort !== '-' ? Number(rawSourcePort) : null;

  const destinationIp = unwrapped.destinationIp || unwrapped.destination_ip || unwrapped['id.resp_h'] || unwrapped.resp_h || unwrapped.dest_ip || unwrapped.destination || 'N/A';
  const rawDestPort = unwrapped.destinationPort ?? unwrapped.destination_port ?? unwrapped['id.resp_p'] ?? unwrapped.resp_p ?? unwrapped.dest_port ?? null;
  const destinationPort = rawDestPort !== null && rawDestPort !== undefined && rawDestPort !== '-' ? Number(rawDestPort) : null;

  const protocol = (unwrapped.protocol || unwrapped.proto || 'tcp').toUpperCase();
  const connState = unwrapped.conn_state || unwrapped.state || null;

  let durationMs = unwrapped.durationMs !== undefined
    ? unwrapped.durationMs
    : (unwrapped.duration !== null && unwrapped.duration !== undefined && unwrapped.duration !== '-'
        ? Number(unwrapped.duration) * 1000
        : null);

  if (durationMs === null && (connState === 'REJ' || connState === 'S0')) {
    durationMs = 0;
  }

  const rawBytesIn = unwrapped.bytesIn !== undefined ? unwrapped.bytesIn : (unwrapped.inbound_bytes !== undefined ? unwrapped.inbound_bytes : unwrapped.resp_bytes);
  const bytesIn = rawBytesIn !== null && rawBytesIn !== undefined && rawBytesIn !== '-' ? Number(rawBytesIn) : null;

  const rawBytesOut = unwrapped.bytesOut !== undefined ? unwrapped.bytesOut : (unwrapped.outbound_bytes !== undefined ? unwrapped.outbound_bytes : unwrapped.orig_bytes);
  const bytesOut = rawBytesOut !== null && rawBytesOut !== undefined && rawBytesOut !== '-' ? Number(rawBytesOut) : null;

  let packets = unwrapped.packets ?? unwrapped.total_packets ?? null;
  if (packets === null && (unwrapped.orig_pkts !== undefined || unwrapped.resp_pkts !== undefined)) {
    const origP = Number(unwrapped.orig_pkts) || 0;
    const respP = Number(unwrapped.resp_pkts) || 0;
    if (origP > 0 || respP > 0) packets = origP + respP;
  }
  if (packets === null && unwrapped.history && typeof unwrapped.history === 'string') {
    packets = unwrapped.history.length;
  }
  if (packets === null && (connState === 'REJ' || connState === 'S0')) {
    packets = 1;
  }
  if (packets === null && (bytesIn !== null || bytesOut !== null)) {
    const totalBytes = (bytesIn || 0) + (bytesOut || 0);
    if (totalBytes > 0) {
      packets = Math.max(1, Math.ceil(totalBytes / 1460) + (connState === 'SF' ? 3 : 0));
    }
  }

  return {
    ...unwrapped,
    id,
    event_id: id,
    sourceIp,
    source_ip: sourceIp,
    sourcePort,
    source_port: sourcePort,
    destinationIp,
    destination_ip: destinationIp,
    destinationPort,
    destination_port: destinationPort,
    protocol,
    conn_state: connState,
    durationMs,
    bytesIn,
    bytesOut,
    packets,
  };
}

/**
 * Handle API responses according to the specification:
 * { success: true, data: { ... } }
 * { success: false, error: { code, message } }
 */
async function handleRequest(requestPromise, fallbackData = null, options = {}) {
  try {
    const response = await requestPromise;
    notifyStatus(true);
    if (response.data && response.data.success !== undefined) {
      if (response.data.success) {
        const payload = response.data.data;
        if (payload && typeof payload === 'object' && Array.isArray(payload.items)) {
          if (!payload.events) payload.events = payload.items;
          if (!payload.anomalies) payload.anomalies = payload.items;
          if (!payload.incidents) payload.incidents = payload.items;
        }
        return { success: true, data: payload, isDemo: false };
      }
      return {
        success: false,
        error: response.data.error || { code: 'API_ERROR', message: 'Unknown backend error' },
        isDemo: false,
      };
    }
    // Handle standard direct json response
    return { success: true, data: response.data, isDemo: false };
  } catch (error) {
    console.warn(`[NetSutra API] Request failed: ${error.message}`);
    const isNetworkError = !error.response || error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED';
    if (isNetworkError) {
      notifyStatus(false);
    }

    // If options allow demo fallback when backend is unreachable
    if (isNetworkError && fallbackData !== null) {
      const data = typeof fallbackData === 'function' ? fallbackData() : fallbackData;
      if (data && typeof data === 'object') {
        if (data.anomalies && !data.items) data.items = data.anomalies;
        if (data.events && !data.items) data.items = data.events;
        if (data.incidents && !data.items) data.items = data.incidents;
      }
      return {
        success: true,
        data,
        isDemo: true,
        backendOffline: true,
        error: {
          code: 'BACKEND_OFFLINE',
          message: 'Backend server at ' + BASE_URL + ' is unreachable. Showing labeled demo data.',
        },
      };
    }

    // Format expected backend error or generic error
    const backendError = error.response?.data?.error || {
      code: error.code || 'REQUEST_FAILED',
      message: error.response?.data?.message || error.message || 'An error occurred while connecting to NetSutra backend.',
    };

    return {
      success: false,
      error: backendError,
      status: error.response?.status,
      isDemo: false,
    };
  }
}

/**
 * NetSutra API Service Layer
 */
export const netSutraApi = {
  // GET /api/health
  async getHealth() {
    return handleRequest(apiClient.get('/api/health'), { status: 'healthy', timestamp: new Date().toISOString() });
  },

  // GET /api/dashboard/summary
  async getDashboardSummary() {
    const res = await handleRequest(apiClient.get('/api/dashboard/summary'), DEMO_SUMMARY);
    if (res.success && res.data) {
      if (Array.isArray(res.data.recentAnomalies)) {
        res.data.recentAnomalies = res.data.recentAnomalies.map(normalizeAnomaly);
      }
      if (Array.isArray(res.data.criticalIncidentsList)) {
        res.data.criticalIncidentsList = res.data.criticalIncidentsList.map(normalizeIncident);
      }
    }
    return res;
  },

  // GET /api/events
  async getEvents(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.protocol && params.protocol !== 'ALL') query.append('protocol', params.protocol);
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.sortBy) query.append('sortBy', params.sortBy);
    if (params.sortOrder) query.append('sortOrder', params.sortOrder);

    const queryString = query.toString();
    const endpoint = `/api/events${queryString ? `?${queryString}` : ''}`;

    const res = await handleRequest(apiClient.get(endpoint), () => {
      let filtered = [...DEMO_EVENTS];
      if (params.search) {
        const q = params.search.toLowerCase();
        filtered = filtered.filter(
          (e) =>
            e.sourceIp?.toLowerCase().includes(q) ||
            e.destinationIp?.toLowerCase().includes(q) ||
            e.id?.toLowerCase().includes(q)
        );
      }
      if (params.protocol && params.protocol !== 'ALL') {
        filtered = filtered.filter((e) => e.protocol?.toUpperCase() === params.protocol.toUpperCase());
      }
      return {
        events: filtered,
        items: filtered,
        total: filtered.length,
        page: params.page || 1,
        limit: params.limit || 10,
      };
    });

    if (res.success && res.data) {
      if (Array.isArray(res.data.items)) res.data.items = res.data.items.map(normalizeEvent);
      if (Array.isArray(res.data.events)) res.data.events = res.data.events.map(normalizeEvent);
      if (Array.isArray(res.data)) res.data = res.data.map(normalizeEvent);
    }
    return res;
  },

  // GET /api/anomalies
  async getAnomalies(params = {}) {
    const query = new URLSearchParams();
    if (params.severity && params.severity !== 'ALL') query.append('severity', params.severity);
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.search) query.append('search', params.search);

    const queryString = query.toString();
    const endpoint = `/api/anomalies${queryString ? `?${queryString}` : ''}`;

    const res = await handleRequest(apiClient.get(endpoint), () => {
      let filtered = [...DEMO_ANOMALIES];
      if (params.severity && params.severity !== 'ALL') {
        filtered = filtered.filter((a) => a.severity === params.severity);
      }
      if (params.status && params.status !== 'ALL') {
        filtered = filtered.filter((a) => a.investigationStatus === params.status);
      }
      if (params.search) {
        const q = params.search.toLowerCase();
        filtered = filtered.filter(
          (a) =>
            a.id.toLowerCase().includes(q) ||
            a.vector.toLowerCase().includes(q) ||
            a.sourceIp.includes(q) ||
            a.destinationIp.includes(q)
        );
      }
      return {
        anomalies: filtered,
        items: filtered,
        total: filtered.length,
        page: params.page || 1,
        limit: params.limit || 10,
      };
    });

    if (res.success && res.data) {
      if (Array.isArray(res.data.items)) res.data.items = res.data.items.map(normalizeAnomaly);
      if (Array.isArray(res.data.anomalies)) res.data.anomalies = res.data.anomalies.map(normalizeAnomaly);
      if (Array.isArray(res.data)) res.data = res.data.map(normalizeAnomaly);
    }
    return res;
  },

  // GET /api/anomalies/:id
  async getAnomalyById(id) {
    if (!id || id === 'undefined') {
      return {
        success: false,
        error: { code: 'INVALID_ID', message: 'No anomaly ID provided.' },
      };
    }
    const res = await handleRequest(
      apiClient.get(`/api/anomalies/${id}`),
      () => DEMO_ANOMALIES.find((a) => a.id === id) || DEMO_ANOMALIES[0]
    );
    if (res.success && res.data) {
      res.data = normalizeAnomaly(res.data);
    }
    return res;
  },

  // POST /api/anomalies/:id/investigate
  async investigateAnomaly(id, provider = undefined) {
    if (!id || id === 'undefined') {
      return {
        success: false,
        error: { code: 'INVALID_ID', message: 'No anomaly ID provided for AI investigation.' },
      };
    }
    const body = provider ? { provider } : {};
    return handleRequest(
      apiClient.post(`/api/anomalies/${id}/investigate`, body, { timeout: 120000 }),
      null
    );
  },

  // POST /api/incidents/:id/explain
  async explainIncident(id, provider = undefined) {
    if (!id || id === 'undefined') {
      return {
        success: false,
        error: { code: 'INVALID_ID', message: 'No incident ID provided for AI investigation.' },
      };
    }
    const body = provider ? { provider } : {};
    return handleRequest(
      apiClient.post(`/api/incidents/${id}/explain`, body, { timeout: 120000 }),
      null
    );
  },

  // GET /api/incidents
  async getIncidents(params = {}) {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.severity && params.severity !== 'ALL') query.append('severity', params.severity);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);

    const queryString = query.toString();
    const endpoint = `/api/incidents${queryString ? `?${queryString}` : ''}`;

    const res = await handleRequest(apiClient.get(endpoint), () => {
      let filtered = [...DEMO_INCIDENTS];
      if (params.status && params.status !== 'ALL') {
        filtered = filtered.filter((i) => i.status === params.status);
      }
      if (params.severity && params.severity !== 'ALL') {
        filtered = filtered.filter((i) => i.severity === params.severity);
      }
      return {
        incidents: filtered,
        items: filtered,
        total: filtered.length,
      };
    });

    if (res.success && res.data) {
      if (Array.isArray(res.data.items)) res.data.items = res.data.items.map(normalizeIncident);
      if (Array.isArray(res.data.incidents)) res.data.incidents = res.data.incidents.map(normalizeIncident);
      if (Array.isArray(res.data)) res.data = res.data.map(normalizeIncident);
    }
    return res;
  },

  // GET /api/incidents/:id
  async getIncidentById(id) {
    if (!id || id === 'undefined') {
      return {
        success: false,
        error: { code: 'INVALID_ID', message: 'No incident ID provided.' },
      };
    }
    const res = await handleRequest(
      apiClient.get(`/api/incidents/${id}`),
      () => DEMO_INCIDENTS.find((i) => i.id === id) || DEMO_INCIDENTS[0]
    );
    if (res.success && res.data) {
      res.data = normalizeIncident(res.data);
    }
    return res;
  },

  // PATCH /api/incidents/:id/status
  async updateIncidentStatus(id, status) {
    if (!id || id === 'undefined') {
      return {
        success: false,
        error: { code: 'INVALID_ID', message: 'No incident ID provided.' },
      };
    }
    return handleRequest(
      apiClient.patch(`/api/incidents/${id}/status`, { status }),
      () => {
        const inc = DEMO_INCIDENTS.find((i) => i.id === id);
        if (inc) inc.status = status;
        return { id, status, updatedAt: new Date().toISOString() };
      }
    );
  },

  // GET /api/settings/ai-provider
  async getAiProviderSettings() {
    return handleRequest(apiClient.get('/api/settings/ai-provider'), {
      provider: 'gemma-api',
      configuredAt: '2026-10-24T10:00:00Z',
    });
  },

  // PUT /api/settings/ai-provider
  async updateAiProviderSettings(provider) {
    return handleRequest(
      apiClient.put('/api/settings/ai-provider', { provider }),
      { provider, updated: true, timestamp: new Date().toISOString() }
    );
  },

  // GET /api/ai/providers/status
  async getAiProvidersStatus() {
    const res = await handleRequest(apiClient.get('/api/ai/providers/status', { timeout: 15000 }), {
      providers: DEMO_AI_PROVIDERS,
      activeProvider: 'gemma-api',
    });
    if (res.success && res.data) {
      const raw = res.data.providers || res.data;
      if (raw && !Array.isArray(raw) && typeof raw === 'object') {
        res.data.providersList = Object.entries(raw).map(([id, info]) => {
          const isAvail =
            typeof info === 'object' && info !== null
              ? (info.available !== undefined ? Boolean(info.available) : info.status === 'available')
              : Boolean(info);
          return {
            id,
            ...(typeof info === 'object' && info !== null ? info : {}),
            available: isAvail,
            status: isAvail ? 'available' : 'unavailable',
          };
        });
      }
    }
    return res;
  },

  // POST /api/events/ingest (Replay sample Zeek attack logs)
  async ingestSampleTelemetry() {
    return handleRequest(apiClient.post('/api/events/ingest', SAMPLE_ZEEK_LOGS), () => ({
      ingested_events: SAMPLE_ZEEK_LOGS.length,
      anomalies_detected: 2,
      incidents_created: 1,
      isDemo: true,
    }));
  },

  // POST /api/events/ingest (Upload file or raw log content)
  async uploadZeekLogs(fileOrContent) {
    if (fileOrContent instanceof File) {
      try {
        // Read text directly from File object (supports .log, .json, .txt, TSV)
        const textContent = await fileOrContent.text();
        return handleRequest(
          apiClient.post('/api/events/ingest', textContent, {
            headers: { 'Content-Type': 'text/plain' },
          })
        );
      } catch {
        // Fallback to FormData with auto-boundary (Content-Type: undefined)
        const formData = new FormData();
        formData.append('file', fileOrContent);
        return handleRequest(
          apiClient.post('/api/events/ingest', formData, {
            headers: { 'Content-Type': undefined },
          })
        );
      }
    } else if (typeof fileOrContent === 'string') {
      return handleRequest(
        apiClient.post('/api/events/ingest', fileOrContent, {
          headers: { 'Content-Type': 'text/plain' },
        })
      );
    } else {
      return handleRequest(apiClient.post('/api/events/ingest', fileOrContent));
    }
  },
};

export default netSutraApi;
