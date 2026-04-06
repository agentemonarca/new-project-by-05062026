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
  ]);

  return function apiSessionAuth(req, res, next) {
    const sub = req.path || '';
    if (publicPaths.has(sub)) return next();
    if (sub.startsWith('/webhooks/')) return next();
    if (sub.startsWith('/admin/genesis') || sub === '/admin/audit/run' || sub === '/ledger/export') {
      const expected = String(process.env.GENESIS_ADMIN_API_KEY || '').trim();
      const got = String(req.headers['x-admin-api-key'] || '').trim();
      if (expected && got === expected) return next();
    }

    if (req.session?.address) return next();

    const raw = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (raw && authService.getSession(raw)) return next();

    return res.status(401).json({ error: 'unauthorized' });
  };
}
