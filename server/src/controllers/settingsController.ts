import { Request, Response, NextFunction } from 'express';
import { settingsService } from '../services/settingsService';
import { sendSuccess } from '../utils/response';

export async function getAiProvider(req: Request, res: Response, next: NextFunction) {
  try {
    const config = await settingsService.getAiProviderConfig();
    return sendSuccess(res, config);
  } catch (error) {
    next(error);
  }
}

export async function updateAiProvider(req: Request, res: Response, next: NextFunction) {
  try {
    const updated = await settingsService.setAiProvider(req.body.provider);
    return sendSuccess(res, updated);
  } catch (error) {
    next(error);
  }
}

export async function getAiProvidersStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const status = await settingsService.getProvidersStatus();
    return sendSuccess(res, status);
  } catch (error) {
    next(error);
  }
}
