import { useCallback, useEffect, useState } from 'react';
import { getTransferAmountToReceiver, getWeb3Config, validateTransfer } from '../utils/web3Payment.js';
import { isWeb3MockMode } from '../utils/web3Mode.js';

export const STORAGE_RECORD_KEY = 'gpulse_access_v1';
export const STORAGE_PREMIUM_KEY = 'gpulse_premium';
export const STORAGE_PREMIUM_TX_KEY = 'gpulse_premium_tx';

/**
 * @typedef {{
 *   v: number,
 *   status: 'active',
 *   txHash: string,
 *   activatedAt: number,
 *   expiresAt: number | null,
 *   chainId: string,
 *   amountRaw: string
 * }} PremiumRecord
 */

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isRecordShape(o) {
  if (!o || typeof o !== 'object') return false;
  if (o.v !== 1) return false;
  if (o.status !== 'active') return false;
  if (typeof o.txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(o.txHash)) return false;
  if (typeof o.activatedAt !== 'number' || !Number.isFinite(o.activatedAt)) return false;
  if (o.expiresAt != null && (typeof o.expiresAt !== 'number' || !Number.isFinite(o.expiresAt))) return false;
  if (typeof o.chainId !== 'string' || o.chainId.trim() === '') return false;
  if (typeof o.amountRaw !== 'string' || !/^\d+$/.test(o.amountRaw)) return false;
  return true;
}

/**
 * Solo registro v1 validado.
 * @returns {PremiumRecord | null}
 */
export function readPremiumRecordSync() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_RECORD_KEY);
    if (!raw) return null;
    const o = safeJsonParse(raw);
    if (!isRecordShape(o)) {
      window.localStorage.removeItem(STORAGE_RECORD_KEY);
      return null;
    }
    return o;
  } catch {
    try {
      window.localStorage?.removeItem(STORAGE_RECORD_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function clearPremiumStorageSync() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_RECORD_KEY);
    window.localStorage.removeItem(STORAGE_PREMIUM_KEY);
    window.localStorage.removeItem(STORAGE_PREMIUM_TX_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @returns {boolean}
 */
export function isPremium() {
  const r = readPremiumRecordSync();
  if (r && r.status === 'active') {
    if (r.expiresAt != null && Date.now() > r.expiresAt) {
      clearPremiumStorageSync();
      return false;
    }
    return true;
  }
  try {
    if (window.localStorage.getItem(STORAGE_PREMIUM_KEY) === 'true' && window.localStorage.getItem(STORAGE_PREMIUM_TX_KEY)) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Revalidación on-chain al cargar.
 * @param {import('ethers').BrowserProvider} provider
 */
export async function runPremiumRevalidation(provider) {
  const cfg = getWeb3Config();
  if (
    !isWeb3MockMode() &&
    (!cfg.configured || !cfg.usdtContract || !cfg.receiver || cfg.chainId == null)
  ) {
    return;
  }

  const net = await provider.getNetwork();
  if (net.chainId !== cfg.chainId) {
    return;
  }

  const v1 = readPremiumRecordSync();
  if (v1 && v1.status === 'active') {
    try {
      if (BigInt(v1.chainId) !== cfg.chainId) {
        clearPremiumStorageSync();
        return;
      }
      const receipt = await provider.getTransactionReceipt(v1.txHash);
      if (receipt == null || receipt.status == null || Number(receipt.status) !== 1) {
        clearPremiumStorageSync();
        return;
      }
      validateTransfer(receipt, {
        usdtContract: cfg.usdtContract,
        receiver: cfg.receiver,
        expectedValue: BigInt(v1.amountRaw),
      });
    } catch {
      clearPremiumStorageSync();
    }
    return;
  }

  let legacyTx = null;
  try {
    const legacyOk = window.localStorage.getItem(STORAGE_PREMIUM_KEY) === 'true';
    legacyTx = window.localStorage.getItem(STORAGE_PREMIUM_TX_KEY);
    if (!legacyOk || !legacyTx || !/^0x[0-9a-fA-F]{64}$/.test(legacyTx)) {
      return;
    }
  } catch {
    return;
  }

  try {
    const receipt = await provider.getTransactionReceipt(legacyTx);
    if (receipt == null || receipt.status == null || Number(receipt.status) !== 1) {
      clearPremiumStorageSync();
      return;
    }
    const inferred = getTransferAmountToReceiver(receipt, cfg.usdtContract, cfg.receiver);
    if (inferred == null) {
      clearPremiumStorageSync();
      return;
    }
    validateTransfer(receipt, {
      usdtContract: cfg.usdtContract,
      receiver: cfg.receiver,
      expectedValue: inferred,
    });
    const migrated = {
      v: 1,
      status: 'active',
      txHash: legacyTx,
      activatedAt: Date.now(),
      expiresAt: null,
      chainId: String(cfg.chainId),
      amountRaw: inferred.toString(),
    };
    window.localStorage.setItem(STORAGE_RECORD_KEY, JSON.stringify(migrated));
    window.localStorage.removeItem(STORAGE_PREMIUM_KEY);
    window.localStorage.removeItem(STORAGE_PREMIUM_TX_KEY);
  } catch {
    clearPremiumStorageSync();
  }
}

const PREMIUM_SYNC_EVENT = 'gpulse-premium-sync';

export function usePremiumStatus() {
  const [premium, setPremium] = useState(() => isPremium());
  const [lastTxHash, setLastTxHash] = useState(() => readPremiumRecordSync()?.txHash ?? null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const sync = () => {
      setPremium(isPremium());
      setLastTxHash(readPremiumRecordSync()?.txHash ?? null);
    };
    window.addEventListener(PREMIUM_SYNC_EVENT, sync);
    return () => window.removeEventListener(PREMIUM_SYNC_EVENT, sync);
  }, []);

  const activatePremium = useCallback((txHash, { amountRaw, chainId }) => {
    if (typeof window === 'undefined') return;
    try {
      const h = String(txHash).trim();
      const ar = typeof amountRaw === 'bigint' ? amountRaw.toString() : String(amountRaw);
      const cid = String(chainId);
      const record = {
        v: 1,
        status: 'active',
        txHash: h,
        activatedAt: Date.now(),
        expiresAt: null,
        chainId: cid,
        amountRaw: ar,
      };
      if (!isRecordShape(record)) {
        return;
      }
      window.localStorage.setItem(STORAGE_RECORD_KEY, JSON.stringify(record));
      window.localStorage.removeItem(STORAGE_PREMIUM_KEY);
      window.localStorage.removeItem(STORAGE_PREMIUM_TX_KEY);
      setLastTxHash(h);
      setPremium(true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(PREMIUM_SYNC_EVENT));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const clearPremium = useCallback(() => {
    clearPremiumStorageSync();
    setLastTxHash(null);
    setPremium(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(PREMIUM_SYNC_EVENT));
    }
  }, []);

  return {
    isPremium: premium,
    activatePremium,
    clearPremium,
    lastTxHash,
  };
}
