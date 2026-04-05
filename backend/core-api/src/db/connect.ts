import mongoose from 'mongoose';
import { getMongoConnectionUri } from '../utils/default.js';

export type LoggerLike = {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
};

/**
 * Optional MongoDB — connects when `getMongoConnectionUri()` returns a value.
 */
export async function connectMongoIfConfigured(logger: LoggerLike): Promise<void> {
  const uri = getMongoConnectionUri();
  if (!uri) {
    logger.info('no_database_uri', {
      detail: 'No MongoDB URI configured; set MONGO_URI in the environment.',
    });
    return;
  }

  mongoose.set('strictQuery', true);

  mongoose.connection.on('error', (err: Error) => {
    logger.error('mongo_driver_error', { message: err?.message });
  });
  mongoose.connection.on('disconnected', () => {
    logger.warn('mongo_disconnected');
  });

  await mongoose.connect(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 15_000,
    socketTimeoutMS: 45_000,
  });

  logger.info('mongo_connected', {
    name: mongoose.connection.name,
    host: mongoose.connection.host,
  });
}

/** For GET /health when Mongo is configured */
export function getMongoHealthSummary(): { configured: boolean; ready?: boolean } {
  const configured = Boolean(getMongoConnectionUri());
  if (!configured) return { configured: false };
  const ready = mongoose.connection.readyState === 1;
  return { configured: true, ready };
}
