import { Request, Response, NextFunction } from 'express';
import { eventRepository } from '../repositories/eventRepository';
import { ingestionService } from '../services/ingestionService';
import { sendSuccess, AppError } from '../utils/response';
import { EventQueryFilter } from '../types/events';

export async function getEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const filter: EventQueryFilter = {
      time_start: req.query.time_start as string,
      time_end: req.query.time_end as string,
      source_ip: req.query.source_ip as string,
      destination_ip: req.query.destination_ip as string,
      protocol: req.query.protocol as string,
      service: req.query.service as string,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50
    };

    const result = await eventRepository.find(filter);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function ingestZeek(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. If file uploaded via Multer
    const file = req.file || (Array.isArray(req.files) && req.files.length > 0 ? (req.files[0] as Express.Multer.File) : undefined);
    if (file) {
      const content = file.buffer.toString('utf8');
      const result = await ingestionService.ingestZeekContent(content);
      return sendSuccess(res, result, 201);
    }

    // 2. If raw JSON array or string body
    if (Array.isArray(req.body)) {
      const result = await ingestionService.ingestEventBatch(req.body);
      return sendSuccess(res, result, 201);
    }

    if (req.body?.events && Array.isArray(req.body.events)) {
      const result = await ingestionService.ingestEventBatch(req.body.events);
      return sendSuccess(res, result, 201);
    }

    if (typeof req.body === 'string' && req.body.trim()) {
      const result = await ingestionService.ingestZeekContent(req.body);
      return sendSuccess(res, result, 201);
    }

    throw new AppError(400, 'INVALID_PAYLOAD', 'Please provide Zeek log content as JSON body or file upload.');
  } catch (error) {
    next(error);
  }
}
