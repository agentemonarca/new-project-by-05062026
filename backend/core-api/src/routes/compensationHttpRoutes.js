import { getAddress } from 'ethers';
import { createCompensationRouter } from '../../dist/compensation/index.js';
import { getCompensationKernel } from '../services/compensationKernelSingleton.js';
import { getBalanceWei } from '../utils/balanceStore.js';

/**
 * @param {{ authService: { getSession: (t: string) => { address?: string } | null } }, logger?: object }} deps
 */
export function compensationHttpRoutes(deps) {
  const { authService } = deps;
  const kernel = getCompensationKernel();
  if (!kernel) {
    throw new Error('Compensation kernel not initialized (set COMPENSATION_ENABLED=1 before routes)');
  }

  return createCompensationRouter({
    facade: kernel.facade,
    getUserId: (req) => {
      const sess = req.session?.address;
      if (sess) return String(sess).toLowerCase();
      const raw = req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
      const s = authService.getSession(raw);
      const a = s?.address;
      return a ? String(a).toLowerCase() : null;
    },
    getDepositBalanceWei: async (normalizedLowercase) => {
      const addr = getAddress(normalizedLowercase);
      return getBalanceWei(addr);
    },
  });
}
