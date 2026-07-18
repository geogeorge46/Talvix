import { app } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { logger } from './shared/utils/logger.js';

let httpServer;
let isShuttingDown = false;

const closeHttpServer = async () => {
  if (!httpServer) {
    return;
  }

  await new Promise((resolve, reject) => {
    httpServer.close((error) => (error ? reject(error) : resolve()));
  });
};

const shutdown = async (signal) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info(`${signal} received; shutting down gracefully`);

  const forceShutdownTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out');
    process.exit(1);
  }, 10_000);
  forceShutdownTimer.unref();

  try {
    await closeHttpServer();
    await disconnectDatabase();
    clearTimeout(forceShutdownTimer);
    process.exit(0);
  } catch (error) {
    logger.error('Graceful shutdown failed', error);
    process.exit(1);
  }
};

const startServer = async () => {
  try {
    await connectDatabase();
    httpServer = app.listen(env.PORT, () => {
      logger.info(`Talvix API listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
    });
  } catch (error) {
    logger.error('Server startup failed; HTTP server was not started', error);
    await disconnectDatabase();
    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

await startServer();
