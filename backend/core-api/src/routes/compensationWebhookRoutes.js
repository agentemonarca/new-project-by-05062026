import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { getAddress } from 'ethers';
import { loadProcessedTxs } from '../utils/processedTxStore.js';

const REPLAY_TTL_MS = Math.max(60_000, Number(process.env.COMPENSATION_WEBHOOK_REPLAY_TTL_MS || 600_000));
const replaySeen = new Map();

function pruneReplay() {
  const now = Date.now();
  for (const [k, exp] of replaySeen) {
    if (exp < now) replaySeen.delete(k);
  }
}

function isReplay(rawBody, tSec) {
  pruneReplay();
  const h = createHash('sha256').update(rawBody).digest('hex');
  const key = `${tSec}:${h}`;
  if (replaySeen.has(key)) return true;
  replaySeen.set(key, Date.now() + REPLAY_TTL_MS);
  return false;
}

/**
 * @param {Buffer} rawBody
 * @param {import('express').Request['headers']} headers
 */
function verifyCompensationWebhook(rawBody, headers) {
  const secret = String(process.env.COMPENSATION_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    return { ok: false, reason: 'secret_not_configured' };
  }

  const allowPlain = String(process.env.COMPENSATION_WEBHOOK_ALLOW_PLAIN_SECRET || '').trim() === '1';
  const plainHeader = String(headers['x-compensation-webhook-secret'] || '').trim();

  const sigHeader = headers['x-comp-signature'] || headers['x-compensation-signature'];
  const sigStr = sigHeader ? String(sigHeader) : '';

  if (!sigStr && allowPlain && plainHeader && plainHeader === secret) {
    return { ok: true, mode: 'legacy_plain' };
  }

  if (!sigStr) {
    return { ok: false, reason: 'missing_signature', hint: 'Send X-Comp-Signature: t=<unix>,v1=<hex> or set COMPENSATION_WEBHOOK_ALLOW_PLAIN_SECRET=1 for migration only' };
  }

  let t = '';
  let v1 = '';
  for (const part of sigStr.split(',')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k === 't') t = v;
    if (k === 'v1') v1 = v;
  }
  if (!t || !v1) {
    return { ok: false, reason: 'bad_signature_format' };
  }

  const tMs = Number(t) * 1000;
  if (!Number.isFinite(tMs)) {
    return { ok: false, reason: 'bad_timestamp' };
  }
  const skew = Math.abs(Date.now() - tMs);
  const maxSkew = Math.max(60_000, Number(process.env.COMPENSATION_WEBHOOK_MAX_SKEW_MS || 300_000));
  if (skew > maxSkew) {
    return { ok: false, reason: 'stale_timestamp' };
  }

  const payload = Buffer.from(`${t}.${rawBody.toString('utf8')}`, 'utf8');
  const expectedHex = createHmac('sha256', secret).update(payload).digest('hex');
  const a = Buffer.from(expectedHex, 'hex');
  const b = Buffer.from(String(v1).trim(), 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_hmac' };
  }

  if (isReplay(rawBody, t)) {
    return { ok: false, reason: 'replay' };
  }

  return { ok: true, mode: 'hmac' };
}

/**
 * Middleware: assigns req.body from raw buffer (must run after express.raw on this path).
 */
export function compensationWebhookBodyParser(req, res, next) {
  const buf = req.body;
  if (!Buffer.isBuffer(buf)) {
    return res.status(500).json({ error: 'webhook_raw_body_missing' });
  }
  req.compensationRawBody = buf;
  try {
    const text = buf.length ? buf.toString('utf8') : '{}';
    req.body = text ? JSON.parse(text) : {};
  } catch {
    return res.status(400).json({ error: 'invalid_json' });
  }
  return next();
}

/**
 * External automation: claim payouts or register purchases by signed webhook.
 */
export function compensationWebhookRoutes({ getKernel, logger }) {
  const router = Router();

  router.post('/', async (req, res) => {
    const raw = req.compensationRawBody;
    if (!Buffer.isBuffer(raw)) {
      return res.status(500).json({ error: 'webhook_raw_body_missing' });
    }

    const v = verifyCompensationWebhook(raw, req.headers);
    if (!v.ok) {
      logger?.warn?.('compensation_webhook_auth_fail', { reason: v.reason });
      return res.status(401).json({ error: 'unauthorized', reason: v.reason });
    }

    const kernel = getKernel();
    if (!kernel?.facade) {
      return res.status(503).json({ error: 'compensation_disabled' });
    }

    const action = String(req.body?.action || '');
    try {
      if (action === 'claim') {
        const rawAddr = req.body?.userAddress || req.body?.userId;
        const claimType = String(req.body?.claimType || '');
        const userId = getAddress(String(rawAddr)).toLowerCase();

        switch (claimType) {
          case 'direct':
            return res.json(await kernel.facade.claimDirect(userId));
          case 'mining':
            return res.json(await kernel.facade.claimMining(userId));
          case 'binary':
            return res.json(await kernel.facade.claimBinary(userId));
          default:
            return res.status(400).json({ error: 'invalid_claimType' });
        }
      }

      if (action === 'recordPurchase') {
        const requireDepositTx = String(process.env.COMPENSATION_WEBHOOK_REQUIRE_PROCESSED_DEPOSIT_TX || '').trim() === '1';
        const buyerId = getAddress(String(req.body?.buyerAddress || '')).toLowerCase();
        const principal = Number(req.body?.principal);
        const txRef = String(req.body?.txRef || '').toLowerCase();
        if (!txRef || !Number.isFinite(principal) || principal <= 0) {
          return res.status(400).json({ error: 'invalid_purchase_payload' });
        }
        if (requireDepositTx) {
          const processed = await loadProcessedTxs();
          if (!processed.includes(txRef)) {
            logger?.warn?.('compensation_webhook_purchase_rejected', { reason: 'tx_not_deposit_processed', txRef });
            return res.status(403).json({ error: 'tx_not_verified_deposit' });
          }
        }
        let referrerId = null;
        if (req.body?.referrerAddress) {
          try {
            referrerId = getAddress(String(req.body.referrerAddress)).toLowerCase();
            if (referrerId === buyerId) referrerId = null;
          } catch {
            referrerId = null;
          }
        }
        const binarySide = req.body?.binarySide === 2 || req.body?.binarySide === '2' ? 2 : 1;
        await kernel.facade.recordPurchase({
          buyerId,
          referrerId,
          principal,
          binarySide,
          txRef,
          skipDirectBonus: Boolean(req.body?.skipDirectBonus),
        });
        logger?.info?.('compensation_webhook_purchase', { txRef, buyerId, mode: v.mode });
        return res.json({ ok: true });
      }

      return res.status(400).json({ error: 'unknown_action' });
    } catch (e) {
      logger?.error?.('compensation_webhook_error', { action, message: e?.message });
      return res.status(400).json({ error: String(e?.message || 'bad_request') });
    }
  });

  return router;
}
