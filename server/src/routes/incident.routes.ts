import { Router } from 'express';
import { getIncidents, getIncidentById, updateIncidentStatus } from '../controllers/incidentController';
import { validate } from '../middleware/validate';
import { incidentQuerySchema, incidentIdParamSchema, incidentStatusUpdateSchema } from '../schemas/incident.schema';

export const incidentRouter = Router();

incidentRouter.get('/incidents', validate({ query: incidentQuerySchema }), getIncidents);
incidentRouter.get('/incidents/:id', validate({ params: incidentIdParamSchema }), getIncidentById);
incidentRouter.patch(
  '/incidents/:id/status',
  validate({ params: incidentIdParamSchema, body: incidentStatusUpdateSchema }),
  updateIncidentStatus
);
