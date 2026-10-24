import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { app } from './app';
import { env } from './config/env';
import { initializeIndices } from './config/opensearch';
import { socketService } from './services/socketService';
import { logger } from './utils/logger';

const server = http.createServer(app);

// Attach Socket.IO to HTTP server
const io = new SocketIOServer(server, {
  cors: {
    origin: [env.FRONTEND_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST']
  }
});

socketService.initialize(io);

async function startServer() {
  try {
    // Attempt to initialize OpenSearch indices if reachable
    await initializeIndices();

    server.listen(env.PORT, () => {
      logger.info(`=======================================================`);
      logger.info(` NetSutra Backend running on port ${env.PORT}`);
      logger.info(` Environment: ${env.NODE_ENV}`);
      logger.info(` Frontend Origin: ${env.FRONTEND_ORIGIN}`);
      logger.info(` OpenSearch URL: ${env.OPENSEARCH_URL}`);
      logger.info(` AI Service URL: ${env.AI_SERVICE_URL}`);
      logger.info(` Socket.IO: initialized & listening`);
      logger.info(`=======================================================`);
    });
  } catch (error: any) {
    logger.error(`Failed to start NetSutra Backend: ${error.message}`);
    process.exit(1);
  }
}

// Graceful shutdown
const shutdown = () => {
  logger.info('Shutting down NetSutra backend gracefully...');
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { server, io };
