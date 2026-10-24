import axios from 'axios';
import {
  DEMO_SUMMARY,
  DEMO_ANOMALIES,
  DEMO_EVENTS,
  DEMO_INCIDENTS,
  DEMO_AI_PROVIDERS,
} from '../data/mockData';

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
        return { success: true, data: response.data.data, isDemo: false };
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
      return {
        success: true,
        data: typeof fallbackData === 'function' ? fallbackData() : fallbackData,
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
    return handleRequest(apiClient.get('/api/dashboard/summary'), DEMO_SUMMARY);
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

    return handleRequest(apiClient.get(endpoint), () => {
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
        total: filtered.length,
        page: params.page || 1,
        limit: params.limit || 10,
      };
    });
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

    return handleRequest(apiClient.get(endpoint), () => {
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
        total: filtered.length,
        page: params.page || 1,
        limit: params.limit || 10,
      };
    });
  },

  // GET /api/anomalies/:id
  async getAnomalyById(id) {
    return handleRequest(
      apiClient.get(`/api/anomalies/${id}`),
      () => DEMO_ANOMALIES.find((a) => a.id === id) || DEMO_ANOMALIES[0]
    );
  },

  // POST /api/anomalies/:id/investigate
  async investigateAnomaly(id) {
    return handleRequest(
      apiClient.post(`/api/anomalies/${id}/investigate`),
      () => {
        const match = DEMO_ANOMALIES.find((a) => a.id === id) || DEMO_ANOMALIES[0];
        return {
          anomalyId: id,
          provider: 'gemma-api',
          generatedAt: new Date().toISOString(),
          explanation: match.aiInvestigation || {
            summary: `Automated baseline deviation analysis for ${match.vector} from source ${match.sourceIp}.`,
            observedEvidence: [
              `Detected packet frequency and metrics deviating from typical behavior.`,
              `Triggered rule: ${match.ruleId}.`,
              `Anomaly confidence score of ${match.score}.`,
            ],
            possibleExplanations: [
              `Potential anomalous network tool or automated script activity.`,
              `Burst transfer or internal sync misconfiguration.`,
              `Network diagnostic test or port scan.`,
            ],
            recommendedChecks: [
              `Correlate connection timestamp with host endpoint auth logs.`,
              `Verify if source IP belongs to approved operational inventory.`,
              `Check egress firewall blocks on destination port ${match.destinationPort || 'N/A'}.`,
            ],
            uncertaintiesAndLimitations: [
              `Packet payload was sampled; application state cannot be fully reconstructed from headers alone.`,
              `Statistical score reflects anomaly magnitude, not malicious intent.`,
            ],
          },
        };
      }
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

    return handleRequest(apiClient.get(endpoint), () => {
      let filtered = [...DEMO_INCIDENTS];
      if (params.status && params.status !== 'ALL') {
        filtered = filtered.filter((i) => i.status === params.status);
      }
      if (params.severity && params.severity !== 'ALL') {
        filtered = filtered.filter((i) => i.severity === params.severity);
      }
      return {
        incidents: filtered,
        total: filtered.length,
      };
    });
  },

  // GET /api/incidents/:id
  async getIncidentById(id) {
    return handleRequest(
      apiClient.get(`/api/incidents/${id}`),
      () => DEMO_INCIDENTS.find((i) => i.id === id) || DEMO_INCIDENTS[0]
    );
  },

  // PATCH /api/incidents/:id/status
  async updateIncidentStatus(id, status) {
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
    return handleRequest(apiClient.get('/api/ai/providers/status'), {
      providers: DEMO_AI_PROVIDERS,
      activeProvider: 'gemma-api',
    });
  },
};

export default netSutraApi;
