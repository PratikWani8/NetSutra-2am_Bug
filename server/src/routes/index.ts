import { Router } from 'express';
import { healthRouter } from './health.routes';
import { dashboardRouter } from './dashboard.routes';
import { eventRouter } from './event.routes';
import { anomalyRouter } from './anomaly.routes';
import { incidentRouter } from './incident.routes';
import { settingsRouter } from './settings.routes';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(dashboardRouter);
apiRouter.use(eventRouter);
apiRouter.use(anomalyRouter);
apiRouter.use(incidentRouter);
apiRouter.use(settingsRouter);
