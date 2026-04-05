import { Router, type Request, type Response } from 'express';
import type { Logger } from 'pino';

/**
 * Edge endpoint: validates gateway secret, forwards to core-api compensation webhook.
 * POST /webhooks/compensation/ingest
 * Headers: X-Webhook-Secret: COMPENSATION_INGEST_SECRET (or WEBHOOK_SECRET fallback)
 */
export function createCompensationIngestRoutes(logger: Logger, coreApiUrl: string): Router {
  const router = Router();
  const edgeSecret = String(process.env.COMPENSATION_INGEST_SECRET || process.env.WEBHOOK_SECRET || '').trim();
  const coreSecret = String(process.env.COMPENSATION_WEBHOOK_SECRET || '').trim();
  const base = coreApiUrl.replace(/\/$/, '');

  router.post('/compensation/ingest', async (req: Request, res: Response) => {
    const provided = req.headers['x-webhook-secret'];
    const secretHeader = typeof provided === 'string' ? provided : Array.isArray(provided) ? provided[0] : '';

    if (!edgeSecret || secretHeader !== edgeSecret) {
      logger.warn('compensation_ingest_unauthorized');
      return res.status(401).json({ error: 'unauthorized' });
    }
    if (!coreSecret) {
      return res.status(503).json({ error: 'COMPENSATION_WEBHOOK_SECRET not set on gateway' });
    }

    try {
      const r = await fetch(`${base}/api/webhooks/compensation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Compensation-Webhook-Secret': coreSecret,
        },
        body: JSON.stringify(req.body ?? {}),
      });
      const text = await r.text();
      res.status(r.status).setHeader('Content-Type', 'application/json');
      return res.send(text);
    } catch (err) {
      logger.error({ err }, 'compensation_ingest_forward_failed');
      return res.status(502).json({ error: 'bad_gateway' });
    }
  });

  return router;
}
