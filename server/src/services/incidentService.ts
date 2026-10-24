import { incidentRepository } from '../repositories/incidentRepository';
import { anomalyRepository } from '../repositories/anomalyRepository';
import { eventRepository } from '../repositories/eventRepository';
import { settingsRepository } from '../repositories/settingsRepository';
import { aiService } from './aiService';
import { socketService } from './socketService';
import { Incident, IncidentQueryFilter, IncidentStatus } from '../types/incidents';
import { Anomaly } from '../types/anomalies';
import { NetworkEvent } from '../types/events';
import { PaginatedResult } from '../types/common';
import { IncidentContext, InvestigateResponse, SupportedProvider } from '../types/investigation';
import { AppError } from '../utils/response';
import { logger } from '../utils/logger';

export interface HydratedIncident extends Incident {
  anomalies?: Anomaly[];
  events?: NetworkEvent[];
}

export class IncidentService {
  async listIncidents(filter: IncidentQueryFilter): Promise<PaginatedResult<Incident>> {
    return incidentRepository.find(filter);
  }

  async getIncidentById(id: string): Promise<HydratedIncident> {
    const incident = await incidentRepository.findById(id);
    if (!incident) {
      throw new AppError(404, 'INCIDENT_NOT_FOUND', `Incident with ID '${id}' was not found.`);
    }

    // Link related anomalies
    const anomalies: Anomaly[] = [];
    if (incident.anomaly_ids && incident.anomaly_ids.length > 0) {
      for (const anomId of incident.anomaly_ids) {
        const anom = await anomalyRepository.findById(anomId);
        if (anom) {
          anomalies.push(anom);
        }
      }
    }

    // Link supporting network events
    let events: NetworkEvent[] = [];
    if (incident.evidence_event_ids && incident.evidence_event_ids.length > 0) {
      events = await eventRepository.findManyByIds(incident.evidence_event_ids);
    }

    return {
      ...incident,
      anomalies,
      events
    };
  }

  async updateIncidentStatus(id: string, status: IncidentStatus): Promise<Incident> {
    const updated = await incidentRepository.updateStatus(id, status);
    if (!updated) {
      throw new AppError(404, 'INCIDENT_NOT_FOUND', `Incident with ID '${id}' was not found.`);
    }

    logger.info(`Incident ${id} status updated to '${status}'.`);

    // Emit real-time update
    socketService.emitIncidentUpdated(updated);

    return updated;
  }

  async explainIncident(id: string, requestedProvider?: SupportedProvider): Promise<InvestigateResponse> {
    const incident = await this.getIncidentById(id);
    const provider = requestedProvider || (await settingsRepository.getSelectedProvider()) || 'gemma-api';

    const formattedEvidence = (incident.events || []).map(evt => ({
      event_id: evt.event_id,
      timestamp: evt.timestamp,
      source_ip: evt.source_ip,
      destination_ip: evt.destination_ip,
      source_port: evt.source_port,
      destination_port: evt.destination_port,
      protocol: evt.protocol,
      service: evt.service,
      outbound_bytes: evt.outbound_bytes,
      inbound_bytes: evt.inbound_bytes,
      duration: evt.duration,
      conn_state: evt.conn_state
    }));

    const incidentContext: IncidentContext = {
      incident_id: incident.incident_id,
      anomaly_ids: incident.anomaly_ids || [],
      evidence: formattedEvidence,
      summary: incident.summary,
      title: incident.title,
      severity: incident.severity
    };

    socketService.emitAiStatus(provider, 'investigating', {
      incident_id: incident.incident_id
    });

    try {
      logger.info(`Dispatching incident explanation for ${id} using provider '${provider}'...`);
      const result = await aiService.investigate(provider, incidentContext);
      socketService.emitAiStatus(provider, 'completed', {
        incident_id: incident.incident_id
      });
      return result;
    } catch (err: any) {
      logger.warn(`AI Provider incident explanation failed: ${err.message}`);
      socketService.emitAiStatus(provider, 'error', {
        incident_id: incident.incident_id,
        error: err.message
      });
      throw err;
    }
  }
}

export const incidentService = new IncidentService();
