import { Request, Response, NextFunction } from 'express';
import { incidentService } from '../services/incidentService';
import { sendSuccess } from '../utils/response';
import { IncidentQueryFilter, IncidentStatus } from '../types/incidents';
import { Severity } from '../types/anomalies';

export async function getIncidents(req: Request, res: Response, next: NextFunction) {
  try {
    const filter: IncidentQueryFilter = {
      status: req.query.status as IncidentStatus,
      severity: req.query.severity as Severity,
      source_ip: req.query.source_ip as string,
      destination_ip: req.query.destination_ip as string,
      time_start: req.query.time_start as string,
      time_end: req.query.time_end as string,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20
    };

    const result = await incidentService.listIncidents(filter);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function getIncidentById(req: Request, res: Response, next: NextFunction) {
  try {
    const incident = await incidentService.getIncidentById(req.params.id);
    return sendSuccess(res, incident);
  } catch (error) {
    next(error);
  }
}

export async function updateIncidentStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const updated = await incidentService.updateIncidentStatus(req.params.id, req.body.status);
    return sendSuccess(res, updated);
  } catch (error) {
    next(error);
  }
}

export async function explainIncident(req: Request, res: Response, next: NextFunction) {
  try {
    const requestedProvider = req.body?.provider;
    const explanation = await incidentService.explainIncident(req.params.id, requestedProvider);
    return sendSuccess(res, explanation);
  } catch (error) {
    next(error);
  }
}
