import { isWeb3MockMode } from '../../utils/web3Mode.js';
import { mockProvider, mockSigner, mockTokenTransfer } from '../../utils/mockWeb3.js';
import { installMockInjectedProviderIsolation } from '../../utils/mockInjectedIsolation.js';
import { getWeb3Config } from './web3PaymentSupport.js';

/**
 * DEV: mock-only Web3 — no injected wallet, BrowserProvider, or requestAccounts.
 */

export function publishWeb3ModeToWindow() {
  if (typeof window === 'undefined') return;
  installMockInjectedProviderIsolation();
  window.GPULSE_WEB3_MODE = 'mock';
  if (import.meta.env.DEV && import.meta.env.VITE_VERBOSE_BOOT === '1') {
    console.debug('[web3] mock mode (window.GPULSE_WEB3_MODE)');
  }
}

export const getInjectedEthereum = () => null;

export async function createReadOnlyBrowserProvider() {
  return null;
}

export async function connectWallet() {
  try {
    const address = await mockSigner.getAddress();
    return {
      provider: mockProvider,
      signer: mockSigner,
      address,
      isMock: true,
    };
  } catch (e) {
    console.error('[web3Core.connectWallet]', e);
    throw e;
  }
}

export async function refreshInjectedWalletSession() {
  try {
    const address = await mockSigner.getAddress();
    return {
      provider: mockProvider,
      signer: mockSigner,
      address,
      isMock: true,
    };
  } catch (e) {
    console.error('[web3Core.refreshInjectedWalletSession]', e);
    throw e;
  }
}

export async function requestSwitchChain() {
  return;
}

/**
 * Prefer single treasury `payDual`; currently falls back to USDT-only transfer when the USDT leg is nonzero.
 * @param {import('ethers').Signer} signer
 * @param {{ aigAmountRaw: bigint, usdtAmountRaw: bigint }} legs
 */
export async function payDual(signer, legs) {
  const { executeDualTokenPayment } = await import('../../utils/dualTokenExecution.js');
  return executeDualTokenPayment(signer, legs);
}

export async function sendUsdt(signer, amountRaw) {
  if (isWeb3MockMode()) {
    console.log('💸 MOCK TRANSFER (STOP EXECUTION)');
    console.log('✅ MOCK PATH ONLY');
    return await mockTokenTransfer(amountRaw);
  }

  /* istanbul ignore next — defensive: mock branch above must return; never reach here in mock */
  if (isWeb3MockMode()) {
    throw new Error('MOCK FALLTHROUGH DETECTED');
  }

  try {
    void signer;
    const { usdtContract, receiver, configured } = getWeb3Config();
    if (!configured && !isWeb3MockMode()) {
      throw new Error('CONFIG_MISSING');
    }
    if (!configured || !usdtContract || !receiver) {
      throw new Error('CONFIG_MISSING');
    }
    throw new Error('Real Web3 send disabled in forced mock build.');
  } catch (e) {
    console.error('[web3Core.sendUsdt]', e);
    throw e;
  }
}

export const web3Core = {
  connectWallet,
  refreshInjectedWalletSession,
  requestSwitchChain,
  payDual,
  sendUsdt,
  async sendTransaction(opts) {
    const { signer, amount } = opts;
    return sendUsdt(signer, amount);
  },
  sendUsdtTransaction: sendUsdt,
  getInjectedEthereum,
  createReadOnlyBrowserProvider,
  publishWeb3ModeToWindow,
};
