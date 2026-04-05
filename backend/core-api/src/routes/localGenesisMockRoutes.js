import { Router } from 'express';

/**
 * Minimal JSON for local Genesis UI when compensation HTTP routes are not mounted.
 * Returns 200 without auth so `VITE_DEV_MOCK_BEARER` / wallet sessions can load dashboard offline.
 */
export function localGenesisMockRoutes() {
  const router = Router();

  router.get('/wallet', (_req, res) => {
    res.json({
      directClaimableUsdt: 0,
      ledgerNetUsdt: 0,
      depositBalanceWei: '0',
      sourceOfTruth: 'local_mock',
      byCategory: {},
    });
  });

  router.get('/earnings', (_req, res) => {
    res.json({ entries: [] });
  });

  router.get('/network', (_req, res) => {
    res.json({ leftMonth: 0, rightMonth: 0 });
  });

  return router;
}
