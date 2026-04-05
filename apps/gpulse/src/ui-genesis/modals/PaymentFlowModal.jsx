import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ChevronRight, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { GlassModal } from '../components/GlassModal.jsx';
import { NeonInput } from '../components/NeonInput.jsx';
import { GradientButton } from '../components/GradientButton.jsx';
import { GlowBadge } from '../components/GlowBadge.jsx';
import { computeTokenBreakdown, PAYMENT_FLOW_PRODUCTS } from '../payment/paymentFlowProducts.js';

/** @typedef {import('../payment/paymentFlowProducts.js').PaymentFlowProductId} PaymentFlowProductId */

const MIN_NOTIONAL_USDT = 10;
const DIRECT_BONUS_RATE = 0.11;

function makeMockTxHash() {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

const STEPS = ['input', 'validation', 'confirm', 'processing', 'success'];

/**
 * Unified activation payment UX — Booster, Mining, Staking, GPulse membership.
 *
 * @param {{
 *   open: boolean,
 *   productId: PaymentFlowProductId,
 *   onClose: () => void,
 *   onComplete: (detail: {
 *     product: string,
 *     usdt: number,
 *     aig: number,
 *     totalUsdtEquivalent: number,
 *     txHash: string,
 *     ts: number,
 *     binaryVolumePts: number,
 *     directBonusUsdt: number,
 *   }) => void,
 *   balanceUsdt: number,
 *   balanceAig: number,
 *   hasSession: boolean,
 *   userEconomicallyActive: boolean,
 *   accountFrozen: boolean,
 *   holdingPctAig: number,
 *   minHoldingPct: number,
 * }} props
 */
export function PaymentFlowModal({
  open,
  productId,
  onClose,
  onComplete,
  balanceUsdt,
  balanceAig,
  hasSession,
  userEconomicallyActive,
  accountFrozen,
  holdingPctAig,
  minHoldingPct,
}) {
  const product = PAYMENT_FLOW_PRODUCTS[productId] ?? PAYMENT_FLOW_PRODUCTS.booster;
  const [step, setStep] = useState(/** @type {typeof STEPS[number]} */ ('input'));
  const [amountStr, setAmountStr] = useState('');
  const [resultHash, setResultHash] = useState('');
  const [impact, setImpact] = useState(
    /** @type {{ binaryPts: number, directUsdt: number, productLabel: string } | null} */ (null),
  );

  const amountNum = useMemo(() => {
    const n = parseFloat(String(amountStr).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }, [amountStr]);

  const breakdown = useMemo(() => computeTokenBreakdown(productId, amountNum), [productId, amountNum]);

  useEffect(() => {
    if (!open) return;
    setStep('input');
    setAmountStr('');
    setResultHash('');
    setImpact(null);
  }, [open, productId]);

  const validationChecks = useMemo(() => {
    const { usdt, aig } = computeTokenBreakdown(productId, amountNum);
    return [
      { id: 'session', ok: hasSession, label: 'Sesión activa' },
      { id: 'economic', ok: userEconomicallyActive, label: 'Cuenta económicamente activa' },
      { id: 'frozen', ok: !accountFrozen, label: 'Sin congelamiento por holding' },
      { id: 'holding', ok: !hasSession || holdingPctAig + 0.05 >= minHoldingPct, label: `Holding ≥ ~${minHoldingPct}% AIG` },
      { id: 'min', ok: amountNum >= MIN_NOTIONAL_USDT, label: `Importe ≥ ${MIN_NOTIONAL_USDT} USDT` },
      { id: 'balU', ok: usdt <= balanceUsdt + 1e-6, label: 'Balance USDT suficiente' },
      { id: 'balA', ok: aig <= balanceAig + 1e-6, label: 'Balance AIG suficiente' },
    ];
  }, [
    hasSession,
    userEconomicallyActive,
    accountFrozen,
    holdingPctAig,
    minHoldingPct,
    amountNum,
    productId,
    balanceUsdt,
    balanceAig,
  ]);

  const dismissible = step === 'input' || step === 'validation' || step === 'confirm' || step === 'success';

  const title = `Activación · ${product.label}`;

  const goProcess = useCallback(async () => {
    setStep('processing');
    const hash = makeMockTxHash();
    const totalEq = breakdown.totalUsdtEquivalent;
    const binaryPts = totalEq;
    const directBonusUsdt = totalEq * DIRECT_BONUS_RATE;

    await new Promise((r) => setTimeout(r, 1600));

    onComplete?.({
      product: productId,
      usdt: breakdown.usdt,
      aig: breakdown.aig,
      totalUsdtEquivalent: totalEq,
      txHash: hash,
      ts: Date.now(),
      binaryVolumePts: binaryPts,
      directBonusUsdt,
    });

    setResultHash(hash);
    setImpact({
      binaryPts,
      directUsdt: directBonusUsdt,
      productLabel: product.label,
    });
    setStep('success');
  }, [breakdown, onComplete, product.label, productId]);

  return (
    <GlassModal
      open={open}
      onClose={dismissible ? onClose : () => {}}
      title={title}
      size="lg"
      dismissible={dismissible}
    >
      <div className="px-6 py-5">
        <div className="mb-4 flex flex-wrap gap-2">
          <GlowBadge tone="cyan">Paso {STEPS.indexOf(step) + 1}/{STEPS.length}</GlowBadge>
          <GlowBadge tone="violet">{product.shortLabel}</GlowBadge>
          {product.usdtShare > 0 ? <GlowBadge tone="neutral">{Math.round(product.usdtShare * 100)}% USDT</GlowBadge> : null}
          {product.aigShare > 0 ? <GlowBadge tone="neutral">{Math.round(product.aigShare * 100)}% AIG</GlowBadge> : null}
        </div>

        <AnimatePresence mode="wait">
          {step === 'input' ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-4"
            >
              <p className="text-sm text-slate-400">
                Introduce el importe en <span className="text-slate-200">USDT equivalente</span>. El sistema calcula el reparto
                exacto según el producto.
              </p>
              <NeonInput
                label="Importe notional (USDT)"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder={`Mín. ${MIN_NOTIONAL_USDT}`}
              />
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Desglose</p>
                <ul className="mt-2 space-y-1.5 font-mono text-xs text-slate-300">
                  <li className="flex justify-between">
                    <span>USDT</span>
                    <span>{breakdown.usdt.toFixed(4)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>AIG</span>
                    <span>{breakdown.aig.toFixed(4)}</span>
                  </li>
                  <li className="flex justify-between border-t border-white/10 pt-2 text-cyan-200/90">
                    <span>Equiv. total</span>
                    <span>{breakdown.totalUsdtEquivalent.toFixed(2)} USDT</span>
                  </li>
                </ul>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <GradientButton variant="ghost" type="button" onClick={onClose}>
                  Cancelar
                </GradientButton>
                <GradientButton type="button" onClick={() => setStep('validation')}>
                  Validar <ChevronRight className="ml-1 inline h-4 w-4" />
                </GradientButton>
              </div>
            </motion.div>
          ) : null}

          {step === 'validation' ? (
            <motion.div
              key="validation"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-4"
            >
              <ul className="space-y-2">
                {validationChecks.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-sm">
                    {c.ok ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400/90" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-rose-400/90" />
                    )}
                    <span className={c.ok ? 'text-slate-300' : 'text-rose-200/90'}>{c.label}</span>
                  </li>
                ))}
              </ul>
              {validationChecks.some((c) => !c.ok) ? (
                <div className="rounded-lg border border-rose-500/25 bg-rose-500/[0.07] px-3 py-2 text-xs text-rose-100/90">
                  Corrige los puntos marcados en rojo antes de continuar.
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2 text-xs text-emerald-100/90">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  Elegibilidad OK — puedes confirmar la operación simulada.
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <GradientButton variant="ghost" type="button" onClick={() => setStep('input')}>
                  Atrás
                </GradientButton>
                <GradientButton
                  type="button"
                  disabled={validationChecks.some((c) => !c.ok)}
                  onClick={() => setStep('confirm')}
                >
                  Continuar
                </GradientButton>
              </div>
            </motion.div>
          ) : null}

          {step === 'confirm' ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-4"
            >
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] p-4 text-sm text-slate-200">
                <p className="font-display text-base font-semibold text-white">Resumen</p>
                <dl className="mt-3 space-y-2 font-mono text-xs">
                  <div className="flex justify-between">
                    <dt>Producto</dt>
                    <dd>{product.label}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>USDT</dt>
                    <dd>{breakdown.usdt.toFixed(4)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>AIG</dt>
                    <dd>{breakdown.aig.toFixed(4)}</dd>
                  </div>
                  <div className="flex justify-between text-cyan-200/95">
                    <dt>Notional</dt>
                    <dd>{breakdown.totalUsdtEquivalent.toFixed(2)} USDT</dd>
                  </div>
                </dl>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Al confirmar se simula la transacción, se registra hash, volumen binario (+100% notional), bono directo de referencia
                (11%) y asientos en el libro local.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <GradientButton variant="ghost" type="button" onClick={() => setStep('validation')}>
                  Atrás
                </GradientButton>
                <GradientButton type="button" onClick={() => void goProcess()}>
                  Confirmar pago
                </GradientButton>
              </div>
            </motion.div>
          ) : null}

          {step === 'processing' ? (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-10"
            >
              <Loader2 className="h-12 w-12 animate-spin text-cyan-400/90" />
              <p className="text-center text-sm text-slate-300">Procesando activación…</p>
              <p className="text-center text-[11px] text-slate-500">Firmando operación · sincronizando libro</p>
            </motion.div>
          ) : null}

          {step === 'success' && impact ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 text-emerald-200/95">
                <CheckCircle2 className="h-6 w-6" />
                <span className="font-display text-lg font-semibold">Activación registrada</span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 font-mono text-[11px] text-slate-300">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Hash</p>
                <p className="mt-1 break-all text-cyan-200/90">{resultHash}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.06] p-3 text-xs">
                  <p className="text-[10px] text-slate-500">Volumen binario</p>
                  <p className="mt-1 font-mono text-violet-100">+{impact.binaryPts.toFixed(2)} pts</p>
                </div>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3 text-xs">
                  <p className="text-[10px] text-slate-500">Bono directo (11%)</p>
                  <p className="mt-1 font-mono text-amber-100">+{impact.directUsdt.toFixed(4)} USDT</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Producto: <span className="text-slate-200">{impact.productLabel}</span> — motor local actualizado; revisa Historial
                para el detalle contable.
              </p>
              <div className="flex justify-end pt-2">
                <GradientButton type="button" onClick={onClose}>
                  Listo
                </GradientButton>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </GlassModal>
  );
}

export default PaymentFlowModal;
