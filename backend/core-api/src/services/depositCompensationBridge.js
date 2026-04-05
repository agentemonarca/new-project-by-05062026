import { getAddress } from 'ethers';
import { getDepositAssetConfig, rawDepositToPrincipal } from '../utils/tokenAmount.js';

/**
 * After on-chain deposit is credited, mirror purchase into the compensation engine (same tx hash idempotency).
 */
export function createDepositCompensationBridge({ getKernel, logger }) {
  return async function onDepositVerified({ userAddress, amountWei, txHash, referrerAddress, binarySide }) {
    const kernel = getKernel();
    if (!kernel?.facade) {
      logger?.warn?.('deposit_compensation_skip', { reason: 'kernel_unavailable' });
      return;
    }

    const buyerId = String(userAddress).toLowerCase();
    const cfg = getDepositAssetConfig();
    let principal;
    try {
      principal = rawDepositToPrincipal(amountWei, {
        asset: cfg.asset,
        tokenDecimals: cfg.tokenDecimals,
      });
    } catch (e) {
      logger?.warn?.('deposit_compensation_skip', { reason: 'bad_principal', message: e?.message });
      return;
    }
    if (!Number.isFinite(principal) || principal <= 0) {
      logger?.warn?.('deposit_compensation_skip', { reason: 'bad_principal', principal });
      return;
    }

    let referrerId = null;
    if (referrerAddress) {
      try {
        referrerId = getAddress(String(referrerAddress)).toLowerCase();
        if (referrerId === buyerId) referrerId = null;
      } catch {
        referrerId = null;
      }
    }

    const side = binarySide === 2 || binarySide === '2' ? 2 : 1;

    try {
      await kernel.facade.recordPurchase({
        buyerId,
        referrerId,
        principal,
        binarySide: side,
        txRef: String(txHash).toLowerCase(),
      });
      logger?.info?.('deposit_compensation_recorded', { txHash, buyerId, principal, referrerId });
    } catch (e) {
      logger?.error?.('deposit_compensation_failed', {
        txHash,
        message: String(e?.message || e),
      });
      throw e;
    }
  };
}
