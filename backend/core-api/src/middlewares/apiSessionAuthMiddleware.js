/**
 * Requires cookie session (req.session.address) or legacy Bearer JWT from authService.
 * Mount at app.use('/api', ...) so req.path is relative to /api (e.g. /wallet).
 */
export function createApiSessionAuthMiddleware({ authService }) {
  const publicPaths = new Set([
    '/auth/request-message',
    '/auth/verify-signature',
    '/verify-deposit',
    '/metrics/genesis',
    '/admin/auth/login',
    '/admin/auth/logout',
    '/admin/auth/me',
    '/admin/login',
    /** Algunos despliegues exponen `req.path` con prefijo `/api`; aceptar ambas formas. */
    '/api/admin/auth/login',
    '/api/admin/auth/logout',
    '/api/admin/auth/me',
    '/api/admin/login',
  ]);

  return function apiSessionAuth(req, res, next) {
    const pathRaw = req.path || '';
    /** Normalizar a path “bajo /api” por si `req.path` incluye prefijo (variantes de montaje). */
    const sub = pathRaw.startsWith('/api') ? (pathRaw.length > 4 ? pathRaw.slice(4) : '/') : pathRaw;
    if (publicPaths.has(sub) || publicPaths.has(pathRaw)) return next();
    if (sub.startsWith('/webhooks/')) return next();
    if (
      sub.startsWith('/admin/signals') ||
      sub.startsWith('/admin/genesis') ||
      sub === '/admin/audit/run' ||
      sub === '/ledger/export'
    ) {
      const expected = String(process.env.GENESIS_ADMIN_API_KEY || '').trim();
      const got = String(req.headers['x-admin-api-key'] || '').trim();
      if (expected && got === expected) return next();
      if (req.session?.genesisAdmin === true) return next();
    }

    if (req.session?.address) return next();

    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (bearer && authService.getSession(bearer)) return next();

    return res.status(401).json({ error: 'unauthorized' });
  };
}
