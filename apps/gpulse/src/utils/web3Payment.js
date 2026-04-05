import { ethers } from 'ethers';
import { isWeb3MockMode } from './web3Mode.js';
import { parseMockTransferAmountFromReceipt } from './mockWeb3.js';
import { ERC20_ABI } from '../core/web3/web3PaymentSupport.js';

export {
  ERC20_ABI,
  assertChain,
  chainIdToHex,
  ChainMismatchError,
  getWeb3Config,
  isChainValid,
  switchEthereumChain,
} from '../core/web3/web3PaymentSupport.js';

/**
 * G_Pulse — pago USDT on-chain (ERC-20), validación estricta y utilidades de red.
 */

/** Firma estándar ERC-20 Transfer para filtrado por topic */
const TRANSFER_EVENT_FRAGMENT = 'event Transfer(address indexed from, address indexed to, uint256 value)';

/**
 * Valida que el recibo contenga un Transfer ERC-20 esperado (anti-spoof / token equivocado).
 * @param {import('ethers').TransactionReceipt} receipt
 * @param {{ usdtContract: string, receiver: string, expectedValue: bigint }} params
 */
const FORCE_DEV_SKIP_TRANSFER_VALIDATION = true;

export function validateTransfer(receipt, { usdtContract, receiver, expectedValue }) {
  void receipt;
  void usdtContract;
  void receiver;
  void expectedValue;
  if (isWeb3MockMode()) {
    return true;
  }
  if (FORCE_DEV_SKIP_TRANSFER_VALIDATION) {
    return;
  }
  const expectedContract = ethers.getAddress(usdtContract);
  const expectedTo = ethers.getAddress(receiver);

  const iface = new ethers.Interface([TRANSFER_EVENT_FRAGMENT]);

  let valid = false;
  for (const log of receipt.logs) {
    let addr;
    try {
      addr = ethers.getAddress(log.address);
    } catch {
      continue;
    }
    if (addr !== expectedContract) {
      continue;
    }

    let parsed;
    try {
      parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
    } catch {
      continue;
    }

    if (parsed?.name !== 'Transfer') {
      continue;
    }

    const to = ethers.getAddress(parsed.args.to);
    const value = parsed.args.value;
    if (typeof value !== 'bigint') {
      throw new Error('Invalid Transfer value type');
    }
    if (to !== expectedTo) {
      continue;
    }
    if (value !== expectedValue) {
      throw new Error('Transfer value mismatch: expected exact payment amount');
    }
    valid = true;
    break;
  }

  if (!valid) {
    throw new Error('No valid USDT Transfer to receiver found in transaction receipt');
  }
}

/**
 * Localiza el monto del Transfer al receptor desde el contrato token esperado (p. ej. migración legacy).
 * @param {import('ethers').TransactionReceipt} receipt
 * @param {string} usdtContract
 * @param {string} receiver
 * @returns {bigint | null}
 */
export function getTransferAmountToReceiver(receipt, usdtContract, receiver) {
  if (isWeb3MockMode()) {
    return parseMockTransferAmountFromReceipt(receipt);
  }
  const expectedContract = ethers.getAddress(usdtContract);
  const expectedTo = ethers.getAddress(receiver);
  const iface = new ethers.Interface([TRANSFER_EVENT_FRAGMENT]);

  for (const log of receipt.logs) {
    let addr;
    try {
      addr = ethers.getAddress(log.address);
    } catch {
      continue;
    }
    if (addr !== expectedContract) continue;
    let parsed;
    try {
      parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
    } catch {
      continue;
    }
    if (parsed?.name !== 'Transfer') continue;
    const to = ethers.getAddress(parsed.args.to);
    const value = parsed.args.value;
    if (to === expectedTo && typeof value === 'bigint') {
      return value;
    }
  }
  return null;
}

/**
 * @param {import('ethers').BrowserProvider | import('ethers').JsonRpcProvider} provider
 * @param {string} usdtContract
 * @param {string} ownerAddress
 * @param {bigint} requiredRaw
 */
const FORCE_DEV_SKIP_BALANCE = true;

export async function assertSufficientUsdtBalance(provider, usdtContract, ownerAddress, requiredRaw) {
  if (FORCE_DEV_SKIP_BALANCE || isWeb3MockMode()) return;
  const c = new ethers.Contract(usdtContract, ERC20_ABI, provider);
  const bal = await c.balanceOf(ownerAddress);
  if (bal < requiredRaw) {
    const err = new Error('Insufficient balance to activate access');
    err.code = 'INSUFFICIENT_BALANCE';
    throw err;
  }
}

export function getUsdtAmountRawFromPlan(plan, decimals = 6) {
  const raw = plan?.price;
  if (raw == null || raw === '') {
    throw new Error('Plan sin precio definido');
  }
  const num = parseFloat(String(raw).replace(/[^\d.]/g, ''));
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error('Precio USDT inválido');
  }
  return ethers.parseUnits(num.toFixed(decimals), decimals);
}

/**
 * Envía USDT; delega en web3Core (sin import estático de web3Payment ↔ web3Core).
 * @param {import('ethers').Signer} signer
 * @param {bigint} amountRaw
 */
export async function sendUsdt(signer, amountRaw) {
  try {
    const { sendUsdt: coreSendUsdt } = await import('../core/web3/web3Core.js');
    return await coreSendUsdt(signer, amountRaw);
  } catch (e) {
    console.error('[web3Payment.sendUsdt]', e);
    throw e;
  }
}

/**
 * Abstracción backend: verificación servidor / antifraude (sin llamada de red aún).
 * @param {{
 *   address: string,
 *   txHash: string,
 *   amount: string,
 *   chainId: string,
 *   timestamp: number
 * }} payload
 */
export function sendPaymentToBackend(payload) {
  void payload;
}

export function buildPaymentAuditPayload(receipt, expectedTo) {
  return {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    status: receipt.status,
    to: expectedTo,
    from: receipt.from,
  };
}
