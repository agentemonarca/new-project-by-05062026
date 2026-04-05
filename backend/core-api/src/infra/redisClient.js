import IORedis from 'ioredis';

let bullConnection = null;
let cacheConnection = null;

/**
 * Shared connection for BullMQ (requires maxRetriesPerRequest: null).
 * @returns {import('ioredis').Redis | null}
 */
export function getBullRedisConnection() {
  const url = String(process.env.REDIS_URL || '').trim();
  if (!url) return null;
  if (!bullConnection) {
    bullConnection = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  }
  return bullConnection;
}

/**
 * Separate connection for cache / TTL keys (keeps Bull latency predictable).
 * @returns {import('ioredis').Redis | null}
 */
export function getCacheRedisConnection() {
  const url = String(process.env.REDIS_URL || '').trim();
  if (!url) return null;
  if (!cacheConnection) {
    cacheConnection = new IORedis(url, {
      maxRetriesPerRequest: 20,
      enableReadyCheck: true,
    });
  }
  return cacheConnection;
}

export function isRedisConfigured() {
  return Boolean(String(process.env.REDIS_URL || '').trim());
}
