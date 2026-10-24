import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/response';
import { checkOpenSearchHealth } from '../config/opensearch';
import { aiService } from '../services/aiService';
import { socketService } from '../services/socketService';

export async function getHealth(_req: Request, res: Response, next: NextFunction) {
  try {
    const [opensearchHealthy, aiHealth] = await Promise.all([
      checkOpenSearchHealth(),
      aiService.getHealth().catch(() => ({ status: 'unavailable', service: 'ai-service' }))
    ]);

    const uptimeSeconds = Math.floor(process.uptime());

    return sendSuccess(res, {
      status: 'healthy',
      service: 'NetSutra Backend',
      version: '1.0.0',
      uptime_seconds: uptimeSeconds,
      timestamp: new Date().toISOString(),
      services: {
        opensearch: {
          connected: opensearchHealthy
        },
        ai_service: {
          status: aiHealth.status === 'healthy' ? 'connected' : 'unavailable'
        },
        socket_io: {
          connected_clients: socketService.getConnectedCount()
        }
      }
    });
  } catch (error) {
    next(error);
  }
}
