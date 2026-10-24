import { Request, Response, NextFunction } from 'express';
import { anomalyService } from '../services/anomalyService';
import { sendSuccess } from '../utils/response';
import { AnomalyQueryFilter, Severity } from '../types/anomalies';

export async function getAnomalies(req: Request, res: Response, next: NextFunction) {
  try {
    const filter: AnomalyQueryFilter = {
      severity: req.query.severity as Severity,
      method: req.query.method as string,
      source_ip: req.query.source_ip as string,
      destination_ip: req.query.destination_ip as string,
      time_start: req.query.time_start as string,
      time_end: req.query.time_end as string,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50
    };

    const result = await anomalyService.listAnomalies(filter);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function getAnomalyById(req: Request, res: Response, next: NextFunction) {
  try {
    const anomaly = await anomalyService.getAnomalyById(req.params.id);
    return sendSuccess(res, anomaly);
  } catch (error) {
    next(error);
  }
}

export async function investigateAnomaly(req: Request, res: Response, next: NextFunction) {
  try {
    const requestedProvider = req.body?.provider;
    const investigation = await anomalyService.investigateAnomaly(req.params.id, requestedProvider);
    return sendSuccess(res, investigation);
  } catch (error) {
    next(error);
  }
}
