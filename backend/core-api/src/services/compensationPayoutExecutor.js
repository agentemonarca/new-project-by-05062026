import { getAddress } from 'ethers';
import { getValidatedPayoutWeiPerUsdt } from '../utils/payoutRateConfig.js';

/**
 * Sends native chain value for a compensation payout record.
 * Configure COMP_PAYOUT_WEI_PER_USDT (string integer): wei paid per 1.0 USDT notional unit from the ledger.
 *
 * Flow: pre-checks → (optional resume if pendingTxHash+broadcast) → send → onBroadcast (persist pending) →
 * wait for confirmations → return hash. Ledger settlement must occur only after this returns successfully.
 *
 * @param {{ signerService: { wallet: import('ethers').Wallet, provider: import('ethers').Provider, rpcPool?: { pickFastestHealthyProvider?: () => Promise<import('ethers').Provider> } }, logger?: { info?: Function, warn?: Function, error?: Function } }} deps
 */
export function createCompensationPayoutExecutor({ signerService, logger }) {
  const ALLOWED_CHAIN_ID = BigInt(process.env.CHAIN_ID || 1);

  return async function executeCompensationPayout(rec, ctx = {}) {
    const onBroadcast =
      typeof ctx.onBroadcast === 'function'
        ? ctx.onBroadcast
        : async () => {};

    let provider = signerService.provider;
    let wallet = signerService.wallet;
    if (signerService.rpcPool?.pickFastestHealthyProvider) {
      try {
        provider = await signerService.rpcPool.pickFastestHealthyProvider();
        wallet = signerService.wallet.connect(provider);
      } catch (e) {
        logger?.warn?.('comp_payout_rpc_fallback', { message: e?.message });
      }
    }

    const network = await provider.getNetwork();
    if (network?.chainId !== ALLOWED_CHAIN_ID) {
      throw new Error(`COMP_PAYOUT_BAD_CHAIN: expected ${ALLOWED_CHAIN_ID} got ${network?.chainId}`);
    }

    /** Resume after crash: tx already broadcast, only confirm. Never send a second tx. */
    if (rec.pendingTxHash && rec.chainStatus === 'broadcast') {
      const txHash = String(rec.pendingTxHash);
      logger?.info?.('comp_payout_resume_wait', { payoutId: rec.id, txHash });
      const receipt = await provider.waitForTransaction(txHash, 2);
      if (!receipt || receipt.status !== 1) {
        throw new Error('COMP_PAYOUT_TX_FAILED');
      }
      logger?.info?.('audit_payout_confirmed', {
        payoutId: rec.id,
        userId: rec.userId,
        amountUsdt: rec.amount,
        source: rec.source,
        txHash,
        resumed: true,
      });
      return { externalRef: txHash };
    }

    let perUsdt;
    try {
      perUsdt = getValidatedPayoutWeiPerUsdt().weiPerUsdt;
    } catch (e) {
      logger?.warn?.('comp_payout_skipped', {
        reason: String(e?.message || e),
        payoutId: rec.id,
      });
      return { externalRef: `skipped-no-rate:${rec.id}` };
    }

    if (perUsdt <= 0n) {
      logger?.warn?.('comp_payout_skipped', {
        reason: 'COMP_PAYOUT_WEI_PER_USDT not set',
        payoutId: rec.id,
      });
      return { externalRef: `skipped-no-rate:${rec.id}` };
    }

    const amt = Number(rec.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return { externalRef: `zero:${rec.id}` };
    }
    const micro = BigInt(Math.round(amt * 1e6));
    const value = (micro * perUsdt) / 1_000_000n;
    if (value <= 0n) {
      return { externalRef: `zero:${rec.id}` };
    }

    const to = getAddress(String(rec.userId));

    logger?.info?.('audit_payout_broadcast', {
      payoutId: rec.id,
      userId: rec.userId,
      amountUsdt: rec.amount,
      source: rec.source,
      valueWei: String(value),
      to,
    });

    const tx = await wallet.sendTransaction({ to, value });
    const txHash = String(tx?.hash || '');
    if (!txHash.startsWith('0x') || txHash.length < 66) {
      throw new Error('COMP_PAYOUT_NO_TX_HASH');
    }

    await onBroadcast(txHash);

    logger?.info?.('comp_payout_broadcast', { txHash, to, value: String(value), source: rec.source });

    const receipt = await provider.waitForTransaction(txHash, 2);
    if (!receipt || receipt.status !== 1) {
      throw new Error('COMP_PAYOUT_TX_FAILED');
    }

    logger?.info?.('audit_payout_confirmed', {
      payoutId: rec.id,
      userId: rec.userId,
      amountUsdt: rec.amount,
      source: rec.source,
      txHash,
    });

    return { externalRef: txHash };
  };
}
