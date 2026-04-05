import { getCacheRedisConnection } from './redisClient.js';

const memory = new Map();

/**
 * Read-through TTL cache: Redis when REDIS_URL set, else in-process Map.
 */
export function createTtlCache(namespace) {
  const ns = String(namespace || 'app');
  const redis = getCacheRedisConnection();

  return {
    async get(key) {
      const k = `${ns}:${key}`;
      if (redis) {
        try {
          const raw = await redis.get(k);
          if (!raw) return null;
          return JSON.parse(raw);
        } catch {
          return null;
        }
      }
      const row = memory.get(k);
      if (!row) return null;
      if (row.exp < Date.now()) {
        memory.delete(k);
        return null;
      }
      return row.value;
    },
    async set(key, value, ttlMs) {
      const k = `${ns}:${key}`;
      const ms = Math.max(1000, Number(ttlMs) || 10_000);
      if (redis) {
        try {
          await redis.set(k, JSON.stringify(value), 'PX', Math.floor(ms));
        } catch {
          /* ignore */
        }
        return;
      }
      memory.set(k, { value, exp: Date.now() + ms });
    },
  };
}
