import { anomalyRepository } from '../repositories/anomalyRepository';
import { eventRepository } from '../repositories/eventRepository';
import { settingsRepository } from '../repositories/settingsRepository';
import { aiService } from './aiService';
import { socketService } from './socketService';
import { Anomaly, AnomalyQueryFilter } from '../types/anomalies';
import { InvestigateResponse } from '../types/investigation';
import { PaginatedResult } from '../types/common';
import { AppError } from '../utils/response';
import { logger } from '../utils/logger';

export class AnomalyService {
  async listAnomalies(filter: AnomalyQueryFilter): Promise<PaginatedResult<Anomaly>> {
    return anomalyRepository.find(filter);
  }

  async getAnomalyById(id: string): Promise<Anomaly> {
    const anomaly = await anomalyRepository.findById(id);
    if (!anomaly) {
      throw new AppError(404, 'ANOMALY_NOT_FOUND', `Anomaly with ID '${id}' was not found.`);
    }
    return anomaly;
  }

  async investigateAnomaly(id: string): Promise<InvestigateResponse> {
    const anomaly = await this.getAnomalyById(id);

    // 1. Retrieve supporting evidence events
    let evidenceEvents: any[] = [];
    if (anomaly.evidence_event_ids && anomaly.evidence_event_ids.length > 0) {
      evidenceEvents = await eventRepository.findManyByIds(anomaly.evidence_event_ids);
    }

    // Format evidence items
    const formattedEvidence: Array<Record<string, any>> = evidenceEvents.map(evt => ({
      event_id: evt.event_id,
      source_ip: evt.source_ip,
      destination_ip: evt.destination_ip,
      source_port: evt.source_port,
      destination_port: evt.destination_port,
      protocol: evt.protocol,
      service: evt.service,
      outbound_bytes: evt.outbound_bytes,
      inbound_bytes: evt.inbound_bytes,
      conn_state: evt.conn_state,
      timestamp: evt.timestamp,
      features: anomaly.features
    }));

    // If no evidence events were found in storage, include anomaly features as context
    if (formattedEvidence.length === 0) {
      formattedEvidence.push({
        anomaly_id: anomaly.anomaly_id,
        method: anomaly.method,
        severity: anomaly.severity,
        score: anomaly.score,
        features: anomaly.features,
        reasons: anomaly.reasons,
        timestamp: anomaly.timestamp
      });
    }

    // 2. Retrieve the currently selected AI provider
    const provider = await settingsRepository.getSelectedProvider();

    // 3. Construct the incident payload
    const incidentContext = {
      incident_id: `inc-${anomaly.anomaly_id}`,
      anomaly_ids: [anomaly.anomaly_id],
      evidence: formattedEvidence,
      summary: anomaly.reasons?.join('. ') || `Detected ${anomaly.method} anomaly with score ${anomaly.score}`,
      title: `${anomaly.method} (${anomaly.severity})`,
      severity: anomaly.severity
    };

    socketService.emitAiStatus(provider, 'investigating', {
      anomaly_id: anomaly.anomaly_id,
      incident_id: incidentContext.incident_id
    });

    try {
      logger.info(`Dispatching investigation for anomaly ${id} using provider '${provider}'...`);
      const investigationResult = await aiService.investigate(provider, incidentContext);

      socketService.emitAiStatus(provider, 'completed', {
        anomaly_id: anomaly.anomaly_id,
        incident_id: incidentContext.incident_id
      });

      return investigationResult;
    } catch (err: any) {
      socketService.emitAiStatus(provider, 'error', {
        anomaly_id: anomaly.anomaly_id,
        error: err.message
      });
      // Do not silently fallback to another provider
      throw err;
    }
  }
}

export const anomalyService = new AnomalyService();
