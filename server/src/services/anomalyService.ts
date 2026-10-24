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
    const res = await anomalyRepository.find(filter);
    await this.enrichAnomalies(res.items);
    return res;
  }

  async getAnomalyById(id: string): Promise<Anomaly> {
    const anomaly = await anomalyRepository.findById(id);
    if (!anomaly) {
      throw new AppError(404, 'ANOMALY_NOT_FOUND', `Anomaly with ID '${id}' was not found.`);
    }
    await this.enrichAnomalies([anomaly]);
    return anomaly;
  }

  private async enrichAnomalies(anomalies: Anomaly[]): Promise<void> {
    if (!anomalies || anomalies.length === 0) return;
    const missingAnoms = anomalies.filter(
      a => !a.source_ip || !a.destination_ip || a.source_ip === 'N/A' || a.destination_ip === 'N/A'
    );
    if (missingAnoms.length === 0) return;

    const allEventIds = Array.from(new Set(missingAnoms.flatMap(a => a.evidence_event_ids || [])));
    const events = allEventIds.length > 0 ? await eventRepository.findManyByIds(allEventIds) : [];
    const eventMap = new Map(events.map(e => [e.event_id, e]));

    for (const anom of missingAnoms) {
      let matchedEvt: any = null;
      if (anom.evidence_event_ids && anom.evidence_event_ids.length > 0) {
        for (const evtId of anom.evidence_event_ids) {
          if (eventMap.has(evtId)) {
            matchedEvt = eventMap.get(evtId);
            break;
          }
        }
      }

      if (matchedEvt) {
        anom.source_ip = anom.source_ip || matchedEvt.source_ip;
        anom.destination_ip = anom.destination_ip || matchedEvt.destination_ip;
        anom.source_port = anom.source_port ?? matchedEvt.source_port;
        anom.destination_port = anom.destination_port ?? matchedEvt.destination_port;
        if (!anom.features) anom.features = {};
        anom.features.source_ip = anom.features.source_ip || matchedEvt.source_ip;
        anom.features.destination_ip = anom.features.destination_ip || matchedEvt.destination_ip;
        anom.features.source_port = anom.features.source_port ?? matchedEvt.source_port;
        anom.features.destination_port = anom.features.destination_port ?? matchedEvt.destination_port;
      }
    }
  }

  async investigateAnomaly(id: string, requestedProvider?: any): Promise<InvestigateResponse> {
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

    // 2. Retrieve the currently selected AI provider or user-requested override
    const provider = requestedProvider || (await settingsRepository.getSelectedProvider()) || 'gemma-api';

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
