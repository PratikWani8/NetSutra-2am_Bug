import { Client } from '@opensearch-project/opensearch';
import { env } from './env';
import { logger } from '../utils/logger';

export const INDEX_EVENTS = 'netsutra-events';
export const INDEX_ANOMALIES = 'netsutra-anomalies';
export const INDEX_INCIDENTS = 'netsutra-incidents';

export const opensearchClient = new Client({
  node: env.OPENSEARCH_URL,
  requestTimeout: 5000,
  maxRetries: 2
});

export const EVENTS_INDEX_MAPPING = {
  mappings: {
    properties: {
      event_id: { type: 'keyword' },
      timestamp: { type: 'date' },
      source_ip: { type: 'keyword' }, // keyword allows both IPv4 & IPv6 or host lookup
      destination_ip: { type: 'keyword' },
      source_port: { type: 'integer' },
      destination_port: { type: 'integer' },
      protocol: { type: 'keyword' },
      service: { type: 'keyword' },
      outbound_bytes: { type: 'long' },
      inbound_bytes: { type: 'long' },
      duration: { type: 'float' },
      conn_state: { type: 'keyword' },
      history: { type: 'keyword' },
      missed_bytes: { type: 'long' },
      metadata: { type: 'object', dynamic: true }
    }
  }
};

export const ANOMALIES_INDEX_MAPPING = {
  mappings: {
    properties: {
      anomaly_id: { type: 'keyword' },
      timestamp: { type: 'date' },
      score: { type: 'float' },
      severity: { type: 'keyword' },
      method: { type: 'keyword' },
      reasons: { type: 'text' },
      features: { type: 'object', dynamic: true },
      evidence_event_ids: { type: 'keyword' },
      baseline_confidence: { type: 'keyword' }
    }
  }
};

export const INCIDENTS_INDEX_MAPPING = {
  mappings: {
    properties: {
      incident_id: { type: 'keyword' },
      title: { type: 'text' },
      anomaly_ids: { type: 'keyword' },
      evidence_event_ids: { type: 'keyword' },
      correlation_reasons: { type: 'text' },
      first_observed: { type: 'date' },
      last_observed: { type: 'date' },
      severity: { type: 'keyword' },
      summary: { type: 'text' },
      status: { type: 'keyword' },
      primary_source_ip: { type: 'keyword' },
      primary_destination_ip: { type: 'keyword' },
      evidence: { type: 'object', dynamic: true },
      investigation: { type: 'object', dynamic: true },
      created_at: { type: 'date' },
      updated_at: { type: 'date' }
    }
  }
};

let opensearchConnected = false;

export function isOpenSearchConnected(): boolean {
  return opensearchConnected;
}

export function setOpenSearchConnected(connected: boolean): void {
  opensearchConnected = connected;
}

export async function checkOpenSearchHealth(): Promise<boolean> {
  try {
    const health = await opensearchClient.cluster.health();
    opensearchConnected = health.statusCode === 200 || health.body?.status !== 'red';
    return opensearchConnected;
  } catch (error: any) {
    opensearchConnected = false;
    logger.debug(`OpenSearch ping failed: ${error.message}`);
    return false;
  }
}

export async function initializeIndices(): Promise<void> {
  const isHealthy = await checkOpenSearchHealth();
  if (!isHealthy) {
    logger.warn(`OpenSearch is not currently reachable at ${env.OPENSEARCH_URL}. Using resilient storage fallback.`);
    return;
  }

  const indices = [
    { name: INDEX_EVENTS, mapping: EVENTS_INDEX_MAPPING },
    { name: INDEX_ANOMALIES, mapping: ANOMALIES_INDEX_MAPPING },
    { name: INDEX_INCIDENTS, mapping: INCIDENTS_INDEX_MAPPING }
  ];

  for (const { name, mapping } of indices) {
    try {
      const exists = await opensearchClient.indices.exists({ index: name });
      if (!exists.body) {
        await opensearchClient.indices.create({
          index: name,
          body: mapping as any
        });
        logger.info(`Created OpenSearch index: ${name}`);
      }
    } catch (err: any) {
      logger.error(`Error initializing index ${name}: ${err.message}`);
    }
  }
}
