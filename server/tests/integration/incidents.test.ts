import request from 'supertest';
import { app } from '../../src/app';
import { incidentRepository } from '../../src/repositories/incidentRepository';
import { anomalyRepository } from '../../src/repositories/anomalyRepository';
import { eventRepository } from '../../src/repositories/eventRepository';
import { Incident } from '../../src/types/incidents';
import { Anomaly } from '../../src/types/anomalies';
import { NetworkEvent } from '../../src/types/events';

describe('Incidents API Integration Tests', () => {
  const testEventId = 'evt-inc-test-001';
  const testAnomalyId = 'anom-inc-test-001';
  const testIncidentId = 'inc-test-001';

  beforeAll(async () => {
    // 1. Seed event
    const event: NetworkEvent = {
      event_id: testEventId,
      timestamp: new Date().toISOString(),
      source_ip: '192.0.2.10',
      destination_ip: '198.51.100.20',
      source_port: 49152,
      destination_port: 443,
      protocol: 'tcp',
      service: 'ssl',
      outbound_bytes: 12000000,
      conn_state: 'SF'
    };
    await eventRepository.save(event);

    // 2. Seed anomaly
    const anomaly: Anomaly = {
      anomaly_id: testAnomalyId,
      timestamp: new Date().toISOString(),
      score: 0.95,
      severity: 'critical',
      method: 'outbound_volume_deviation',
      reasons: ['Outbound volume deviated significantly from historical baseline'],
      features: { z_score: 5.2, outbound_bytes: 12000000 },
      evidence_event_ids: [testEventId],
      baseline_confidence: 'high'
    };
    await anomalyRepository.save(anomaly);

    // 3. Seed incident
    const incident: Incident = {
      incident_id: testIncidentId,
      title: 'High Outbound Data Exfiltration Cluster',
      anomaly_ids: [testAnomalyId],
      evidence_event_ids: [testEventId],
      correlation_reasons: ['Shared source IP with extreme volume burst'],
      first_observed: new Date().toISOString(),
      last_observed: new Date().toISOString(),
      severity: 'critical',
      summary: 'Host 192.0.2.10 transmitted unexpected volumetric payload',
      status: 'open',
      primary_source_ip: '192.0.2.10',
      primary_destination_ip: '198.51.100.20',
      evidence: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await incidentRepository.save(incident);
  });

  describe('GET /api/incidents', () => {
    it('should return list of incidents with pagination', async () => {
      const res = await request(app).get('/api/incidents');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
    });

    it('should filter incidents by severity and status', async () => {
      const res = await request(app)
        .get('/api/incidents')
        .query({ severity: 'critical', status: 'open' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      for (const item of res.body.data.items) {
        expect(item.severity).toBe('critical');
        expect(item.status).toBe('open');
      }
    });
  });

  describe('GET /api/incidents/:id', () => {
    it('should retrieve incident and hydrate linked anomalies and supporting network events', async () => {
      const res = await request(app).get(`/api/incidents/${testIncidentId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const inc = res.body.data;
      expect(inc.incident_id).toBe(testIncidentId);
      expect(inc.status).toBe('open');

      // Verify linked anomalies
      expect(inc.anomalies).toBeDefined();
      expect(inc.anomalies.length).toBe(1);
      expect(inc.anomalies[0].anomaly_id).toBe(testAnomalyId);

      // Verify linked supporting events
      expect(inc.events).toBeDefined();
      expect(inc.events.length).toBe(1);
      expect(inc.events[0].event_id).toBe(testEventId);
    });

    it('should return 404 for non-existent incident', async () => {
      const res = await request(app).get('/api/incidents/inc-non-existent-999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INCIDENT_NOT_FOUND');
    });
  });

  describe('PATCH /api/incidents/:id/status', () => {
    it('should update incident workflow status to investigating', async () => {
      const res = await request(app)
        .patch(`/api/incidents/${testIncidentId}/status`)
        .send({ status: 'investigating' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('investigating');

      // Verify status persisted
      const getRes = await request(app).get(`/api/incidents/${testIncidentId}`);
      expect(getRes.body.data.status).toBe('investigating');
    });

    it('should reject invalid status with 400 validation error', async () => {
      const res = await request(app)
        .patch(`/api/incidents/${testIncidentId}/status`)
        .send({ status: 'invalid-status-xyz' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
