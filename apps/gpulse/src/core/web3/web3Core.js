import { BrowserProvider, Contract } from 'ethers';
import { isWeb3MockMode } from '../../utils/web3Mode.js';
import { mockProvider, mockSigner, mockTokenTransfer } from '../../utils/mockWeb3.js';
import { installMockInjectedProviderIsolation } from '../../utils/mockInjectedIsolation.js';
import { assertChain, ERC20_ABI, getWeb3Config, switchEthereumChain } from './web3PaymentSupport.js';

/**
 * Mock: mockProvider/mockSigner. Real: MetaMask u otro EIP-1193 vía `window.ethereum`.
 */

function getWindowEthereum() {
  if (typeof window === 'undefined') return null;
  return window.ethereum ?? null;
}

export function publishWeb3ModeToWindow() {
  if (typeof window === 'undefined') return;
  if (!isWeb3MockMode()) {
    window.GPULSE_WEB3_MODE = 'real';
    if (import.meta.env.DEV && import.meta.env.VITE_VERBOSE_BOOT === '1') {
      console.debug('[web3] real mode (window.ethereum, no mock isolation)');
    }
    return;
  }
  installMockInjectedProviderIsolation();
  window.GPULSE_WEB3_MODE = 'mock';
  if (import.meta.env.DEV && import.meta.env.VITE_VERBOSE_BOOT === '1') {
    console.debug('[web3] mock mode (window.GPULSE_WEB3_MODE)');
  }
}

export const getInjectedEthereum = () => (isWeb3MockMode() ? null : getWindowEthereum());

export async function createReadOnlyBrowserProvider() {
  if (isWeb3MockMode()) return null;
  const eth = getWindowEthereum();
  if (!eth) return null;
  return new BrowserProvider(eth);
}

export async function connectWallet() {
  if (isWeb3MockMode()) {
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
  const eth = getWindowEthereum();
  if (!eth?.request) {
    throw new Error('NO_WALLET');
  }
  await eth.request({ method: 'eth_requestAccounts' });
  const provider = new BrowserProvider(eth);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  return { provider, signer, address, isMock: false };
}

export async function refreshInjectedWalletSession() {
  if (isWeb3MockMode()) {
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
  const eth = getWindowEthereum();
  if (!eth?.request) {
    throw new Error('NO_WALLET');
  }
  const accounts = await eth.request({ method: 'eth_accounts' });
  if (!accounts || accounts.length === 0) {
    throw new Error('NO_ACCOUNTS');
  }
  const provider = new BrowserProvider(eth);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  return { provider, signer, address, isMock: false };
}

/** @param {bigint} expectedChainId */
export async function requestSwitchChain(expectedChainId) {
  if (isWeb3MockMode()) return;
  const eth = getWindowEthereum();
  if (!eth) throw new Error('NO_WALLET');
  await switchEthereumChain(eth, expectedChainId);
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

  const { usdtContract, receiver, chainId, configured } = getWeb3Config();
  if (!configured || !usdtContract || !receiver || chainId == null) {
    throw new Error('CONFIG_MISSING');
  }
  try {
    await assertChain(signer.provider, chainId);
    const c = new Contract(usdtContract, ERC20_ABI, signer);
    const tx = await c.transfer(receiver, amountRaw);
    return await tx.wait();
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
