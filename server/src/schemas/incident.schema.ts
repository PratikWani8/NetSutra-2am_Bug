import { z } from 'zod';

export const incidentQuerySchema = z.object({
  status: z.enum(['open', 'investigating', 'resolved', 'closed']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  time_start: z.string().optional(),
  time_end: z.string().optional(),
  source_ip: z.string().optional(),
  destination_ip: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20)
});

export const incidentIdParamSchema = z.object({
  id: z.string().min(1, 'Incident ID is required')
});

export const incidentStatusUpdateSchema = z.object({
  status: z.enum(['open', 'investigating', 'resolved', 'closed'], {
    errorMap: () => ({ message: "Status must be one of 'open', 'investigating', 'resolved', or 'closed'" })
  })
});
