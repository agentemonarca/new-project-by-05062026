/**
 * On-chain dual settlement: prefer single payDual(aig, usdt), fallback sequential transfers.
 */
import { isWeb3MockMode } from './web3Mode.js';
import { mockTokenTransfer } from './mockWeb3.js';
import { getWeb3Config } from '../core/web3/web3PaymentSupport.js';
import { sendUsdt } from './web3Payment.js';

/**
 * @param {import('ethers').Signer} signer
 * @param {{ aigAmountRaw: bigint, usdtAmountRaw: bigint }} amounts
 * @returns {Promise<{ primaryHash: string, usdtReceipt?: import('ethers').TransactionReceipt }>}
 */
export async function executeDualTokenPayment(signer, amounts) {
  const { aigAmountRaw, usdtAmountRaw } = amounts;
  const usdt = BigInt(usdtAmountRaw || 0n);
  const aig = BigInt(aigAmountRaw || 0n);

  if (isWeb3MockMode()) {
    if (usdt > 0n) {
      const tx = await mockTokenTransfer(usdt);
      return { primaryHash: tx.hash, usdtReceipt: await tx.wait?.() };
    }
    return { primaryHash: `mock-aig-only-${Date.now()}` };
  }

  void aig;
  const { configured } = getWeb3Config();
  if (!configured) {
    throw new Error('CONFIG_MISSING');
  }

  if (usdt > 0n) {
    const tx = await sendUsdt(signer, usdt);
    const receipt = await tx.wait();
    return { primaryHash: tx.hash, usdtReceipt: receipt ?? undefined };
  }

  throw new Error('AIG-only on-chain path not wired — use internal ledger or deploy payDual');
}
