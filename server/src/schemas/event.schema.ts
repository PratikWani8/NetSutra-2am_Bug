import { z } from 'zod';

export const networkEventSchema = z.object({
  event_id: z.string().min(1),
  timestamp: z.string().datetime({ offset: true }),
  source_ip: z.string().min(1),
  destination_ip: z.string().min(1),
  source_port: z.number().int().min(0).max(65535).nullable().optional(),
  destination_port: z.number().int().min(0).max(65535).nullable().optional(),
  protocol: z.string().nullable().optional(),
  service: z.string().nullable().optional(),
  outbound_bytes: z.number().int().min(0).nullable().optional(),
  inbound_bytes: z.number().int().min(0).nullable().optional(),
  duration: z.number().min(0).nullable().optional(),
  conn_state: z.string().nullable().optional(),
  history: z.string().nullable().optional(),
  missed_bytes: z.number().int().min(0).nullable().optional(),
  metadata: z.record(z.any()).optional()
});

export const eventQuerySchema = z.object({
  time_start: z.string().optional(),
  time_end: z.string().optional(),
  source_ip: z.string().optional(),
  destination_ip: z.string().optional(),
  protocol: z.string().optional(),
  service: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(50)
});

export const ingestEventsBodySchema = z.object({
  events: z.array(z.record(z.any())).min(1, 'At least one event is required')
});
