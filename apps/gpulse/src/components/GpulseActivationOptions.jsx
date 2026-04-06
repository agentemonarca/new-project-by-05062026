import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../context/WalletContext.jsx';
import TransactionFlowModal, { TX_FLOW_STATE } from './web3/TransactionFlowModal.jsx';
import { usePremiumStatus } from '../hooks/usePremiumStatus.js';
import { web3Core } from '../core/web3/web3Core.js';
import {
  assertChain,
  assertSufficientUsdtBalance,
  ChainMismatchError,
  getUsdtAmountRawFromPlan,
  getWeb3Config,
  sendPaymentToBackend,
  validateTransfer,
} from '../utils/web3Payment.js';
import { isWeb3MockMode } from '../utils/web3Mode.js';
import { aigUnitsForFullUsdPayment } from '../ui-genesis/payment/dualTokenPayment.js';
import { useLiveAigUsdPerUnit } from '../hooks/useUsdValue.js';

function truncateAddress(addr) {
  if (!addr || addr.length < 12) return addr || '';
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function truncateHash(hash) {
  if (!hash || hash.length < 18) return hash || '';
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

function isUserRejectionError(e) {
  const code = e?.code;
  if (code === 'ACTION_REJECTED' || code === 4001) return true;
  const msg = String(e?.message ?? e ?? '').toLowerCase();
  return msg.includes('user rejected') || msg.includes('user denied') || msg.includes('rejected');
}

/**
 * Opciones de activación Web3: conexión obligatoria, pago USDT, confirmación on-chain, premium local.
 * Pensado para incrustarse en la vista Pago sin alterar el marco exterior.
 */
export default function GpulseActivationOptions({ activePlan, onTrustFlowChange }) {
  const {
    address,
    signer,
    connectWallet,
    disconnectWallet,
    isConnecting,
    error: walletCtxError,
    isWrongNetwork,
    switchNetwork,
  } = useWallet();
  const { isPremium, activatePremium } = usePremiumStatus();

  const [txPhase, setTxPhase] = useState('idle');
  const [activeTxHash, setActiveTxHash] = useState(null);
  const [lastError, setLastError] = useState(null);
  const [networkBusy, setNetworkBusy] = useState(false);
  const [pkgFlowOpen, setPkgFlowOpen] = useState(false);
  const [pkgFlowState, setPkgFlowState] = useState(TX_FLOW_STATE.IDLE);
  const [pkgFlowHash, setPkgFlowHash] = useState('');
  const [pkgFlowErr, setPkgFlowErr] = useState('');

  const paymentLockRef = useRef(false);

  const cfg = useMemo(() => getWeb3Config(), []);

  const planPriceUsd = useMemo(() => {
    try {
      const raw = activePlan?.price;
      const n = parseFloat(String(raw ?? '').replace(/[^\d.]/g, ''));
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch {
      return 0;
    }
  }, [activePlan?.price]);

  const aigOracleUsd = useLiveAigUsdPerUnit();
  const fullAigForPlan = useMemo(
    () => (planPriceUsd > 0 ? aigUnitsForFullUsdPayment(planPriceUsd, aigOracleUsd) : 0),
    [planPriceUsd, aigOracleUsd],
  );

  useEffect(() => {
    onTrustFlowChange?.({ open: pkgFlowOpen, state: pkgFlowState });
  }, [pkgFlowOpen, pkgFlowState, onTrustFlowChange]);

  const isTxPipeline =
    txPhase === 'awaiting_signature' || txPhase === 'pending' || txPhase === 'confirming';

  const statusMessage = useMemo(() => {
    if (isPremium) {
      return 'Access verified';
    }
    if (txPhase === 'awaiting_signature') {
      return 'Confirm in your wallet…';
    }
    if (txPhase === 'pending') {
      return 'Transaction submitted…';
    }
    if (txPhase === 'confirming') {
      return 'Validating on-chain…';
    }
    if (txPhase === 'failed' && lastError) {
      return lastError.message || 'Payment failed';
    }
    if (!cfg.configured && !isWeb3MockMode()) {
      return 'Configura VITE_USDT_CONTRACT, VITE_RECEIVER_WALLET y VITE_CHAIN_ID para activar pago on-chain.';
    }
    if (address && isWrongNetwork) {
      return 'Wrong network';
    }
    if (!address) {
      return 'Activa tu acceso';
    }
    return 'Activa tu acceso';
  }, [isPremium, txPhase, lastError, cfg.configured, address, isWrongNetwork]);

  const subMessage = useMemo(() => {
    if (activeTxHash && (txPhase === 'pending' || txPhase === 'confirming')) {
      return `Tx ${truncateHash(activeTxHash)}`;
    }
    return null;
  }, [activeTxHash, txPhase]);

  const handleSwitchNetwork = async () => {
    setLastError(null);
    setNetworkBusy(true);
    try {
      await switchNetwork();
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      if (isUserRejectionError(e)) {
        setLastError(new Error('Network switch was cancelled'));
      } else {
        setLastError(err);
      }
    } finally {
      setNetworkBusy(false);
    }
  };

  const handlePayment = async () => {
    if (isWeb3MockMode()) {
      console.warn('🧪 Running payment in MOCK mode');
    }
    if (paymentLockRef.current) {
      return;
    }
    if (isPremium) {
      return;
    }

    setLastError(null);

    if (
      !isWeb3MockMode() &&
      (!cfg.configured || !cfg.usdtContract || !cfg.receiver || cfg.chainId == null)
    ) {
      const err = new Error('CONFIG_MISSING');
      setLastError(err);
      setTxPhase('failed');
      return;
    }

    if (address && isWrongNetwork && !isWeb3MockMode()) {
      setLastError(new Error('Wrong network'));
      return;
    }

    paymentLockRef.current = true;
    let amountRaw;
    try {
      amountRaw = getUsdtAmountRawFromPlan(activePlan);
    } catch (e) {
      paymentLockRef.current = false;
      const err = e instanceof Error ? e : new Error(String(e));
      setLastError(err);
      setTxPhase('failed');
      return;
    }

    try {
      setPkgFlowOpen(true);
      setPkgFlowErr('');
      setPkgFlowHash('');
      const packageWalletReady = Boolean(signer);
      setPkgFlowState(packageWalletReady ? TX_FLOW_STATE.SIGNING : TX_FLOW_STATE.CONNECTING);
      if (isWeb3MockMode()) {
        console.log('💸 MOCK PAYMENT FLOW ACTIVE');
      }
      let currentSigner = signer;
      if (!currentSigner) {
        const connected = await connectWallet();
        currentSigner = connected.signer;
        setPkgFlowState(TX_FLOW_STATE.SIGNING);
      }

      const userAddress = await currentSigner.getAddress();
      const payProvider = currentSigner.provider;
      if (!payProvider) {
        throw new Error('Wallet sin provider');
      }

      await assertChain(payProvider, cfg.chainId);
      await assertSufficientUsdtBalance(payProvider, cfg.usdtContract, userAddress, amountRaw);

      setTxPhase('awaiting_signature');
      setActiveTxHash(null);
      setPkgFlowState(TX_FLOW_STATE.SIGNING);

      const tx = await web3Core.sendUsdt(currentSigner, amountRaw);

      setTxPhase('pending');
      setActiveTxHash(tx.hash);
      setPkgFlowState(TX_FLOW_STATE.BROADCASTING);
      setPkgFlowHash(tx.hash);

      setTxPhase('confirming');
      setPkgFlowState(TX_FLOW_STATE.CONFIRMING);
      const receipt = await tx.wait();

      if (receipt == null) {
        throw new Error('Transaction receipt not found (dropped or replaced)');
      }
      const st = receipt.status;
      if (st == null || Number(st) !== 1) {
        throw new Error('Transaction reverted on-chain');
      }

      validateTransfer(receipt, {
        usdtContract: cfg.usdtContract,
        receiver: cfg.receiver,
        expectedValue: amountRaw,
      });

      sendPaymentToBackend({
        address: userAddress,
        txHash: receipt.hash,
        amount: ethers.formatUnits(amountRaw, 6),
        chainId: cfg.chainId.toString(),
        timestamp: Date.now(),
      });

      activatePremium(receipt.hash, {
        amountRaw,
        chainId: cfg.chainId.toString(),
      });

      setPkgFlowState(TX_FLOW_STATE.SUCCESS);
      setPkgFlowHash(receipt.hash);
      setTxPhase('idle');
      setActiveTxHash(null);
      window.setTimeout(() => setPkgFlowOpen(false), 2200);
    } catch (e) {
      let flowErr = 'Payment failed';
      if (e instanceof ChainMismatchError) {
        setLastError(new Error('Wrong network'));
        flowErr = 'Wrong network';
      } else if (isUserRejectionError(e)) {
        setLastError(new Error('Transaction cancelled in wallet'));
        flowErr = 'Transaction cancelled in wallet';
      } else {
        const err = e instanceof Error ? e : new Error(String(e));
        setLastError(err);
        flowErr = err.message || 'Payment failed';
      }
      setTxPhase('failed');
      setActiveTxHash(null);
      setPkgFlowState(TX_FLOW_STATE.ERROR);
      setPkgFlowErr(flowErr);
    } finally {
      paymentLockRef.current = false;
    }
  };

  const busy = isTxPipeline || isConnecting;
  const walletError = walletCtxError?.message;

  if (isPremium) {
    return (
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/20 px-4 py-6 text-center">
        <p className="text-[12px] font-medium text-emerald-200/95">Access verified</p>
        <p className="mt-2 text-[11px] text-white/45">Tu sesión premium está activa en este dispositivo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {planPriceUsd > 0 ? (
        <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Dual-token (precio fijo)</p>
          <p className="mt-1 font-mono text-[11px] text-slate-300">
            ${planPriceUsd.toFixed(2)} USD · ≈ {fullAigForPlan.toFixed(2)} AIG @ {aigOracleUsd.toFixed(4)} USD/AIG
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            Este flujo usa 100% USDT on-chain; en Genesis Dashboard puedes elegir AIG / mixto.
          </p>
        </div>
      ) : null}
      <div className="rounded-2xl border border-white/[0.1] bg-white/[0.04] px-4 py-5">
        <p className="text-center text-[12px] font-medium leading-relaxed text-white/75">{statusMessage}</p>
        {subMessage ? (
          <p className="mt-2 text-center font-mono text-[11px] text-cyan-400/70">{subMessage}</p>
        ) : null}
        {(walletError || (txPhase === 'failed' && lastError)) ? (
          <p className="mt-3 text-center text-[11px] text-red-400/90">{walletError || lastError?.message}</p>
        ) : null}
      </div>

      {address && cfg.configured && isWrongNetwork && !isWeb3MockMode() ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-950/25 px-4 py-4">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/90">
            Wrong network
          </p>
          <p className="mt-1.5 text-center text-[10px] text-white/45">Cambia a la red configurada para G_Pulse.</p>
          <button
            type="button"
            onClick={() => {
              handleSwitchNetwork();
            }}
            disabled={networkBusy || busy}
            className="mt-3 w-full rounded-xl border border-amber-500/45 bg-amber-500/10 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-100 transition-all hover:border-amber-400/55 hover:bg-amber-500/15 disabled:pointer-events-none disabled:opacity-40"
          >
            {networkBusy ? 'Switching…' : 'Switch network'}
          </button>
        </div>
      ) : null}

      {!address ? (
        <button
          type="button"
          onClick={() => {
            setLastError(null);
            setTxPhase('idle');
            connectWallet().catch(() => {});
          }}
          disabled={busy}
          className="w-full rounded-xl border border-cyan-500/40 bg-cyan-500/10 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-100 transition-all hover:border-cyan-400/60 hover:bg-cyan-500/15 disabled:opacity-40"
        >
          {isConnecting ? 'Conectando…' : 'Conectar wallet'}
        </button>
      ) : (
        <p className="text-center text-[11px] font-mono text-white/55">
          Wallet conectada: {truncateAddress(address)}
        </p>
      )}

      {address ? (
        <button
          type="button"
          onClick={handlePayment}
          disabled={busy || (!isWeb3MockMode() && (!cfg.configured || isWrongNetwork))}
          className={[
            'w-full rounded-xl border border-violet-500/50 bg-gradient-to-r from-violet-600/80 to-cyan-600/50 py-3.5 text-[11px] font-black uppercase tracking-[0.22em] text-white transition-all hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-45',
            isTxPipeline
              ? 'shadow-[0_0_36px_rgba(139,92,246,0.42)] ring-2 ring-violet-400/35'
              : 'shadow-[0_0_24px_rgba(139,92,246,0.25)]',
          ].join(' ')}
        >
          {busy ? 'Processing…' : 'Activa tu acceso'}
        </button>
      ) : null}

      {address ? (
        <button
          type="button"
          onClick={() => {
            disconnectWallet();
            setTxPhase('idle');
            setLastError(null);
            setActiveTxHash(null);
          }}
          disabled={busy}
          className="w-full text-center text-[10px] font-semibold uppercase tracking-widest text-white/30 hover:text-white/50 disabled:opacity-40"
        >
          Desconectar wallet
        </button>
      ) : null}
      <TransactionFlowModal
        open={pkgFlowOpen}
        state={pkgFlowState}
        txHash={pkgFlowHash}
        errorMessage={pkgFlowErr}
        title="Activación"
        isLight={false}
        onClose={() => {
          setPkgFlowOpen(false);
          setPkgFlowState(TX_FLOW_STATE.IDLE);
          setPkgFlowHash('');
          setPkgFlowErr('');
        }}
      />
    </div>
  );
}
