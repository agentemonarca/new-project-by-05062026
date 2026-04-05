import { Router } from 'express';
import crypto from 'node:crypto';
import * as ethers from 'ethers';
import { SiweMessage } from 'siwe';

/**
 * EIP-4361 SIWE — cookie session on success.
 *
 * Routes:
 * - GET|POST /nonce — issue single-use nonce (session-bound), JSON { nonce }
 * - POST /verify — body { message, signature }
 * - POST /logout
 * - GET /session
 *
 * Env:
 * - SIWE_DOMAIN — optional; defaults to X-Forwarded-Host or Host (must match client SiweMessage.domain)
 * - SIWE_ALLOWED_ORIGINS — comma-separated origins (e.g. http://localhost:5174,https://app.example.com).
 *   When set, siwe.uri origin must be listed and Origin header (if present) must match URI origin.
 * - SIWE_NONCE_TTL_MS — default 600000 (10 min). Expired nonces are rejected with reason expired_nonce.
 */

const DEFAULT_NONCE_TTL_MS = 600_000;

function nonceTtlMs() {
  const raw = process.env.SIWE_NONCE_TTL_MS;
  const n = raw != null ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 30_000 && n <= 3_600_000) return n;
  return DEFAULT_NONCE_TTL_MS;
}

function allowedOriginsList() {
  const raw = process.env.SIWE_ALLOWED_ORIGINS || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Public authority for SIWE domain binding (no port normalization — must match client `window.location.host`). */
function expectedDomain(req) {
  const configured = (process.env.SIWE_DOMAIN || '').trim();
  if (configured) return configured;
  const xf = req.get('x-forwarded-host');
  if (xf) return String(xf).split(',')[0].trim();
  return String(req.get('host') || '').trim() || 'localhost';
}

function clearNonce(req) {
  delete req.session.siweNonce;
  delete req.session.siweNonceIssuedAt;
}

function issueNonceHandler(req, res) {
  try {
    const nonce = crypto.randomBytes(16).toString('hex');
    req.session.siweNonce = nonce;
    req.session.siweNonceIssuedAt = Date.now();
    return res.json({ nonce });
  } catch (e) {
    return res.status(500).json({ success: false, reason: 'nonce_issue_failed' });
  }
}

/**
 * @param {string} siweUri
 * @param {import('express').Request} req
 * @param {string[]} allowed
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function validateUriAndOrigin(siweUri, req, allowed) {
  let messageOrigin;
  try {
    messageOrigin = new URL(siweUri).origin;
  } catch {
    return { ok: false, reason: 'invalid_uri' };
  }

  const originHeader = req.get('origin') || null;
  const referer = req.get('referer');
  let refererOrigin = null;
  if (referer) {
    try {
      refererOrigin = new URL(referer).origin;
    } catch {
      return { ok: false, reason: 'invalid_referer' };
    }
  }

  if (allowed.length > 0) {
    if (!allowed.includes(messageOrigin)) {
      return { ok: false, reason: 'origin_not_allowed' };
    }
    if (originHeader && originHeader !== messageOrigin) {
      return { ok: false, reason: 'origin_header_mismatch' };
    }
    if (!originHeader && refererOrigin && refererOrigin !== messageOrigin) {
      return { ok: false, reason: 'referer_origin_mismatch' };
    }
    return { ok: true };
  }

  // Dev / single-app: require browser hints to align with signed URI when present
  if (originHeader && originHeader !== messageOrigin) {
    return { ok: false, reason: 'origin_header_mismatch' };
  }
  if (!originHeader && refererOrigin && refererOrigin !== messageOrigin) {
    return { ok: false, reason: 'referer_origin_mismatch' };
  }
  return { ok: true };
}

export function siweAuthRoutes() {
  const router = Router();
  const ttl = nonceTtlMs();
  const allowed = allowedOriginsList();

  router.get('/nonce', issueNonceHandler);
  router.post('/nonce', issueNonceHandler);

  router.post('/verify', async (req, res) => {
    const message = req.body?.message;
    const signature = req.body?.signature;
    if (!message || !signature) {
      return res.status(400).json({ success: false, reason: 'missing_fields' });
    }

    const expectedNonce = req.session?.siweNonce;
    const issuedAt = req.session?.siweNonceIssuedAt;
    if (!expectedNonce || issuedAt == null) {
      return res.status(400).json({ success: false, reason: 'no_nonce_session' });
    }

    const age = Date.now() - Number(issuedAt);
    if (!Number.isFinite(age) || age > ttl) {
      clearNonce(req);
      return res.status(401).json({ success: false, reason: 'expired_nonce' });
    }

    let siwe;
    try {
      siwe = new SiweMessage(message);
    } catch {
      return res.status(401).json({ success: false, reason: 'invalid_message' });
    }

    if (String(siwe.nonce) !== String(expectedNonce)) {
      clearNonce(req);
      return res.status(401).json({ success: false, reason: 'nonce_mismatch' });
    }

    const domain = expectedDomain(req);
    if (!domain) {
      return res.status(500).json({ success: false, reason: 'server_domain_unconfigured' });
    }

    const uriCheck = validateUriAndOrigin(siwe.uri, req, allowed);
    if (!uriCheck.ok) {
      return res.status(401).json({ success: false, reason: uriCheck.reason });
    }

    if (String(siwe.domain) !== String(domain)) {
      clearNonce(req);
      return res.status(401).json({ success: false, reason: 'domain_mismatch' });
    }

    try {
      const result = await siwe.verify({
        signature,
        nonce: expectedNonce,
        domain,
        time: new Date().toISOString(),
      });
      if (!result.success) {
        const t = result.error?.type || 'verify_failed';
        return res.status(401).json({ success: false, reason: String(t) });
      }

      const address = ethers.getAddress(siwe.address);

      req.session.regenerate((regenErr) => {
        if (regenErr) {
          return res.status(500).json({ success: false, reason: 'session_regenerate_failed' });
        }
        req.session.address = address;
        return res.json({ success: true, address });
      });
    } catch (e) {
      return res.status(401).json({
        success: false,
        reason: e?.shortMessage || e?.message || 'invalid_signature',
      });
    }
  });

  router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ success: false, reason: 'logout_failed' });
      }
      res.json({ success: true });
    });
  });

  router.get('/session', (req, res) => {
    const address = req.session?.address ? String(req.session.address) : null;
    res.json({ authenticated: Boolean(address), address });
  });

  return router;
}
