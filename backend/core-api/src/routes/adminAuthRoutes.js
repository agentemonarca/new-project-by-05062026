import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';

const IS_DEV_BACKEND = process.env.NODE_ENV !== 'production';

/**
 * Constant-time string compare (UTF-8).
 * @param {string} a
 * @param {string} b
 */
function constTimeEq(a, b) {
  const aa = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (aa.length !== bb.length) return false;
  return timingSafeEqual(aa, bb);
}

function normalizeEmail(s) {
  return String(s ?? '').trim().toLowerCase();
}

/**
 * POST /api/admin/auth/login, POST /api/admin/login (alias), GET /api/admin/auth/me, POST /api/admin/auth/logout
 * Session flag: req.session.genesisAdmin (httpOnly cookie via express-session).
 */
export function adminLoginHandler(req, res) {
  const expectedEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  const expectedPassword = String(process.env.ADMIN_PASSWORD ?? '');
  if (!expectedEmail || !expectedPassword) {
    return res.status(503).json({ error: 'admin_login_not_configured' });
  }

  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password ?? '');

  if (IS_DEV_BACKEND) {
    console.log('LOGIN ATTEMPT:', email);
  }

  const emailOk = constTimeEq(email, expectedEmail);
  const passOk = constTimeEq(password, expectedPassword);
  if (!emailOk || !passOk) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  const finish = () => {
    req.session.genesisAdmin = true;
    req.session.adminEmail = expectedEmail;
    req.session.save((saveErr) => {
      if (saveErr) {
        return res.status(500).json({ error: 'session_error' });
      }
      console.log('Admin login success');
      return res.json({ ok: true });
    });
  };

  if (req.session?.address) {
    finish();
    return;
  }

  req.session.regenerate((regErr) => {
    if (regErr) {
      return res.status(500).json({ error: 'session_error' });
    }
    finish();
  });
}

export function adminAuthRoutes() {
  const router = Router();

  router.post('/admin/auth/login', adminLoginHandler);
  /** Alias solicitado: POST /api/admin/login (mismo body que /admin/auth/login). */
  router.post('/admin/login', adminLoginHandler);

  router.get('/admin/auth/me', (req, res) => {
    const admin = req.session?.genesisAdmin === true;
    res.json({
      admin,
      email: admin ? (req.session.adminEmail || null) : null,
    });
  });

  router.post('/admin/auth/logout', (req, res) => {
    if (!req.session) {
      return res.json({ ok: true });
    }
    delete req.session.genesisAdmin;
    delete req.session.adminEmail;
    req.session.save((err) => {
      if (err) {
        return res.status(500).json({ error: 'session_error' });
      }
      return res.json({ ok: true });
    });
  });

  return router;
}
