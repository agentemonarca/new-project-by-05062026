import { attachTxHashAndStatus, existsWithdrawalTxHash } from '../utils/withdrawalStore.js';
import { recordTxOutcome } from './txMetricsStore.js';
import { emitTxUpdate } from '../socket/socketHub.js';

/**
 * Broadcast and confirm a withdrawal on-chain (shared by sync API + queue worker).
 */
export async function executeWithdrawalOnChain({ recordId, userAddress, amountWei, signerService, logger }) {
  const amountBn = typeof amountWei === 'bigint' ? amountWei : BigInt(String(amountWei));

  let provider = signerService.provider;
  let wallet = signerService.wallet;

  if (signerService.rpcPool?.pickFastestHealthyProvider) {
    try {
      provider = await signerService.rpcPool.pickFastestHealthyProvider();
      wallet = signerService.wallet.connect(provider);
    } catch (e) {
      logger?.warn?.('withdraw_rpc_pool_fallback', { message: e?.message });
    }
  }

  const network = await provider.getNetwork();
  const ALLOWED_CHAIN_ID = BigInt(process.env.CHAIN_ID || 1);
  if (network?.chainId !== ALLOWED_CHAIN_ID) {
    throw new Error(`Invalid network: expected ${ALLOWED_CHAIN_ID}, got ${network?.chainId}`);
  }

  const tx = await wallet.sendTransaction({
    to: userAddress,
    value: amountBn,
  });
  const txHash = String(tx?.hash || '');

  if (await existsWithdrawalTxHash(txHash)) {
    logger?.warn?.('duplicate_withdraw_tx', { txHash, recordId });
    await attachTxHashAndStatus(recordId, txHash, 'FAILED');
    throw new Error('DUPLICATE_WITHDRAW_TX');
  }

  await attachTxHashAndStatus(recordId, txHash, 'BROADCASTED');
  emitTxUpdate({ withdrawalId: recordId, status: 'BROADCASTED', txHash, userAddress });

  const broadcastAt = Date.now();
  const receipt = await provider.waitForTransaction(txHash, 2);
  if (!receipt || receipt.status !== 1) {
    throw new Error('WITHDRAW_TX_FAILED');
  }

  await attachTxHashAndStatus(recordId, txHash, 'CONFIRMED');
  recordTxOutcome({ success: true, confirmationMs: Date.now() - broadcastAt });
  emitTxUpdate({ withdrawalId: recordId, status: 'CONFIRMED', txHash, userAddress });

  return { txHash };
}
