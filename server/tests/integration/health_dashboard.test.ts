import request from 'supertest';
import { app } from '../../src/app';

describe('Health and Dashboard API Integration Tests', () => {
  describe('GET /api/health', () => {
    it('should return 200 with standard response structure and service health', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.status).toBe('healthy');
      expect(res.body.data.service).toBe('NetSutra Backend');
      expect(res.body.data.version).toBe('1.0.0');
      expect(res.body.data.services).toBeDefined();
      expect(res.body.data.services.opensearch).toBeDefined();
      expect(res.body.data.services.ai_service).toBeDefined();
      expect(res.body.data.services.socket_io).toBeDefined();
    });
  });

  describe('GET /api/dashboard/summary', () => {
    it('should return 200 with aggregated dashboard metrics and distributions', async () => {
      const res = await request(app).get('/api/dashboard/summary');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(typeof res.body.data.total_events).toBe('number');
      expect(typeof res.body.data.total_anomalies).toBe('number');
      expect(typeof res.body.data.active_incidents).toBe('number');
      expect(res.body.data.severity_breakdown).toBeDefined();
      expect(Array.isArray(res.body.data.top_source_ips)).toBe(true);
      expect(Array.isArray(res.body.data.top_destination_ips)).toBe(true);
      expect(Array.isArray(res.body.data.recent_anomalies)).toBe(true);
      expect(res.body.data.selected_ai_provider).toBeDefined();
    });
  });
});
