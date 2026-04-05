import { Router } from 'express';
import { formatEther } from 'ethers';
import { getBalanceWei, listLedgerEvents } from '../utils/balanceStore.js';

function bearerToken(req) {
  const h = String(req.headers.authorization || '');
  return h.startsWith('Bearer ') ? h.slice('Bearer '.length).trim() : '';
}

/**
 * Read-only dashboard JSON for Backoffice (optional auth: wallet session from core-api).
 */
export function genesisDashboardRoutes({ authService }) {
  const router = Router();

  router.get('/profile', (req, res) => {
    const token = bearerToken(req);
    const session = token && authService?.getSession ? authService.getSession(token) : null;
    if (!session?.address) {
      return res.json({
        id: null,
        email: undefined,
        wallet: null,
        displayName: undefined,
        authenticated: false,
      });
    }
    const addr = String(session.address);
    return res.json({
      id: addr,
      email: undefined,
      wallet: addr,
      displayName: undefined,
      authenticated: true,
    });
  });

  router.get('/wallet', async (req, res) => {
    try {
      const token = bearerToken(req);
      const session = token && authService?.getSession ? authService.getSession(token) : null;
      if (!session?.address) {
        return res.json({ address: null, balance: null, chainId: null });
      }
      const addr = String(session.address);
      const wei = await getBalanceWei(addr);
      const balance = Number(formatEther(wei));
      return res.json({ address: addr, balance, chainId: null });
    } catch (e) {
      return res.status(500).json({ error: 'wallet_read_failed', message: e?.message });
    }
  });

  router.get('/activity', async (req, res) => {
    try {
      const token = bearerToken(req);
      const session = token && authService?.getSession ? authService.getSession(token) : null;
      if (!session?.address) {
        return res.json([]);
      }
      const addr = String(session.address);
      const raw = await listLedgerEvents(addr, 30);
      const now = Date.now();
      const items = raw.map((row, i) => {
        const weiStr = String(row.amountWei || '0');
        let subtitle = '';
        try {
          subtitle = `${formatEther(BigInt(weiStr))} ETH`;
        } catch {
          subtitle = weiStr;
        }
        return {
          id: row.id,
          type: row.type,
          title: row.type === 'deposit' ? 'Deposit credited' : 'Withdrawal',
          subtitle,
          timestamp: now - (raw.length - i) * 1000,
          amountWei: weiStr,
        };
      });
      return res.json([...items].reverse());
    } catch (e) {
      return res.status(500).json({ error: 'activity_read_failed', message: e?.message });
    }
  });

  return router;
}
