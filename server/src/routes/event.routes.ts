import { Router } from 'express';
import multer from 'multer';
import { getEvents, ingestZeek } from '../controllers/eventController';
import { validate } from '../middleware/validate';
import { eventQuerySchema } from '../schemas/event.schema';

const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max upload
  storage: multer.memoryStorage()
});

export const eventRouter = Router();

eventRouter.get('/events', validate({ query: eventQuerySchema }), getEvents);
eventRouter.post('/ingest/zeek', upload.any(), ingestZeek);
eventRouter.post('/events/ingest', upload.any(), ingestZeek);
