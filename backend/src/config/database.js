import mongoose from 'mongoose';

import { env } from './env.js';
import { logger } from '../shared/utils/logger.js';

export const connectDatabase = async () => {
  const connection = await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
  });

  logger.info(`MongoDB connected to ${connection.connection.host}`);
};

export const disconnectDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('MongoDB connection closed');
  }
};
