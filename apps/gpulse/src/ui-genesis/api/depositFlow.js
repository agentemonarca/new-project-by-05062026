import { BrowserProvider, parseEther } from 'ethers';
import { isWeb3MockMode } from '../../utils/web3Mode.js';
import { getInjectedEthereum } from '../../utils/ethereumProvider.js';
import { getApiBaseUrl, getMasterWalletAddress } from './genesisConfig.js';

/**
 * Native deposit: send to master wallet, wait confirmations, POST /api/verify-deposit.
 * Mirrors main App flow; expects backend + MASTER_WALLET_ADDRESS configured.
 *
 * @param {{ userAddress: string, amountEther: string, expectedChainId?: bigint }} p
 */
export async function executeNativeDeposit({ userAddress, amountEther, expectedChainId }) {
  const master = getMasterWalletAddress();
  if (!master) throw new Error('VITE_MASTER_WALLET_ADDRESS is not set');

  if (isWeb3MockMode()) throw new Error('No injected wallet');
  const injected = typeof window !== 'undefined' ? getInjectedEthereum() : null;
  if (!injected) throw new Error('No injected wallet');
  const provider = new BrowserProvider(injected);
  const network = await provider.getNetwork();
  if (expectedChainId != null && network.chainId !== expectedChainId) {
    throw new Error(`Wrong network: expected ${expectedChainId}, got ${network.chainId}`);
  }

  const signer = await provider.getSigner();
  const from = String(userAddress).toLowerCase();
  const signerAddr = String(await signer.getAddress()).toLowerCase();
  if (from !== signerAddr) throw new Error('Wallet address mismatch');

  const value = parseEther(String(amountEther));
  const tx = await signer.sendTransaction({ to: master, value });
  const txHash = String(tx?.hash || '');
  if (!txHash) throw new Error('No transaction hash');

  const receipt = await provider.waitForTransaction(txHash, 2);
  if (!receipt || receipt.status !== 1) throw new Error('Transaction failed on-chain');

  const base = getApiBaseUrl();
  const resp = await fetch(`${base}/api/verify-deposit`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      txHash,
      amount: amountEther,
      userAddress,
    }),
  });
  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok || payload?.success !== true) {
    throw new Error(payload?.reason || 'BACKEND_VERIFY_FAILED');
  }

  return { txHash, payload };
}
