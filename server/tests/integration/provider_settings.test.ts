import request from 'supertest';
import { app } from '../../src/app';

describe('AI Provider Settings API Integration Tests', () => {
  it('should get current AI provider configuration', async () => {
    const res = await request(app).get('/api/settings/ai-provider');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.provider).toBeDefined();
    expect(['gemma-api', 'ollama']).toContain(res.body.data.provider);
    expect(res.body.data.available_providers).toEqual(['gemma-api', 'ollama']);
  });

  it('should allow manually switching AI provider to ollama and persist it', async () => {
    const putRes = await request(app)
      .put('/api/settings/ai-provider')
      .send({ provider: 'ollama' });

    expect(putRes.status).toBe(200);
    expect(putRes.body.success).toBe(true);
    expect(putRes.body.data.provider).toBe('ollama');

    // Verify persistence with a subsequent GET
    const getRes = await request(app).get('/api/settings/ai-provider');
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.provider).toBe('ollama');
  });

  it('should reject invalid provider identifiers with 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .put('/api/settings/ai-provider')
      .send({ provider: 'chatgpt-unsupported' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should allow manually switching back to gemma-api', async () => {
    const putRes = await request(app)
      .put('/api/settings/ai-provider')
      .send({ provider: 'gemma-api' });

    expect(putRes.status).toBe(200);
    expect(putRes.body.success).toBe(true);
    expect(putRes.body.data.provider).toBe('gemma-api');
  });

  it('should return providers health and availability status from /api/ai/providers/status', async () => {
    const res = await request(app).get('/api/ai/providers/status');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.providers).toBeDefined();
    expect(res.body.data.providers['gemma-api']).toBeDefined();
    expect(res.body.data.providers['ollama']).toBeDefined();
    expect(res.body.data.selected_provider).toBeDefined();
  });
});
