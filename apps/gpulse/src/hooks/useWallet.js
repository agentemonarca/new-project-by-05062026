import { useCallback, useEffect, useState } from 'react';
import { BrowserProvider, formatEther, getAddress } from 'ethers';
import { isWeb3MockMode } from '../utils/web3Mode.js';

/**
 * Lightweight injected-wallet hook (ethers v6) for UI modules that should not depend on WalletContext.
 * For G-Pulse premium wallet button / demos. Prefer WalletContext for membership / USDT payments.
 */
export function useWallet() {
  const [address, setAddress] = useState(null);
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connectWallet = useCallback(async () => {
    setError(null);
    setIsConnecting(true);
    try {
      if (isWeb3MockMode()) {
        throw new Error('No Web3 wallet');
      }
      if (typeof window === 'undefined' || !window?.ethereum) {
        throw new Error('No Web3 wallet');
      }
      const provider = new BrowserProvider(window?.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const addr = getAddress(await signer.getAddress());
      setAddress(addr);
      const balWei = await provider.getBalance(addr);
      setBalance(formatEther(balWei));
      return { provider, signer, address: addr };
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    if (isWeb3MockMode()) return null;
    if (typeof window === 'undefined' || !window?.ethereum || !address) return null;
    const provider = new BrowserProvider(window?.ethereum);
    const balWei = await provider.getBalance(address);
    const f = formatEther(balWei);
    setBalance(f);
    return f;
  }, [address]);

  const disconnectWallet = useCallback(() => {
    setAddress(null);
    setBalance(null);
    setError(null);
  }, []);

  const getAddressFn = useCallback(() => address, [address]);
  const getBalanceFn = useCallback(() => balance, [balance]);

  useEffect(() => {
    if (isWeb3MockMode()) return undefined;
    const eth = typeof window !== 'undefined' ? window?.ethereum : null;
    if (!eth?.on) return undefined;
    const onAccounts = (accounts) => {
      if (!accounts?.length) {
        disconnectWallet();
        return;
      }
      try {
        setAddress(getAddress(accounts[0]));
      } catch {
        disconnectWallet();
      }
    };
    eth.on('accountsChanged', onAccounts);
    return () => {
      try {
        eth.removeListener?.('accountsChanged', onAccounts);
      } catch {
        /* ignore */
      }
    };
  }, [disconnectWallet]);

  return {
    connectWallet,
    getAddress: getAddressFn,
    getBalance: getBalanceFn,
    refreshBalance,
    disconnectWallet,
    isConnected: Boolean(address),
    address,
    balance,
    error,
    isConnecting,
  };
}
