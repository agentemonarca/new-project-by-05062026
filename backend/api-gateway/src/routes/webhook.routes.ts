import { Router, type Request, type Response } from 'express';
import type { Logger } from 'pino';
import crypto from 'node:crypto';

const STRATEGIES = new Set(['speed', 'balanced', 'protection']);
const ACTIONS = new Set(['start', 'pause']);

export type WebhookDeps = {
  logger: Logger;
  gpulseApiUrl: string;
  webhookSecret: string;
  /** Max webhook POSTs per IP per sliding minute. */
  rateLimitPerMinute: number;
  /** Idempotency: max distinct ids retained. */
  idempotencyMaxIds: number;
  /** Idempotency TTL (ms). */
  idempotencyTtlMs: number;
};

type ParsedWebhook = {
  type: 'signal';
  action: 'start' | 'pause';
  strategy?: 'speed' | 'balanced' | 'protection';
  safeMode?: boolean;
  confidence?: number;
  source?: string;
  id?: string;
};

type GpulseStep = 'strategy' | 'safety' | 'control';

function maskSecret(s: string): string {
  if (!s) return '(empty)';
  if (s.length <= 4) return '****';
  return `${s.slice(0, 2)}…${s.length}chars`;
}

function timingSafeEqualString(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function verifyOptionalHmac(secret: string, rawBody: Buffer | undefined, signatureHeader: string | undefined): boolean {
  if (!signatureHeader || !rawBody) return true;
  const trimmed = signatureHeader.trim();
  const hex = trimmed.startsWith('sha256=') ? trimmed.slice(7) : trimmed;
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return timingSafeEqualString(expected.toLowerCase(), hex.toLowerCase());
  } catch {
    return false;
  }
}

function parsePayload(body: unknown): { ok: true; data: ParsedWebhook } | { ok: false; error: string } {
  if (body === null || typeof body !== 'object') return { ok: false, error: 'invalid_body' };
  const o = body as Record<string, unknown>;
  if (o.type !== 'signal') return { ok: false, error: 'invalid_type' };
  const action = o.action;
  if (action !== 'start' && action !== 'pause') return { ok: false, error: 'invalid_action' };
  if ('strategy' in o && o.strategy !== undefined) {
    const s = o.strategy;
    if (typeof s !== 'string' || !STRATEGIES.has(s)) return { ok: false, error: 'invalid_strategy' };
  }
  if ('safeMode' in o && o.safeMode !== undefined && typeof o.safeMode !== 'boolean') {
    return { ok: false, error: 'invalid_safeMode' };
  }
  if ('confidence' in o && o.confidence !== undefined) {
    const c = o.confidence;
    if (typeof c !== 'number' || Number.isNaN(c) || c < 0 || c > 1) {
      return { ok: false, error: 'invalid_confidence' };
    }
  }
  if ('source' in o && o.source !== undefined && typeof o.source !== 'string') {
    return { ok: false, error: 'invalid_source' };
  }
  if ('id' in o && o.id !== undefined && typeof o.id !== 'string') {
    return { ok: false, error: 'invalid_id' };
  }
  const data: ParsedWebhook = {
    type: 'signal',
    action,
    strategy: o.strategy as ParsedWebhook['strategy'],
    safeMode: o.safeMode as boolean | undefined,
    confidence: o.confidence as number | undefined,
    source: o.source as string | undefined,
    id: o.id as string | undefined,
  };
  return { ok: true, data };
}

function createIdempotencyStore(maxIds: number, ttlMs: number) {
  const seen = new Map<string, number>();
  return {
    isDuplicate(id: string, now: number): boolean {
      const exp = seen.get(id);
      if (exp === undefined) return false;
      if (exp <= now) {
        seen.delete(id);
        return false;
      }
      return true;
    },
    remember(id: string, now: number) {
      const t = now + ttlMs;
      seen.set(id, t);
      for (const [k, v] of [...seen.entries()]) {
        if (v <= now) seen.delete(k);
      }
      while (seen.size > maxIds) {
        const k = seen.keys().next().value;
        if (k === undefined) break;
        seen.delete(k);
      }
    },
  };
}

function createRateLimiter(limitPerMinute: number) {
  const buckets = new Map<string, { windowStart: number; count: number }>();
  const WINDOW_MS = 60_000;
  return function check(ip: string, now: number): boolean {
    const b = buckets.get(ip);
    if (!b || now - b.windowStart >= WINDOW_MS) {
      buckets.set(ip, { windowStart: now, count: 1 });
      return true;
    }
    if (b.count >= limitPerMinute) return false;
    b.count += 1;
    return true;
  };
}

async function postGpulse(
  base: string,
  path: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const url = `${base}${path}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: r.ok, status: r.status, data };
}

function clientIp(req: Request): string {
  if (req.ip) return req.ip;
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) {
    return xf.split(',')[0]?.trim() || 'unknown';
  }
  return req.socket.remoteAddress || 'unknown';
}

function headerString(req: Request, name: string): string {
  const v = req.headers[name.toLowerCase()];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length) return v[0] ?? '';
  return '';
}

export type GpulseWebhookHandlers = {
  /** Mount at `/webhooks` → POST /webhooks/gpulse */
  webhooksRouter: Router;
  /** Mount at `/gpulse` → POST /gpulse/webhook */
  gpulseRouter: Router;
};

/**
 * G-Pulse webhook handlers sharing rate limit + idempotency state.
 * - POST /webhooks/gpulse — `x-webhook-secret` (legacy) vs WEBHOOK_SECRET
 * - POST /gpulse/webhook — `x-api-key` vs WEBHOOK_SECRET
 */
export function createGpulseWebhookHandlers(deps: WebhookDeps): GpulseWebhookHandlers {
  const base = deps.gpulseApiUrl.replace(/\/$/, '');
  const idem = createIdempotencyStore(deps.idempotencyMaxIds, deps.idempotencyTtlMs);
  const rateOk = createRateLimiter(deps.rateLimitPerMinute);

  async function runGpulseWebhook(
    req: Request,
    res: Response,
    authMode: 'webhook-secret' | 'api-key',
  ): Promise<void> {
    const now = Date.now();
    const log = deps.logger.child({
      route: authMode === 'api-key' ? 'webhook.gpulse.webhook' : 'webhook.gpulse',
    });

    if (!deps.webhookSecret) {
      log.warn('webhook rejected: WEBHOOK_SECRET not configured');
      res.status(503).json({ success: false, error: 'webhook_disabled', timestamp: now });
      return;
    }

    const ip = clientIp(req);
    if (!rateOk(ip, now)) {
      log.warn({ ip }, 'webhook rate limited');
      res.status(429).json({ success: false, error: 'rate_limited', timestamp: now });
      return;
    }

    if (authMode === 'api-key') {
      const apiKey = headerString(req, 'x-api-key');
      if (!timingSafeEqualString(apiKey, deps.webhookSecret)) {
        log.warn(
          { ip, headerPresent: Boolean(apiKey), keyMasked: maskSecret(apiKey) },
          'webhook unauthorized: invalid x-api-key',
        );
        res.status(401).json({ success: false, error: 'unauthorized', timestamp: now });
        return;
      }
    } else {
      const provided = req.headers['x-webhook-secret'];
      const secretHeader = typeof provided === 'string' ? provided : Array.isArray(provided) ? provided[0] : '';
      if (!timingSafeEqualString(secretHeader, deps.webhookSecret)) {
        log.warn(
          { ip, headerPresent: Boolean(secretHeader), secretMasked: maskSecret(secretHeader) },
          'webhook unauthorized: secret mismatch',
        );
        res.status(401).json({ success: false, error: 'unauthorized', timestamp: now });
        return;
      }
    }

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const sig = req.headers['x-signature'];
    const sigStr = typeof sig === 'string' ? sig : Array.isArray(sig) ? sig[0] : undefined;
    if (sigStr && !verifyOptionalHmac(deps.webhookSecret, rawBody, sigStr)) {
      log.warn({ ip }, 'webhook unauthorized: invalid HMAC signature');
      res.status(401).json({ success: false, error: 'invalid_signature', timestamp: now });
      return;
    }

    const parsed = parsePayload(req.body);
    if (!parsed.ok) {
      log.info({ ip, error: parsed.error, body: req.body }, 'webhook validation failed');
      res.status(400).json({ success: false, error: parsed.error, timestamp: now });
      return;
    }

    const payload = parsed.data;
    log.info(
      {
        ip,
        payload: {
          ...payload,
          id: payload.id,
          source: payload.source,
          confidence: payload.confidence,
        },
        signatureVerified: Boolean(sigStr),
      },
      'webhook received',
    );

    if (payload.id) {
      if (idem.isDuplicate(payload.id, now)) {
        log.info({ id: payload.id }, 'webhook duplicate id — ignored');
        res.status(200).json({
          success: true,
          received: true,
          duplicate: true,
          timestamp: Date.now(),
        });
        return;
      }
    }

    const steps: Partial<Record<GpulseStep, { ok: boolean; status: number; data?: unknown }>> = {};

    if (payload.strategy !== undefined) {
      const r = await postGpulse(base, '/strategy', { value: payload.strategy });
      steps.strategy = { ok: r.ok, status: r.status, data: r.data };
      if (!r.ok) {
        log.error({ status: r.status, data: r.data }, 'webhook strategy forward failed');
        res.status(r.status >= 400 && r.status < 600 ? r.status : 502).json({
          success: false,
          received: true,
          partial: true,
          steps,
          error: 'strategy_forward_failed',
          timestamp: Date.now(),
        });
        return;
      }
    }

    if (payload.safeMode !== undefined) {
      const r = await postGpulse(base, '/safety', { enabled: payload.safeMode });
      steps.safety = { ok: r.ok, status: r.status, data: r.data };
      if (!r.ok) {
        log.error({ status: r.status, data: r.data }, 'webhook safety forward failed');
        res.status(r.status >= 400 && r.status < 600 ? r.status : 502).json({
          success: false,
          received: true,
          partial: true,
          steps,
          error: 'safety_forward_failed',
          timestamp: Date.now(),
        });
        return;
      }
    }

    const ctrl = await postGpulse(base, '/control', { action: payload.action });
    steps.control = { ok: ctrl.ok, status: ctrl.status, data: ctrl.data };
    if (!ctrl.ok) {
      log.error({ status: ctrl.status, data: ctrl.data }, 'webhook control forward failed');
      res.status(ctrl.status >= 400 && ctrl.status < 600 ? ctrl.status : 502).json({
        success: false,
        received: true,
        partial: Object.keys(steps).length > 0,
        steps,
        error: 'control_forward_failed',
        timestamp: Date.now(),
      });
      return;
    }

    if (payload.id) idem.remember(payload.id, now);

    log.info({ steps: Object.keys(steps), action: payload.action }, 'webhook applied');

    res.status(200).json({
      success: true,
      received: true,
      timestamp: Date.now(),
      details: {
        steps,
        confidenceLogged: payload.confidence,
        source: payload.source,
      },
    });
  }

  const webhooksRouter = Router();
  webhooksRouter.post('/gpulse', (req, res) => {
    void runGpulseWebhook(req, res, 'webhook-secret');
  });

  const gpulseRouter = Router();
  gpulseRouter.post('/webhook', (req, res) => {
    void runGpulseWebhook(req, res, 'api-key');
  });

  return { webhooksRouter, gpulseRouter };
}

/** @deprecated Prefer `createGpulseWebhookHandlers` when mounting `/gpulse/webhook` as well. */
export function createWebhookRoutes(deps: WebhookDeps): Router {
  return createGpulseWebhookHandlers(deps).webhooksRouter;
}
