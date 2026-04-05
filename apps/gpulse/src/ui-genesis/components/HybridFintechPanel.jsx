import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Clock, Gift, Landmark, Wallet } from 'lucide-react';
import { useHybridRetentionStore, selectRetentionProcessing } from '../stores/hybridRetentionStore.js';
import { useMerchantDebtStore } from '../stores/merchantDebtStore.js';
import { MERCHANT_DEBT_DUE_MS } from '../marketplace/hybridPaymentEngine.js';
import { claimHybridRewardsToDemoWallet, tickHybridFintechState } from '../marketplace/hybridPaymentIntegration.js';

function formatCountdown(ms) {
  if (ms <= 0) return 'Due now';
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h`;
  return `${Math.floor(ms / 60000)}m`;
}

/**
 * Hybrid rewards (accumulated / processing / claimable) + merchant fiat debt (demo).
 * @param {{ claimCreditsDemoWallet?: boolean }} props
 */
export function HybridFintechPanel({ claimCreditsDemoWallet = false }) {
  const [tick, setTick] = useState(0);
  const totalEarnedAig = useHybridRetentionStore((s) => s.totalEarnedAig);
  const totalEarnedUsdt = useHybridRetentionStore((s) => s.totalEarnedUsdt);
  const claimableAig = useHybridRetentionStore((s) => s.claimableAig);
  const claimableUsdt = useHybridRetentionStore((s) => s.claimableUsdt);
  const pendingCashback = useHybridRetentionStore((s) => s.pendingCashback);
  const debts = useMerchantDebtStore((s) => s.debts);
  const settleDebt = useMerchantDebtStore((s) => s.settleDebt);

  const { processingAig, processingUsdt } = useMemo(
    () => selectRetentionProcessing({ pendingCashback }),
    [pendingCashback],
  );

  useEffect(() => {
    tickHybridFintechState();
    const id = window.setInterval(() => {
      tickHybridFintechState();
      setTick((t) => t + 1);
    }, 15000);
    return () => window.clearInterval(id);
  }, []);

  const openDebts = useMemo(() => debts.filter((d) => d.status === 'open'), [debts, tick]);
  const now = Date.now();

  const handleClaim = () => {
    if (claimCreditsDemoWallet) {
      const { aig, usdt } = claimHybridRewardsToDemoWallet();
      if (aig > 0 || usdt > 0) {
        window.alert(`Claimed demo cashback: +${aig.toFixed(2)} AIG, +${usdt.toFixed(2)} USDT to wallet`);
      }
    } else {
      if (claimableAig > 0 || claimableUsdt > 0) {
        useHybridRetentionStore.getState().claimAllToWallet();
        window.alert(
          `Claim queued (sim): +${claimableAig.toFixed(2)} AIG, +${claimableUsdt.toFixed(2)} USDT — connect payout rail`,
        );
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid gap-4 md:grid-cols-2"
    >
      <div className="rounded-2xl border border-cyan-500/30 bg-slate-950/70 p-4 shadow-[0_0_28px_-8px_rgba(34,211,238,0.25)]">
        <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-cyan-200/90">
          <Gift className="h-4 w-4" />
          Hybrid cashback · retention
        </div>
        <p className="mb-3 text-[11px] text-slate-500">
          1.5% per rail → <span className="text-slate-400">processing</span> → claimable after settlement delay (demo
          48h).
        </p>
        <div className="space-y-2 font-mono text-xs">
          <div className="flex justify-between text-slate-400">
            <span>Total earned (AIG)</span>
            <span className="text-cyan-200">{totalEarnedAig.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Total earned (USDT)</span>
            <span className="text-violet-200">{totalEarnedUsdt.toFixed(4)}</span>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-2 text-amber-200/90">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Processing
            </span>
            <span>
              {processingAig.toFixed(2)} AIG · {processingUsdt.toFixed(4)} USDT
            </span>
          </div>
          <div className="flex justify-between text-emerald-200/95">
            <span className="flex items-center gap-1">
              <Wallet className="h-3 w-3" />
              Claimable
            </span>
            <span>
              {claimableAig.toFixed(2)} AIG · {claimableUsdt.toFixed(4)} USDT
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClaim}
          disabled={claimableAig <= 0 && claimableUsdt <= 0}
          className="mt-3 w-full rounded-xl border border-emerald-500/40 bg-emerald-500/15 py-2 text-xs font-bold uppercase tracking-wide text-emerald-100 disabled:opacity-40"
        >
          {claimCreditsDemoWallet ? 'Claim to demo wallet' : 'Claim (simulated payout)'}
        </button>
      </div>

      <div className="rounded-2xl border border-amber-500/25 bg-slate-950/70 p-4 shadow-[0_0_28px_-8px_rgba(251,191,36,0.15)]">
        <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-amber-200/90">
          <Landmark className="h-4 w-4" />
          Merchant fiat debt
        </div>
        <p className="mb-3 text-[11px] text-slate-500">
          USDT legs accrue cover obligations; penalties apply after {MERCHANT_DEBT_DUE_MS / 86400000}d (demo).
        </p>
        {openDebts.length === 0 ? (
          <p className="text-xs text-slate-600">No open merchant debt.</p>
        ) : (
          <ul className="max-h-40 space-y-2 overflow-y-auto text-xs">
            {openDebts.map((d) => {
              const rem = d.dueAt - now;
              const overdue = rem < 0;
              return (
                <li key={d.id} className="rounded-lg border border-white/10 bg-black/30 px-2 py-2">
                  <div className="flex items-center justify-between gap-2 font-medium text-slate-200">
                    <span className="truncate">{d.merchantName}</span>
                    <span className="shrink-0 font-mono text-amber-100">${d.principalUsdt.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-500">
                    <span className={overdue ? 'text-rose-300' : ''}>
                      {overdue ? (
                        <span className="inline-flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" />
                          Overdue · penalties {d.penaltiesAccrued.toFixed(4)} USDT
                        </span>
                      ) : (
                        <>Cover by {formatCountdown(rem)}</>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => settleDebt(d.id)}
                      className="rounded-md border border-white/15 px-2 py-0.5 text-[10px] font-semibold text-slate-300 hover:bg-white/5"
                    >
                      Settle (demo)
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
