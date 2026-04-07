function nowMs() {
  return Date.now();
}

export function getClientIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return String(req?.ip || 'unknown');
}

/**
 * Simple in-memory rate limiter.
 * Store: Map<key, { count, lastReset }>
 */
export function createRateLimiter({ logger } = {}) {
  const buckets = new Map();
  const activeLogger = logger || null;

  /**
   * @param {object} opts
   * @param {number} opts.windowMs
   * @param {number} opts.max
   * @param {(req: any) => string} [opts.keyGenerator]
   */
  function rateLimit({ windowMs, max, keyGenerator }) {
    const keyFn =
      typeof keyGenerator === 'function'
        ? keyGenerator
        : (req) => `ip:${getClientIp(req)}`;

    return (req, res, next) => {
      const key = String(keyFn(req) || 'unknown');
      const now = nowMs();
      const prev = buckets.get(key) || { count: 0, lastReset: now };

      const elapsed = now - (Number(prev.lastReset) || now);
      const isExpired = elapsed >= windowMs;
      const bucket = isExpired ? { count: 0, lastReset: now } : prev;

      bucket.count += 1;
      buckets.set(key, bucket);

      if (bucket.count > max) {
        const elapsed2 = now - (Number(bucket.lastReset) || now);
        const remainingMs = Math.max(0, windowMs - elapsed2);
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        res.setHeader('Retry-After', String(remainingSeconds));
        const meta = {
          ip: getClientIp(req),
          address: req.user?.address || null,
          route: req.originalUrl,
          method: req.method,
          timestamp: new Date().toISOString(),
        };
        if (activeLogger?.warn) activeLogger.warn('RATE_LIMIT_EXCEEDED', meta);
        else console.warn(JSON.stringify({ level: 'warn', msg: 'RATE_LIMIT_EXCEEDED', ...meta }));
        return res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED', retryAfter: remainingSeconds });
      }

      return next();
    };
  }

  return { rateLimit };
}

/**
 * Aplica `limit` salvo que `skip(req)` sea true (rutas exentas del cubo “general”).
 * @param {{ skip: (req: import('express').Request) => boolean, limit: import('express').RequestHandler }} opts
 * @returns {import('express').RequestHandler}
 */
export function rateLimitUnless({ skip, limit }) {
  return (req, res, next) => {
    if (skip(req)) return next();
    return limit(req, res, next);
  };
}

/**
 * Key generator: IP plus authenticated address (if present).
 *
 * Reads Authorization: Bearer <token> and resolves it through authService.getSession(token).
 */
export function keyByIpAndOptionalAuthAddress({ authService }) {
  return (req) => {
    const ip = getClientIp(req);
    const authHeader = String(req?.headers?.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
    const session = token && authService?.getSession ? authService.getSession(token) : null;
    const addr = session?.address ? String(session.address) : '';
    return addr ? `ip:${ip}|addr:${addr}` : `ip:${ip}`;
  };
}

/**
 * Key generator: authenticated address only (falls back to IP).
 * Useful for per-user strict endpoints.
 */
export function keyByAuthAddressOrIp({ authService }) {
  return (req) => {
    const authHeader = String(req?.headers?.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
    const session = token && authService?.getSession ? authService.getSession(token) : null;
    const addr = session?.address ? String(session.address) : '';
    if (addr) return `addr:${addr}`;
    return `ip:${getClientIp(req)}`;
  };
}

