import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAdmin } from '../context/AdminContext.jsx';
import { AdminPageHeader } from './AdminPageHeader.jsx';
import { staggerContainer, fadeUpBlur } from '@/ui-genesis/motion/variants.js';

function cloneCfg(c) {
  return JSON.parse(JSON.stringify(c));
}

export function AdminSettingsPage() {
  const { state, saveGlobalConfig, resetGlobalConfig, isLoading, dispatch } = useAdmin();
  const [form, setForm] = useState(() => cloneCfg(state.globalConfig));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setForm(cloneCfg(state.globalConfig));
    setDirty(false);
  }, [state.globalConfig]);

  const patch = useCallback((path, v) => {
    setForm((f) => {
      const n = cloneCfg(f);
      const parts = path.split('.');
      if (parts.length === 2) {
        const [a, b] = parts;
        n[a] = { ...n[a], [b]: v };
      }
      return n;
    });
    setDirty(true);
  }, []);

  const onSave = useCallback(async () => {
    await saveGlobalConfig(form);
    dispatch({ type: 'SET_REWARD_SYSTEM', payload: Boolean(form.rules?.rewardsEnabled) });
    setDirty(false);
  }, [form, saveGlobalConfig, dispatch]);

  const onReset = useCallback(async () => {
    await resetGlobalConfig();
  }, [resetGlobalConfig]);

  const saving = isLoading('config-save');
  const resetting = isLoading('config-reset');

  const cfg = form || state.globalConfig;
  if (!cfg?.price) return null;

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <AdminPageHeader
        eyebrow="Cerebro del sistema"
        title="Configuración global"
        subtitle="Precios P2P, límites, reglas y flags. `saveGlobalConfig` listo para API."
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={onSave}
            className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            Guardar cambios
          </button>
          <button
            type="button"
            disabled={resetting}
            onClick={onReset}
            className="rounded-xl border border-white/15 px-4 py-2 text-xs text-slate-300"
          >
            Reset demo
          </button>
        </div>
      </AdminPageHeader>

      {dirty ? (
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Cambios sin guardar.
        </p>
      ) : null}

      <motion.div variants={fadeUpBlur} className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-5">
          <h3 className="text-sm font-semibold text-white">Precio P2P</h3>
          <div className="mt-3 space-y-2">
            {[
              ['price.basePrice', 'Base price'],
              ['price.minPrice', 'Min price'],
              ['price.maxPrice', 'Max price'],
            ].map(([path, label]) => (
              <label key={path} className="block text-xs">
                <span className="text-slate-500">{label}</span>
                <input
                  type="number"
                  value={Number(cfg.price[path.split('.')[1]])}
                  onChange={(e) => patch(path, Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-5">
          <h3 className="text-sm font-semibold text-white">Órdenes</h3>
          <div className="mt-3 space-y-2">
            {[
              ['order.minOrderAmount', 'Mínimo'],
              ['order.maxOrderAmount', 'Máximo'],
            ].map(([path, label]) => (
              <label key={path} className="block text-xs">
                <span className="text-slate-500">{label}</span>
                <input
                  type="number"
                  value={Number(cfg.order[path.split('.')[1]])}
                  onChange={(e) => patch(path, Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-5">
          <h3 className="text-sm font-semibold text-white">Límites por usuario / período</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              ['limits.maxOrdersPerUser', 'Max órdenes / usuario'],
              ['limits.maxDailyOrders', 'Diario'],
              ['limits.maxWeeklyOrders', 'Semanal'],
              ['limits.maxMonthlyOrders', 'Mensual'],
            ].map(([path, label]) => (
              <label key={path} className="block text-xs">
                <span className="text-slate-500">{label}</span>
                <input
                  type="number"
                  value={Number(cfg.limits[path.split('.')[1]])}
                  onChange={(e) => patch(path, Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-sm"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-5">
          <h3 className="text-sm font-semibold text-white">Volumen diario</h3>
          <div className="mt-3 space-y-2">
            {[
              ['volume.maxBuyPerDay', 'Compra max/día'],
              ['volume.maxSellPerDay', 'Venta max/día'],
            ].map(([path, label]) => (
              <label key={path} className="block text-xs">
                <span className="text-slate-500">{label}</span>
                <input
                  type="number"
                  value={Number(cfg.volume[path.split('.')[1]])}
                  onChange={(e) => patch(path, Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
                />
              </label>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.div variants={fadeUpBlur} className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-5">
        <h3 className="text-sm font-semibold text-white">Reglas y flags</h3>
        <div className="mt-4 flex flex-col gap-3">
          {[
            {
              label: 'P2P habilitado',
              value: cfg.flags?.p2pEnabled,
              onChange: (v) => patch('flags.p2pEnabled', v),
            },
            {
              label: 'Recompensas (flag global)',
              value: cfg.rules?.rewardsEnabled ?? state.rewardSystemEnabled,
              onChange: (v) => patch('rules.rewardsEnabled', v),
            },
            {
              label: 'Mantenimiento',
              value: cfg.flags?.maintenance,
              onChange: (v) => patch('flags.maintenance', v),
            },
            {
              label: 'requireMiningToSell',
              value: cfg.rules?.requireMiningToSell,
              onChange: (v) => patch('rules.requireMiningToSell', v),
            },
            {
              label: 'requireProfile',
              value: cfg.rules?.requireProfile,
              onChange: (v) => patch('rules.requireProfile', v),
            },
          ].map((row) => (
            <label key={row.label} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-slate-900/40 px-3 py-2">
              <span className="text-sm text-slate-300">{row.label}</span>
              <input
                type="checkbox"
                checked={Boolean(row.value)}
                onChange={(e) => row.onChange(e.target.checked)}
                className="h-4 w-4 rounded border-white/20"
              />
            </label>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
