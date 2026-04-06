import React, { memo, useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAdminCore } from '../../context/AdminCoreContext.jsx';
import { AdminPageHeader } from '../../components/AdminPageHeader.jsx';
import { staggerContainer, fadeUpBlur } from '../../motion/variants.js';
import { DEFAULT_WALLET_MONITORING } from '../../utils/walletAlertDetection.js';
import { cloneCfg, setAtPath } from '../../lib/adminConfigForm.js';

function SettingsModuleInner() {
  const { projectConfig, currentProject, saveProjectConfig, resetProjectConfig, isLoading } = useAdminCore();
  const [form, setForm] = useState(() => cloneCfg(projectConfig || {}));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (projectConfig && typeof projectConfig === 'object') {
      setForm(cloneCfg(projectConfig));
      setDirty(false);
    }
  }, [currentProject, projectConfig]);

  const patch = useCallback((path, v) => {
    setForm((f) => setAtPath(f, path, v));
    setDirty(true);
  }, []);

  const onSave = useCallback(async () => {
    if (!currentProject) return;
    await saveProjectConfig(currentProject, form);
    setDirty(false);
  }, [form, currentProject, saveProjectConfig]);

  const onReset = useCallback(async () => {
    if (!currentProject) return;
    await resetProjectConfig(currentProject);
  }, [currentProject, resetProjectConfig]);

  const saving = isLoading('config-save');
  const resetting = isLoading('config-reset');

  const cfg = form || projectConfig;
  if (!currentProject) {
    return <p className="text-sm text-amber-200/90">Selecciona un proyecto en el header.</p>;
  }
  if (!cfg?.limits) {
    return <p className="text-sm text-slate-500">Sin configuración para este proyecto.</p>;
  }

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <motion.div variants={fadeUpBlur}>
        <AdminPageHeader
          eyebrow="Infraestructura"
          title="Configuración técnica"
          subtitle={`Límites operativos, throughput y monitoreo · Precio AIG y reglas de pago viven en Economía · ${currentProject}`}
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
      </motion.div>

      {dirty ? (
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Cambios sin guardar.
        </p>
      ) : null}

      <motion.div variants={fadeUpBlur} className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-5 md:col-span-2">
          <h3 className="text-sm font-semibold text-white">Límites de frecuencia (órdenes)</h3>
          <p className="mt-1 text-xs text-slate-500">Cupos por usuario y ventanas temporales — control operativo.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {[
              ['limits.maxOrdersPerUser', 'Max órdenes / usuario'],
              ['limits.maxDailyOrders', 'Diario (global)'],
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
          <h3 className="text-sm font-semibold text-white">Throughput diario (anti-abuso)</h3>
          <p className="mt-1 text-xs text-slate-500">Tech caps de compra/venta · el tope USD agregado está en Economía.</p>
          <div className="mt-3 space-y-2">
            {[
              ['volume.maxBuyPerDay', 'Compra máx. / día'],
              ['volume.maxSellPerDay', 'Venta máx. / día'],
            ].map(([path, label]) => (
              <label key={path} className="block text-xs">
                <span className="text-slate-500">{label}</span>
                <input
                  type="number"
                  value={Number(cfg.volume?.[path.split('.')[1]] ?? 0)}
                  onChange={(e) => patch(path, Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-5">
          <h3 className="text-sm font-semibold text-white">Flags de producto</h3>
          <div className="mt-4 flex flex-col gap-3">
            {[
              {
                label: 'P2P habilitado (routing)',
                value: cfg.flags?.p2pEnabled,
                onChange: (v) => patch('flags.p2pEnabled', v),
              },
              {
                label: 'Modo mantenimiento',
                value: cfg.flags?.maintenance,
                onChange: (v) => patch('flags.maintenance', v),
              },
            ].map((row) => (
              <label
                key={row.label}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-slate-900/40 px-3 py-2"
              >
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
        </div>
      </motion.div>

      <motion.div variants={fadeUpBlur} className="rounded-2xl border border-amber-500/15 bg-slate-950/60 p-5">
        <h3 className="text-sm font-semibold text-white">Monitoreo tesorería (alertas Wallet)</h3>
        <p className="mt-1 text-xs text-slate-500">
          Umbrales para detección automática en el módulo Wallet (montos altos, ráfagas, rechazos).
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-slate-900/40 px-3 py-2">
            <span className="text-sm text-slate-300">Alertas habilitadas</span>
            <input
              type="checkbox"
              checked={Boolean(cfg.walletMonitoring?.enabled ?? DEFAULT_WALLET_MONITORING.enabled)}
              onChange={(e) => patch('walletMonitoring.enabled', e.target.checked)}
              className="h-4 w-4 rounded border-white/20"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ['highAmountUsd', 'Monto alto USDT/USD (≥)'],
                ['highAmountAig', 'Monto alto AIG (≥)'],
                ['rapidActivityHours', 'Ventana ráfaga (horas)'],
                ['rapidActivityMinMoves', 'Mín. movimientos en ventana'],
                ['userRejectedWithdrawalsMin', 'Retiros rechazados (alerta usuario)'],
              ]
            ).map(([key, label]) => (
              <label key={key} className="block text-xs">
                <span className="text-slate-500">{label}</span>
                <input
                  type="number"
                  value={Number(cfg.walletMonitoring?.[key] ?? DEFAULT_WALLET_MONITORING[key])}
                  onChange={(e) => patch(`walletMonitoring.${key}`, Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
                />
              </label>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export const SettingsModule = memo(SettingsModuleInner);
SettingsModule.displayName = 'SettingsModule';
