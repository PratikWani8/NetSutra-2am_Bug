import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import { NetworkEvent } from '../types/events';
import { Anomaly, DetectionParameters, DetectionResponse } from '../types/anomalies';
import { CorrelateResponse, CorrelationParameters } from '../types/incidents';
import { IncidentContext, InvestigateResponse, SupportedProvider } from '../types/investigation';
import { ProvidersStatusResponse } from '../types/settings';
import { AppError } from '../utils/response';
import { logger } from '../utils/logger';

export class AiService {
  private client: AxiosInstance;

  constructor(baseURL = env.AI_SERVICE_URL) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      timeout: 30000
    });
  }

  async getHealth(): Promise<{ status: string; service: string; version: string; timestamp: string }> {
    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      return response.data;
    } catch (err: any) {
      logger.warn(`AI Service health check failed: ${err.message}`);
      throw new AppError(503, 'AI_SERVICE_UNAVAILABLE', 'The Python AI service is unreachable.');
    }
  }

  async detectAnomalies(
    events: NetworkEvent[],
    baselineEvents?: NetworkEvent[],
    parameters?: DetectionParameters
  ): Promise<DetectionResponse> {
    try {
      const payload: Record<string, any> = { events };
      if (baselineEvents && baselineEvents.length > 0) {
        payload.baseline_events = baselineEvents;
      }
      if (parameters) {
        payload.parameters = parameters;
      }

      const response = await this.client.post<DetectionResponse>('/detect', payload, {
        timeout: 15000
      });
      return response.data;
    } catch (err: any) {
      this.handleServiceError(err, 'detection');
      throw err;
    }
  }

  async correlateAnomalies(
    anomalies: Anomaly[],
    events?: NetworkEvent[],
    parameters?: CorrelationParameters
  ): Promise<CorrelateResponse> {
    try {
      const payload: Record<string, any> = { anomalies };
      if (events && events.length > 0) {
        payload.events = events;
      }
      if (parameters) {
        payload.parameters = parameters;
      }

      const response = await this.client.post<CorrelateResponse>('/correlate', payload, {
        timeout: 15000
      });
      return response.data;
    } catch (err: any) {
      this.handleServiceError(err, 'correlation');
      throw err;
    }
  }

  async investigate(
    provider: SupportedProvider,
    incident: IncidentContext
  ): Promise<InvestigateResponse> {
    try {
      const payload = {
        provider,
        incident
      };

      const response = await this.client.post<InvestigateResponse>('/investigate', payload, {
        timeout: 60000 // LLMs may take up to 60s
      });
      return response.data;
    } catch (err: any) {
      this.handleServiceError(err, 'investigation', provider);
      throw err;
    }
  }

  async getProviders(): Promise<{ providers: string[]; details?: any[] }> {
    try {
      const response = await this.client.get('/providers', { timeout: 5000 });
      return response.data;
    } catch (err: any) {
      this.handleServiceError(err, 'providers list');
      throw err;
    }
  }

  async getProvidersStatus(): Promise<ProvidersStatusResponse> {
    try {
      const response = await this.client.get<ProvidersStatusResponse>('/providers/status', {
        timeout: 10000
      });
      return response.data;
    } catch (err: any) {
      this.handleServiceError(err, 'providers status');
      throw err;
    }
  }

  private handleServiceError(err: any, operation: string, provider?: SupportedProvider): never {
    if (err instanceof AppError) {
      throw err;
    }

    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      logger.error(`AI service connection refused during ${operation}`);
      throw new AppError(
        503,
        'AI_SERVICE_UNAVAILABLE',
        `The Python AI service at ${env.AI_SERVICE_URL} is unreachable.`
      );
    }

    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      logger.error(`AI service timeout during ${operation}`);
      throw new AppError(
        504,
        'AI_SERVICE_TIMEOUT',
        `The AI service timed out while processing ${operation}.`
      );
    }

    if (err.response) {
      const status = err.response.status;
      const data = err.response.data;

      // Extract details from FastAPI error response
      let message = 'Upstream AI service error';
      if (typeof data?.detail === 'string') {
        message = data.detail;
      } else if (data?.detail?.message) {
        message = data.detail.message;
      } else if (data?.error?.message) {
        message = data.error.message;
      } else if (typeof data === 'string') {
        message = data;
      }

      // If provider is unavailable or returned 502/503 during investigation
      if (operation === 'investigation' || status === 502 || status === 503) {
        logger.warn(`AI Provider failure for ${provider || 'selected provider'}: ${message}`);
        throw new AppError(
          status === 503 ? 503 : 502,
          'PROVIDER_UNAVAILABLE',
          `The selected AI provider is unavailable: ${message}`
        );
      }

      throw new AppError(status, 'AI_SERVICE_ERROR', message);
    }

    throw new AppError(500, 'AI_SERVICE_ERROR', err.message || 'An unexpected AI service error occurred.');
  }
}

export const aiService = new AiService();
