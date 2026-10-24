import { Server as SocketIOServer } from 'socket.io';
import { NetworkEvent } from '../types/events';
import { Anomaly } from '../types/anomalies';
import { Incident } from '../types/incidents';
import { logger } from '../utils/logger';

export class SocketService {
  private io: SocketIOServer | null = null;

  initialize(io: SocketIOServer): void {
    this.io = io;

    this.io.on('connection', (socket) => {
      logger.info(`Socket client connected: ${socket.id}`);

      // Emit initial sensor & system status on connection
      socket.emit('sensor:status', {
        sensor_id: 'zeek-collector-primary',
        status: 'active',
        timestamp: new Date().toISOString(),
        message: 'Telemetry ingestion engine ready'
      });

      socket.on('disconnect', (reason) => {
        logger.info(`Socket client disconnected: ${socket.id} (${reason})`);
      });
    });

    logger.info('Socket.IO real-time event service initialized.');
  }

  emitNetworkEvent(event: NetworkEvent): void {
    if (!this.io) return;
    this.io.emit('network:event', {
      id: event.event_id,
      timestamp: event.timestamp,
      event
    });
  }

  emitAnomalyDetected(anomaly: Anomaly): void {
    if (!this.io) return;
    this.io.emit('anomaly:detected', {
      id: anomaly.anomaly_id,
      timestamp: anomaly.timestamp,
      anomaly
    });
  }

  emitIncidentUpdated(incident: Incident): void {
    if (!this.io) return;
    this.io.emit('incident:updated', {
      id: incident.incident_id,
      timestamp: incident.updated_at,
      incident
    });
  }

  emitSensorStatus(sensorId: string, status: 'active' | 'idle' | 'ingesting' | 'error', details?: Record<string, any>): void {
    if (!this.io) return;
    this.io.emit('sensor:status', {
      sensor_id: sensorId,
      status,
      timestamp: new Date().toISOString(),
      ...(details ? { details } : {})
    });
  }

  emitAiStatus(provider: string, status: string, details?: Record<string, any>): void {
    if (!this.io) return;
    this.io.emit('ai:status', {
      provider,
      status,
      timestamp: new Date().toISOString(),
      ...(details ? { details } : {})
    });
  }

  getConnectedCount(): number {
    return this.io?.engine?.clientsCount || 0;
  }
}

export const socketService = new SocketService();
