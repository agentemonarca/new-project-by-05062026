import { Router, type Request } from 'express';
import type { Logger } from 'pino';

/**
 * POST /api/gpulse/control|strategy|safety — validate, log, forward to gpulse-api (e.g. http://localhost:5052).
 */
export function createGpulseRoutes(logger: Logger, gpulseApiUrl: string): Router {
  const base = gpulseApiUrl.replace(/\/$/, '');

  async function forward(path: string, body: unknown, req: Request) {
    const url = `${base}${path}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (req.headers.authorization) headers.Authorization = req.headers.authorization;
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const text = await r.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    return { status: r.status, data };
  }

  const router = Router();

  router.post('/control', async (req, res) => {
    const action = req.body?.action;
    if (action !== 'start' && action !== 'pause') {
      return res.status(400).json({ success: false, error: 'invalid_action' });
    }
    logger.info({ action }, 'gateway.gpulse.control');
    try {
      const { status, data } = await forward('/control', { action }, req);
      return res.status(status).json(data);
    } catch (err) {
      logger.error({ err }, 'gateway.gpulse.control forward');
      return res.status(502).json({ success: false, error: 'bad_gateway' });
    }
  });

  router.post('/strategy', async (req, res) => {
    const value = req.body?.value;
    if (!['speed', 'balanced', 'protection'].includes(value)) {
      return res.status(400).json({ success: false, error: 'invalid_strategy' });
    }
    logger.info({ value }, 'gateway.gpulse.strategy');
    try {
      const { status, data } = await forward('/strategy', { value }, req);
      return res.status(status).json(data);
    } catch (err) {
      logger.error({ err }, 'gateway.gpulse.strategy forward');
      return res.status(502).json({ success: false, error: 'bad_gateway' });
    }
  });

  router.post('/safety', async (req, res) => {
    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'invalid_safety' });
    }
    logger.info({ enabled }, 'gateway.gpulse.safety');
    try {
      const { status, data } = await forward('/safety', { enabled }, req);
      return res.status(status).json(data);
    } catch (err) {
      logger.error({ err }, 'gateway.gpulse.safety forward');
      return res.status(502).json({ success: false, error: 'bad_gateway' });
    }
  });

  router.post('/auto', async (req, res) => {
    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'invalid_auto' });
    }
    logger.info({ enabled }, 'gateway.gpulse.auto');
    try {
      const { status, data } = await forward('/auto', { enabled }, req);
      return res.status(status).json(data);
    } catch (err) {
      logger.error({ err }, 'gateway.gpulse.auto forward');
      return res.status(502).json({ success: false, error: 'bad_gateway' });
    }
  });

  return router;
}
