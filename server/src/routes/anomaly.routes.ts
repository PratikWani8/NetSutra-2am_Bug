import { Router } from 'express';
import { getAnomalies, getAnomalyById, investigateAnomaly } from '../controllers/anomalyController';
import { validate } from '../middleware/validate';
import { anomalyQuerySchema, anomalyIdParamSchema } from '../schemas/anomaly.schema';

export const anomalyRouter = Router();

anomalyRouter.get('/anomalies', validate({ query: anomalyQuerySchema }), getAnomalies);
anomalyRouter.get('/anomalies/:id', validate({ params: anomalyIdParamSchema }), getAnomalyById);
anomalyRouter.post('/anomalies/:id/investigate', validate({ params: anomalyIdParamSchema }), investigateAnomaly);
