import request from 'supertest';
import { app } from '../../src/app';
import { anomalyRepository } from '../../src/repositories/anomalyRepository';
import { eventRepository } from '../../src/repositories/eventRepository';
import { aiService } from '../../src/services/aiService';
import { settingsRepository } from '../../src/repositories/settingsRepository';
import { Anomaly } from '../../src/types/anomalies';
import { NetworkEvent } from '../../src/types/events';

describe('Anomalies & AI Investigation API Integration Tests', () => {
  const testAnomalyId = 'anom-inv-test-101';
  const testEventId = 'evt-inv-test-101';

  beforeAll(async () => {
    // 1. Seed supporting event
    const event: NetworkEvent = {
      event_id: testEventId,
      timestamp: new Date().toISOString(),
      source_ip: '192.0.2.77',
      destination_ip: '198.51.100.99',
      source_port: 50123,
      destination_port: 443,
      protocol: 'tcp',
      outbound_bytes: 85000000,
      conn_state: 'SF'
    };
    await eventRepository.save(event);

    // 2. Seed anomaly
    const anomaly: Anomaly = {
      anomaly_id: testAnomalyId,
      timestamp: new Date().toISOString(),
      score: 0.92,
      severity: 'high',
      method: 'outbound_volume_deviation',
      reasons: ['Extreme outbound byte ratio (34x baseline)'],
      features: { outbound_bytes: 85000000, baseline_mean: 2500000 },
      evidence_event_ids: [testEventId],
      baseline_confidence: 'high'
    };
    await anomalyRepository.save(anomaly);
  });

  describe('GET /api/anomalies', () => {
    it('should list anomalies with pagination and filtering', async () => {
      const res = await request(app)
        .get('/api/anomalies')
        .query({ severity: 'high', page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.items.some((a: any) => a.anomaly_id === testAnomalyId)).toBe(true);
    });
  });

  describe('GET /api/anomalies/:id', () => {
    it('should retrieve anomaly by ID', async () => {
      const res = await request(app).get(`/api/anomalies/${testAnomalyId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.anomaly_id).toBe(testAnomalyId);
      expect(res.body.data.method).toBe('outbound_volume_deviation');
      expect(res.body.data.features.outbound_bytes).toBe(85000000);
    });

    it('should return 404 for non-existent anomaly', async () => {
      const res = await request(app).get('/api/anomalies/anom-does-not-exist');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ANOMALY_NOT_FOUND');
    });
  });

  describe('POST /api/anomalies/:id/investigate', () => {
    it('should call Python AI service with selected provider and return grounded investigation result', async () => {
      await settingsRepository.setSelectedProvider('gemma-api');

      // Mock AI service investigation response
      const mockInvestigationResponse = {
        incident_id: `inc-${testAnomalyId}`,
        provider: 'gemma-api',
        model: 'gemma-2-9b-it',
        summary: 'Host 192.0.2.77 transmitted an abnormal outbound payload.',
        observed_evidence: ['85 MB transmitted in a single connection to 198.51.100.99.'],
        possible_explanations: [
          'Benign backup archive synchronization.',
          'Unauthorized data staging or exfiltration attempt.'
        ],
        recommended_checks: [
          'Verify if the destination IP corresponds to an authorized cloud backup endpoint.'
        ],
        uncertainties: [
          'Payload encryption prevents inspection of transmitted file contents.'
        ],
        created_at: new Date().toISOString()
      };

      const spy = jest
        .spyOn(aiService, 'investigate')
        .mockResolvedValueOnce(mockInvestigationResponse);

      const res = await request(app).post(`/api/anomalies/${testAnomalyId}/investigate`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.provider).toBe('gemma-api');
      expect(res.body.data.summary).toContain('abnormal outbound payload');
      expect(res.body.data.observed_evidence.length).toBeGreaterThan(0);
      expect(res.body.data.possible_explanations.length).toBeGreaterThan(0);

      // Verify that the currently selected provider was explicitly passed
      expect(spy).toHaveBeenCalledWith(
        'gemma-api',
        expect.objectContaining({
          incident_id: `inc-${testAnomalyId}`,
          anomaly_ids: [testAnomalyId],
          evidence: expect.arrayContaining([
            expect.objectContaining({ event_id: testEventId })
          ])
        })
      );

      spy.mockRestore();
    });

    it('should return PROVIDER_UNAVAILABLE error and NOT silently switch providers when provider fails', async () => {
      await settingsRepository.setSelectedProvider('ollama');

      // Simulate provider failure from AI service
      const error: any = new Error('Local Ollama daemon is unreachable');
      error.isAxiosError = true;
      error.response = {
        status: 503,
        data: {
          detail: 'Local Ollama daemon is unreachable on http://localhost:11434'
        }
      };

      const spy = jest
        .spyOn(aiService, 'investigate')
        .mockRejectedValueOnce(error);

      const res = await request(app).post(`/api/anomalies/${testAnomalyId}/investigate`);

      expect([502, 503]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('PROVIDER_UNAVAILABLE');
      expect(res.body.error.message).toContain('Ollama');

      // Verify provider remained ollama (did not silently switch)
      const currentProvider = await settingsRepository.getSelectedProvider();
      expect(currentProvider).toBe('ollama');

      spy.mockRestore();
    });
  });
});
