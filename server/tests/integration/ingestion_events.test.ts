import request from 'supertest';
import { app } from '../../src/app';

describe('Zeek Ingestion & Network Events API Integration Tests', () => {
  const sampleZeekBatch = [
    {
      ts: 1792843200.0,
      uid: 'test-evt-001',
      'id.orig_h': '10.0.0.15',
      'id.orig_p': 49152,
      'id.resp_h': '93.184.216.34',
      'id.resp_p': 443,
      proto: 'tcp',
      service: 'ssl',
      orig_bytes: 1500,
      resp_bytes: 4500,
      conn_state: 'SF'
    },
    {
      ts: 1792843205.0,
      uid: 'test-evt-002',
      'id.orig_h': '10.0.0.15',
      'id.orig_p': 49153,
      'id.resp_h': '1.1.1.1',
      'id.resp_p': 53,
      proto: 'udp',
      service: 'dns',
      orig_bytes: 65,
      resp_bytes: 120,
      conn_state: 'SF'
    },
    {
      ts: 1792843210.0,
      uid: 'test-evt-003',
      'id.orig_h': '10.0.0.20',
      'id.orig_p': 55000,
      'id.resp_h': '10.0.0.1',
      'id.resp_p': 80,
      proto: 'tcp',
      service: 'http',
      orig_bytes: 800,
      resp_bytes: 12000,
      conn_state: 'SF'
    }
  ];

  it('should ingest Zeek JSON records and return 201 with summary', async () => {
    const res = await request(app)
      .post('/api/ingest/zeek')
      .send(sampleZeekBatch);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ingested_events).toBe(3);
  });

  it('should be idempotent when re-ingesting duplicate records', async () => {
    const res = await request(app)
      .post('/api/ingest/zeek')
      .send(sampleZeekBatch);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ingested_events).toBe(3);

    // Query events and verify no duplicates exist for test-evt-001
    const queryRes = await request(app)
      .get('/api/events')
      .query({ source_ip: '10.0.0.15' });

    expect(queryRes.status).toBe(200);
    expect(queryRes.body.success).toBe(true);
    const uids = queryRes.body.data.items.map((e: any) => e.event_id);
    const uniqueUids = new Set(uids);
    expect(uniqueUids.size).toBe(uids.length);
  });

  it('should query events with source IP filter and pagination', async () => {
    const res = await request(app)
      .get('/api/events')
      .query({
        source_ip: '10.0.0.15',
        page: 1,
        limit: 10
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toBeDefined();
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.total).toBeGreaterThanOrEqual(2);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.limit).toBe(10);
    for (const item of res.body.data.items) {
      expect(item.source_ip).toBe('10.0.0.15');
    }
  });

  it('should filter events by protocol', async () => {
    const res = await request(app)
      .get('/api/events')
      .query({ protocol: 'udp' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    for (const item of res.body.data.items) {
      expect(item.protocol).toBe('udp');
    }
  });

  it('should return 400 with standard error format for invalid query parameters', async () => {
    const res = await request(app)
      .get('/api/events')
      .query({ limit: -5 }); // Invalid limit

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBeDefined();
  });
});
