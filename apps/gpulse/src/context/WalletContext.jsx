import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { GenesisPreviewWalletBridgeContext } from './GenesisPreviewWalletBridge.jsx';
import { getWeb3Config } from '../utils/web3Payment.js';
import { runPremiumRevalidation } from '../hooks/usePremiumStatus.js';
import { isWeb3MockMode } from '../utils/web3Mode.js';
import {
  connectWallet as coreConnectWallet,
  createReadOnlyBrowserProvider,
  getInjectedEthereum,
  refreshInjectedWalletSession,
  requestSwitchChain,
} from '../core/web3/web3Core.js';

const WalletContext = createContext(null);

async function commitWalletSession(res, setters) {
  const { setCurrentChainId, setProvider, setSigner, setAddress } = setters;
  if (!res?.provider) return null;
  const net = await res.provider.getNetwork();
  setCurrentChainId(net.chainId);
  setProvider(res.provider);
  setSigner(res.signer);
  setAddress(res.address);
  try {
    await runPremiumRevalidation(res.provider);
  } catch {
    /* ignore */
  }
  return { provider: res.provider, signer: res.signer, address: res.address };
}

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [error, setError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentChainId, setCurrentChainId] = useState(null);

  const cfg = useMemo(() => getWeb3Config(), []);

  const setters = useMemo(
    () => ({ setCurrentChainId, setProvider, setSigner, setAddress }),
    [setCurrentChainId, setProvider, setSigner, setAddress],
  );

  useEffect(() => {
    if (!isWeb3MockMode()) return undefined;
    (async () => {
      try {
        const res = await refreshInjectedWalletSession();
        await commitWalletSession(res, setters);
      } catch {
        /* ignore */
      }
    })();
    return undefined;
  }, [setters]);

  const refreshWalletSession = useCallback(async () => {
    const res = await refreshInjectedWalletSession();
    if (!res) return null;
    return commitWalletSession(res, setters);
  }, [setters]);

  const disconnectWallet = useCallback(() => {
    setAddress(null);
    setProvider(null);
    setSigner(null);
    setError(null);
    setCurrentChainId(null);
  }, []);

  const connectWallet = useCallback(async () => {
    if (isWeb3MockMode()) {
      setError(null);
      const res = await coreConnectWallet();
      return commitWalletSession(res, setters);
    }
    setIsConnecting(true);
    setError(null);
    try {
      const res = await coreConnectWallet();
      return await commitWalletSession(res, setters);
    } catch (e) {
      const err =
        e instanceof Error && e.message === 'NO_WALLET'
          ? new Error('Wallet no detectada (instala MetaMask u otra wallet compatible).')
          : e instanceof Error
            ? e
            : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [setters]);

  const switchNetwork = useCallback(async () => {
    if (isWeb3MockMode()) {
      setError(null);
      await refreshWalletSession();
      return;
    }
    if (cfg.chainId == null) {
      throw new Error('VITE_CHAIN_ID no configurado');
    }
    setError(null);
    await requestSwitchChain(cfg.chainId);
    await refreshWalletSession();
  }, [cfg.chainId, refreshWalletSession]);

  useEffect(() => {
    if (isWeb3MockMode()) {
      return undefined;
    }
    const eth = getInjectedEthereum();
    if (!eth) return undefined;

    (async () => {
      try {
        const p = await createReadOnlyBrowserProvider();
        if (p) await runPremiumRevalidation(p);
      } catch {
        /* ignore */
      }
    })();

    if (!eth.on) return undefined;

    const onAccounts = (accounts) => {
      if (!accounts || accounts.length === 0) {
        disconnectWallet();
        return;
      }
      refreshWalletSession().catch(() => {
        disconnectWallet();
      });
    };

    const onChain = () => {
      refreshWalletSession().catch(() => {
        disconnectWallet();
      });
    };

    eth.on('accountsChanged', onAccounts);
    eth.on('chainChanged', onChain);
    return () => {
      try {
        eth.removeListener?.('accountsChanged', onAccounts);
        eth.removeListener?.('chainChanged', onChain);
      } catch {
        /* ignore */
      }
    };
  }, [disconnectWallet, refreshWalletSession]);

  const isWrongNetwork = useMemo(() => {
    if (isWeb3MockMode()) return false;
    if (currentChainId == null || cfg.chainId == null) return false;
    return currentChainId !== cfg.chainId;
  }, [currentChainId, cfg.chainId]);

  const value = useMemo(
    () => ({
      address,
      provider,
      signer,
      error,
      isConnecting,
      connectWallet,
      disconnectWallet,
      isWalletAvailable: isWeb3MockMode() ? true : Boolean(getInjectedEthereum()),
      currentChainId,
      expectedChainId: cfg.chainId,
      isWrongNetwork: Boolean(
        address && cfg.configured && isWrongNetwork && !isWeb3MockMode(),
      ),
      switchNetwork,
    }),
    [
      address,
      provider,
      signer,
      error,
      isConnecting,
      connectWallet,
      disconnectWallet,
      currentChainId,
      cfg.chainId,
      cfg.configured,
      isWrongNetwork,
      switchNetwork,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useOptionalWallet() {
  return useContext(WalletContext);
}

/**
 * Prefer real {@link WalletContext}; fall back to {@link GenesisPreviewWalletBridgeContext}
 * (set by GenesisDesignPreview) when lazy-loaded chunks see a null wallet context.
 */
export function useWalletResolved() {
  const primary = useContext(WalletContext);
  const bridged = useContext(GenesisPreviewWalletBridgeContext);
  const resolved = primary ?? bridged;
  if (!resolved) {
    throw new Error('useWallet debe usarse dentro de WalletProvider');
  }
  return resolved;
}

export function useWallet() {
  return useWalletResolved();
}
