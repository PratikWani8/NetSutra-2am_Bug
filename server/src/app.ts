import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { env } from './config/env';
import { apiRouter } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { AppError } from './utils/response';

export function createApp(): Application {
  const app: Application = express();

  // Middleware
  app.use(cors({
    origin: [env.FRONTEND_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  }));

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(express.text({ limit: '50mb', type: ['text/*', 'application/octet-stream'] }));
  app.use(requestLogger);

  // Mount API router
  app.use('/api', apiRouter);

  // 404 Handler for undefined routes
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new AppError(404, 'ROUTE_NOT_FOUND', `Route '${req.method} ${req.originalUrl}' not found.`));
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
