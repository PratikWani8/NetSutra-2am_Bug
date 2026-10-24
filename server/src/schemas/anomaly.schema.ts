import { z } from 'zod';

export const anomalyQuerySchema = z.object({
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  method: z.string().optional(),
  source_ip: z.string().optional(),
  destination_ip: z.string().optional(),
  time_start: z.string().optional(),
  time_end: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50)
});

export const anomalyIdParamSchema = z.object({
  id: z.string().min(1, 'Anomaly ID is required')
});
