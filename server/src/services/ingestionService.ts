import { parseZeekLogs, normalizeZeekEvent } from '../utils/normalizer';
import { NetworkEvent } from '../types/events';
import { Anomaly } from '../types/anomalies';
import { Incident } from '../types/incidents';
import { eventRepository } from '../repositories/eventRepository';
import { anomalyRepository } from '../repositories/anomalyRepository';
import { incidentRepository } from '../repositories/incidentRepository';
import { aiService } from './aiService';
import { socketService } from './socketService';
import { logger } from '../utils/logger';

export interface IngestionResult {
  ingested_events: number;
  anomalies_detected: number;
  incidents_created: number;
  anomalies: Anomaly[];
  incidents: Incident[];
}

export class IngestionService {
  /**
   * Ingests raw Zeek log content (JSON array or newline-delimited JSON).
   */
  async ingestZeekContent(
    rawContent: string,
    options: { skipDetection?: boolean } = {}
  ): Promise<IngestionResult> {
    socketService.emitSensorStatus('zeek-sensor', 'ingesting', {
      content_length: rawContent.length
    });

    const parsedEvents = parseZeekLogs(rawContent);

    if (parsedEvents.length === 0) {
      socketService.emitSensorStatus('zeek-sensor', 'active', {
        message: 'No valid network events found in payload'
      });
      return {
        ingested_events: 0,
        anomalies_detected: 0,
        incidents_created: 0,
        anomalies: [],
        incidents: []
      };
    }

    return this.processEvents(parsedEvents, options);
  }

  /**
   * Ingests an array of raw event objects or pre-normalized events.
   */
  async ingestEventBatch(
    rawEvents: any[],
    options: { skipDetection?: boolean } = {}
  ): Promise<IngestionResult> {
    socketService.emitSensorStatus('zeek-sensor', 'ingesting', {
      batch_size: rawEvents.length
    });

    const normalizedEvents: NetworkEvent[] = [];
    for (const raw of rawEvents) {
      const normalized = normalizeZeekEvent(raw);
      if (normalized) {
        normalizedEvents.push(normalized);
      }
    }

    return this.processEvents(normalizedEvents, options);
  }

  /**
   * Core processing: persist events -> emit network:event -> detect -> persist anomalies -> emit -> correlate -> persist incidents -> emit
   */
  private async processEvents(
    events: NetworkEvent[],
    options: { skipDetection?: boolean } = {}
  ): Promise<IngestionResult> {
    // 1. Persist events into OpenSearch (idempotent using stable event IDs)
    await eventRepository.saveBatch(events);
    logger.info(`Persisted ${events.length} network events to primary repository.`);

    // 2. Broadcast network events via Socket.IO
    for (const event of events) {
      socketService.emitNetworkEvent(event);
    }

    let detectedAnomalies: Anomaly[] = [];
    let correlatedIncidents: Incident[] = [];

    // 3. Trigger behavioral anomaly detection via AI Service (if not skipped)
    if (!options.skipDetection && events.length > 0) {
      try {
        const detectionResult = await aiService.detectAnomalies(events);
        if (detectionResult?.anomalies?.length > 0) {
          detectedAnomalies = detectionResult.anomalies;

          // 4. Persist detected anomalies BEFORE broadcasting
          await anomalyRepository.saveBatch(detectedAnomalies);
          logger.info(`Persisted ${detectedAnomalies.length} detected anomalies.`);

          // 5. Broadcast detected anomalies via Socket.IO
          for (const anomaly of detectedAnomalies) {
            socketService.emitAnomalyDetected(anomaly);
          }

          // 6. Correlate anomalies into security incidents
          try {
            const correlationResult = await aiService.correlateAnomalies(detectedAnomalies, events);
            if (correlationResult?.incidents?.length > 0) {
              const formattedIncidents: Incident[] = correlationResult.incidents.map(inc => ({
                incident_id: inc.incident_id,
                title: inc.title || `Suspicious Activity on ${inc.primary_source_ip || 'network host'}`,
                anomaly_ids: inc.anomaly_ids || [],
                evidence_event_ids: inc.evidence_event_ids || [],
                correlation_reasons: inc.correlation_reasons || [],
                first_observed: inc.first_observed,
                last_observed: inc.last_observed,
                severity: inc.severity,
                summary: inc.summary,
                status: 'open',
                primary_source_ip: inc.primary_source_ip || null,
                primary_destination_ip: inc.primary_destination_ip || null,
                evidence: inc.evidence || [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }));

              await incidentRepository.saveBatch(formattedIncidents);
              logger.info(`Persisted ${formattedIncidents.length} correlated incidents.`);

              for (const incident of formattedIncidents) {
                socketService.emitIncidentUpdated(incident);
              }

              correlatedIncidents = formattedIncidents;
            }
          } catch (corrErr: any) {
            logger.warn(`Incident correlation failed: ${corrErr.message}`);
          }
        }
      } catch (detErr: any) {
        logger.warn(`Detection service call failed during ingestion: ${detErr.message}`);
      }
    }

    socketService.emitSensorStatus('zeek-sensor', 'active', {
      last_batch_size: events.length,
      anomalies_detected: detectedAnomalies.length
    });

    return {
      ingested_events: events.length,
      anomalies_detected: detectedAnomalies.length,
      incidents_created: correlatedIncidents.length,
      anomalies: detectedAnomalies,
      incidents: correlatedIncidents
    };
  }
}

export const ingestionService = new IngestionService();
