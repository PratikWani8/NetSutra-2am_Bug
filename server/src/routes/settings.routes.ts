import { Router } from 'express';
import { getAiProvider, updateAiProvider, getAiProvidersStatus } from '../controllers/settingsController';
import { validate } from '../middleware/validate';
import { updateAiProviderSchema } from '../schemas/settings.schema';

export const settingsRouter = Router();

settingsRouter.get('/settings/ai-provider', getAiProvider);
settingsRouter.put('/settings/ai-provider', validate({ body: updateAiProviderSchema }), updateAiProvider);
settingsRouter.get('/ai/providers/status', getAiProvidersStatus);
