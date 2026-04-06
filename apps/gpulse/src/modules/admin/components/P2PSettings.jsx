import React, { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Save } from 'lucide-react';
import { GlassCard } from '@/ui-genesis/components/GlassCard.jsx';
import { useP2PConfigApiSafe } from '@/modules/p2p/context/P2PConfigContext.jsx';
import { useP2PConfigStore } from '@/modules/p2p/store/p2pConfigStore.js';
import { fadeUpBlur } from '@/ui-genesis/motion/variants.js';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function P2PSettingsInner() {
  const config = useP2PConfigStore((s) => s.config);
  const { updateConfig, resetConfig } = useP2PConfigApiSafe();

  const p = config.price ?? {};
  const o = config.order ?? {};
  const l = config.limits ?? {};
  const v = config.volume ?? {};
  const r = config.rules ?? {};

  const onPrice = useCallback(
    (patch) => {
      updateConfig({ price: { ...config.price, ...patch } });
    },
    [config.price, updateConfig],
  );

  const onOrder = useCallback(
    (patch) => {
      updateConfig({ order: { ...config.order, ...patch } });
    },
    [config.order, updateConfig],
  );

  const onLimits = useCallback(
    (patch) => {
      updateConfig({ limits: { ...config.limits, ...patch } });
    },
    [config.limits, updateConfig],
  );

  const onVolume = useCallback(
    (patch) => {
      updateConfig({ volume: { ...config.volume, ...patch } });
    },
    [config.volume, updateConfig],
  );

  const toggleMining = useCallback(() => {
    updateConfig({ rules: { ...config.rules, requireMiningToSell: !r.requireMiningToSell } });
  }, [config.rules, r.requireMiningToSell, updateConfig]);

  const onReset = useCallback(() => {
    resetConfig();
  }, [resetConfig]);

  const num = useCallback((ev, fn) => {
    const v2 = Number(ev.target.value);
    if (!Number.isFinite(v2)) return;
    fn(v2);
  }, []);

  return (
    <motion.section variants={fadeUpBlur} initial="hidden" animate="show" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-white md:text-xl">P2P · reglas del libro</h2>
          <p className="mt-1 text-sm text-slate-400">
            Single source of truth en store persistido. El marketplace P2P reacciona en vivo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.07]"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2} />
            Restablecer defaults
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="border-amber-500/20" contentClassName="p-5">
          <h3 className="text-sm font-bold text-amber-100/95">Precio (USD / AIG)</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Field label="Base">
              <input
                type="number"
                step="0.01"
                value={p.basePrice ?? 23}
                onChange={(e) => num(e, (n2) => onPrice({ basePrice: n2 }))}
                className="w-full rounded-lg border border-white/12 bg-slate-950/80 px-3 py-2 font-mono text-sm text-white"
              />
            </Field>
            <Field label="Mínimo">
              <input
                type="number"
                step="0.01"
                value={p.minPrice ?? 22}
                onChange={(e) => num(e, (n2) => onPrice({ minPrice: n2 }))}
                className="w-full rounded-lg border border-white/12 bg-slate-950/80 px-3 py-2 font-mono text-sm text-white"
              />
            </Field>
            <Field label="Máximo">
              <input
                type="number"
                step="0.01"
                value={p.maxPrice ?? 25}
                onChange={(e) => num(e, (n2) => onPrice({ maxPrice: n2 }))}
                className="w-full rounded-lg border border-white/12 bg-slate-950/80 px-3 py-2 font-mono text-sm text-white"
              />
            </Field>
          </div>
        </GlassCard>

        <GlassCard className="border-cyan-500/20" contentClassName="p-5">
          <h3 className="text-sm font-bold text-cyan-100/95">Cantidad por orden (AIG)</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Mínimo">
              <input
                type="number"
                step="1"
                value={o.minOrderAmount ?? 10}
                onChange={(e) => num(e, (n2) => onOrder({ minOrderAmount: n2 }))}
                className="w-full rounded-lg border border-white/12 bg-slate-950/80 px-3 py-2 font-mono text-sm text-white"
              />
            </Field>
            <Field label="Máximo">
              <input
                type="number"
                step="1"
                value={o.maxOrderAmount ?? 100000}
                onChange={(e) => num(e, (n2) => onOrder({ maxOrderAmount: n2 }))}
                className="w-full rounded-lg border border-white/12 bg-slate-950/80 px-3 py-2 font-mono text-sm text-white"
              />
            </Field>
          </div>
        </GlassCard>

        <GlassCard className="border-violet-500/20" contentClassName="p-5">
          <h3 className="text-sm font-bold text-violet-100/95">Límites de frecuencia</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Órdenes activas / usuario">
              <input
                type="number"
                step="1"
                value={l.maxOrdersPerUser ?? 10}
                onChange={(e) => num(e, (n2) => onLimits({ maxOrdersPerUser: Math.max(1, Math.floor(n2)) }))}
                className="w-full rounded-lg border border-white/12 bg-slate-950/80 px-3 py-2 font-mono text-sm text-white"
              />
            </Field>
            <Field label="Máx. órdenes / día">
              <input
                type="number"
                step="1"
                value={l.maxDailyOrders ?? 5}
                onChange={(e) => num(e, (n2) => onLimits({ maxDailyOrders: Math.max(1, Math.floor(n2)) }))}
                className="w-full rounded-lg border border-white/12 bg-slate-950/80 px-3 py-2 font-mono text-sm text-white"
              />
            </Field>
            <Field label="Máx. / semana">
              <input
                type="number"
                step="1"
                value={l.maxWeeklyOrders ?? 20}
                onChange={(e) => num(e, (n2) => onLimits({ maxWeeklyOrders: Math.max(1, Math.floor(n2)) }))}
                className="w-full rounded-lg border border-white/12 bg-slate-950/80 px-3 py-2 font-mono text-sm text-white"
              />
            </Field>
            <Field label="Máx. / mes">
              <input
                type="number"
                step="1"
                value={l.maxMonthlyOrders ?? 60}
                onChange={(e) => num(e, (n2) => onLimits({ maxMonthlyOrders: Math.max(1, Math.floor(n2)) }))}
                className="w-full rounded-lg border border-white/12 bg-slate-950/80 px-3 py-2 font-mono text-sm text-white"
              />
            </Field>
          </div>
        </GlassCard>

        <GlassCard className="border-emerald-500/20" contentClassName="p-5">
          <h3 className="text-sm font-bold text-emerald-100/95">Volumen diario (AIG)</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Máx. compra / día">
              <input
                type="number"
                step="1"
                value={v.maxBuyPerDay ?? 50000}
                onChange={(e) => num(e, (n2) => onVolume({ maxBuyPerDay: n2 }))}
                className="w-full rounded-lg border border-white/12 bg-slate-950/80 px-3 py-2 font-mono text-sm text-white"
              />
            </Field>
            <Field label="Máx. venta / día">
              <input
                type="number"
                step="1"
                value={v.maxSellPerDay ?? 50000}
                onChange={(e) => num(e, (n2) => onVolume({ maxSellPerDay: n2 }))}
                className="w-full rounded-lg border border-white/12 bg-slate-950/80 px-3 py-2 font-mono text-sm text-white"
              />
            </Field>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="border-white/15" contentClassName="p-5">
        <h3 className="text-sm font-bold text-white">Reglas</h3>
        <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={Boolean(r.requireMiningToSell)}
            onChange={toggleMining}
            className="h-4 w-4 rounded border-white/20 bg-slate-950"
          />
          Exigir minería activa para publicar ventas (`requireMiningToSell`)
        </label>
        <p className="mt-2 text-xs text-slate-500">
          Perfil obligatorio para operar: `requireProfile` permanece activo en validación (mock checkboxes en P2P).
        </p>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <Save className="h-3.5 w-3.5" />
          Los cambios se guardan automáticamente en localStorage (`aigenesis-p2p-config-v1`).
        </div>
      </GlassCard>
    </motion.section>
  );
}

export const P2PSettings = memo(P2PSettingsInner);
P2PSettings.displayName = 'P2PSettings';
