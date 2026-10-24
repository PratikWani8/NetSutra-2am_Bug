import { Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboardService';
import { sendSuccess } from '../utils/response';

export async function getDashboardSummary(_req: Request, res: Response, next: NextFunction) {
  try {
    const summary = await dashboardService.getSummary();
    return sendSuccess(res, summary);
  } catch (error) {
    next(error);
  }
}
