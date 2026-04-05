import { Router, type Request, type Response, type NextFunction } from 'express';
import type { CompensationFacade } from '../facade/compensationFacade.js';

export type CompensationRouterDeps = {
  facade: CompensationFacade;
  /** Resolve authenticated user id (e.g. wallet address). Return null → 401. */
  getUserId: (req: Request) => string | null;
  /** Optional: verified on-chain deposit balance from core-api balance store (wei). */
  getDepositBalanceWei?: (normalizedAddress: string) => Promise<bigint>;
};

function asyncHandler(
  fn: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}

function payoutChainMeta(facade: CompensationFacade, payoutId: string | undefined) {
  if (!payoutId) return {};
  const rec = facade.payouts.get(payoutId);
  if (!rec) return { payoutId };
  const ref = String(rec.externalRef || '');
  const txHash = ref.startsWith('0x') && ref.length >= 66 ? ref : undefined;
  return {
    payoutId,
    txHash,
    payoutStatus: rec.status,
    externalRef: rec.externalRef,
  };
}

/**
 * Thin HTTP adapter — no business rules here.
 */
export function createCompensationRouter(deps: CompensationRouterDeps): Router {
  const { facade, getUserId, getDepositBalanceWei } = deps;
  const router = Router();

  const auth = (req: Request, res: Response, next: NextFunction) => {
    const id = getUserId(req);
    if (!id) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    (req as Request & { compensationUserId: string }).compensationUserId = id;
    next();
  };

  router.use(auth);

  router.get(
    '/wallet',
    asyncHandler(async (req, res) => {
      const userId = (req as Request & { compensationUserId: string }).compensationUserId;
      const w = facade.getWallet(userId);
      let depositBalanceWei = '0';
      if (getDepositBalanceWei) {
        try {
          const b = await getDepositBalanceWei(userId);
          depositBalanceWei = String(b);
        } catch {
          depositBalanceWei = '0';
        }
      }
      res.json({
        ...w,
        depositBalanceWei,
        sourceOfTruth: 'compensation_ledger',
      });
    }),
  );

  router.get(
    '/earnings',
    asyncHandler(async (req, res) => {
      const userId = (req as Request & { compensationUserId: string }).compensationUserId;
      const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
      res.json({ entries: facade.listEarnings(userId, limit) });
    }),
  );

  router.get(
    '/network',
    asyncHandler(async (req, res) => {
      const userId = (req as Request & { compensationUserId: string }).compensationUserId;
      res.json(facade.getNetwork(userId));
    }),
  );

  router.post(
    '/claim',
    asyncHandler(async (req, res) => {
      const userId = (req as Request & { compensationUserId: string }).compensationUserId;
      const type = String((req.body as { type?: string })?.type || '');
      switch (type) {
        case 'direct': {
          const r = await facade.claimDirect(userId);
          res
            .status(r.ok ? 200 : 400)
            .json({ ...r, ...payoutChainMeta(facade, r.payoutId) });
          break;
        }
        case 'mining': {
          const r = await facade.claimMining(userId);
          res.status(r.ok ? 200 : 400).json({
            ...r,
            ...payoutChainMeta(facade, r.payoutId),
          });
          break;
        }
        case 'binary': {
          const r = await facade.claimBinary(userId);
          res.status(r.ok ? 200 : 400).json({
            ...r,
            ...payoutChainMeta(facade, r.payoutId),
          });
          break;
        }
        default:
          res.status(400).json({ error: 'invalid_claim_type' });
      }
    }),
  );

  return router;
}
