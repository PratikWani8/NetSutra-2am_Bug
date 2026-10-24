import { incidentRepository } from '../repositories/incidentRepository';
import { anomalyRepository } from '../repositories/anomalyRepository';
import { eventRepository } from '../repositories/eventRepository';
import { socketService } from './socketService';
import { Incident, IncidentQueryFilter, IncidentStatus } from '../types/incidents';
import { Anomaly } from '../types/anomalies';
import { NetworkEvent } from '../types/events';
import { PaginatedResult } from '../types/common';
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
}

export const incidentService = new IncidentService();
