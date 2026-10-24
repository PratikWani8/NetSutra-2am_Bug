import { Router } from 'express';
import { getDashboardSummary } from '../controllers/dashboardController';

export const dashboardRouter = Router();

dashboardRouter.get('/dashboard/summary', getDashboardSummary);
