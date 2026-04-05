/**
 * Config + chain + ERC-20 ABI used by web3Core and web3Payment.
 * MUST NOT import web3Core or web3Payment (breaks cycles).
 */
import { isWeb3MockMode } from '../../utils/web3Mode.js';

export const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address account) view returns (uint256)',
];

/** DEV-only bypass: skip on-chain assertions when true. */
const FORCE_DEV_WEB3_BYPASS = true;

/**
 * @returns {{ usdtContract: string | null, receiver: string | null, chainId: bigint | null, configured: boolean }}
 */
export function getWeb3Config() {
  if (isWeb3MockMode()) {
    return {
      usdtContract: 'MOCK',
      receiver: 'MOCK',
      chainId: 56n,
      configured: true,
    };
  }

  const usdt =
    (typeof import.meta.env?.VITE_USDT_CONTRACT === 'string' &&
      import.meta.env.VITE_USDT_CONTRACT.trim()) ||
    null;
  const receiver =
    (typeof import.meta.env?.VITE_RECEIVER_WALLET === 'string' &&
      import.meta.env.VITE_RECEIVER_WALLET.trim()) ||
    null;
  const chainRaw = import.meta.env?.VITE_CHAIN_ID;
  let chainId = null;
  if (chainRaw != null && String(chainRaw).trim() !== '') {
    try {
      chainId = BigInt(String(chainRaw).trim());
    } catch {
      chainId = null;
    }
  }
  const configured = Boolean(usdt && receiver && chainId != null);
  return { usdtContract: usdt, receiver, chainId, configured };
}

export function chainIdToHex(chainId) {
  return '0x' + chainId.toString(16);
}

export async function isChainValid(provider, expectedChainId) {
  if (FORCE_DEV_WEB3_BYPASS || isWeb3MockMode()) return true;
  const net = await provider.getNetwork();
  return net.chainId === expectedChainId;
}

export async function assertChain(provider, expectedChainId) {
  if (FORCE_DEV_WEB3_BYPASS || isWeb3MockMode()) return;
  const ok = await isChainValid(provider, expectedChainId);
  if (!ok) {
    const net = await provider.getNetwork();
    throw new ChainMismatchError(net.chainId, expectedChainId);
  }
}

export class ChainMismatchError extends Error {
  constructor(actualChainId, expectedChainId) {
    super(`Wrong network: chainId ${actualChainId}, expected ${expectedChainId}`);
    this.name = 'ChainMismatchError';
    this.actualChainId = actualChainId;
    this.expectedChainId = expectedChainId;
  }
}

export async function switchEthereumChain(ethereum, expectedChainId) {
  if (FORCE_DEV_WEB3_BYPASS || isWeb3MockMode()) return;
  if (!ethereum?.request) {
    throw new Error('Wallet no compatible con wallet_switchEthereumChain');
  }
  await ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: chainIdToHex(expectedChainId) }],
  });
}
