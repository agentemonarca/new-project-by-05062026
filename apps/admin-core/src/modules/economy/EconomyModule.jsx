import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Calculator, Gift, Landmark, Scale } from 'lucide-react';
import { useAdminCore } from '../../context/AdminCoreContext.jsx';
import { AdminPageHeader } from '../../components/AdminPageHeader.jsx';
import { staggerContainer, fadeUpBlur } from '../../motion/variants.js';
import { cloneCfg, setAtPath } from '../../lib/adminConfigForm.js';

const TABS = [
  { id: 'price', label: 'Precio', icon: Landmark },
  { id: 'bonuses', label: 'Bonos', icon: Gift },
  { id: 'rules', label: 'Reglas', icon: Scale },
  { id: 'sim', label: 'Simulación', icon: Calculator },
];

function EconomyModuleInner() {
  const {
    projectConfig,
    currentProject,
    projectRewards,
    rewardSystemEnabled,
    saveProjectConfig,
    resetProjectConfig,
    setRewardSystem,
    isLoading,
  } = useAdminCore();

  const [tab, setTab] = useState('price');
  const [form, setForm] = useState(() => cloneCfg(projectConfig || {}));
  const [dirty, setDirty] = useState(false);

  const [simAmount, setSimAmount] = useState('1000');
  const [simPrice, setSimPrice] = useState('');

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
    await setRewardSystem(currentProject, Boolean(form.rules?.rewardsEnabled), { notify: false });
    setDirty(false);
  }, [form, currentProject, saveProjectConfig, setRewardSystem]);

  const onReset = useCallback(async () => {
    if (!currentProject) return;
    await resetProjectConfig(currentProject);
  }, [currentProject, resetProjectConfig]);

  const saving = isLoading('config-save');
  const resetting = isLoading('config-reset');

  const cfg = form || projectConfig;

  const simAnalysis = useMemo(() => {
    if (!cfg?.price || !cfg?.order) return null;
    const amt = Number(simAmount);
    const px = simPrice === '' ? Number(cfg.price.basePrice) : Number(simPrice);
    const minP = Number(cfg.price.minPrice);
    const maxP = Number(cfg.price.maxPrice);
    const minO = Number(cfg.order.minOrderAmount);
    const maxO = Number(cfg.order.maxOrderAmount);
    const cap = Number(cfg.volume?.dailyCapUsd ?? 0);
    const notional = Number.isFinite(amt) && Number.isFinite(px) ? amt * px : NaN;

    const rows = [];
    if (!Number.isFinite(amt) || amt <= 0) {
      rows.push({ ok: false, text: 'Indica una cantidad (> 0).' });
    } else if (!Number.isFinite(px) || px <= 0) {
      rows.push({ ok: false, text: 'Precio de simulación inválido.' });
    } else {
      rows.push({
        ok: amt >= minO && amt <= maxO,
        text: `Cantidad ${amt >= minO && amt <= maxO ? 'dentro' : 'fuera'} del rango de orden (${minO} – ${maxO}).`,
      });
      rows.push({
        ok: px >= minP && px <= maxP,
        text: `Precio ${px >= minP && px <= maxP ? 'dentro' : 'fuera'} del corredor AIG (${minP} – ${maxP}).`,
      });
      rows.push({
        ok: !Number.isFinite(notional) || cap <= 0 || notional <= cap,
        text:
          cap > 0
            ? `Notional ~${notional.toLocaleString()} vs tope diario USD ${cap.toLocaleString()}.`
            : 'Sin tope dailyCapUsd definido en volumen.',
      });
    }

    const p2p = cfg.p2p;
    let feeHint = null;
    if (p2p && typeof p2p === 'object' && Number.isFinite(notional) && notional > 0) {
      const maker = Number(p2p.makerFeeBps) || 0;
      const taker = Number(p2p.takerFeeBps) || 0;
      const feeM = (notional * maker) / 10000;
      const feeT = (notional * taker) / 10000;
      feeHint = {
        maker,
        taker,
        feeM,
        feeT,
      };
    }

    return { rows, notional, feeHint };
  }, [cfg, simAmount, simPrice]);

  if (!currentProject) {
    return <p className="text-sm text-amber-200/90">Selecciona un proyecto en el header.</p>;
  }
  if (!cfg?.price || !cfg?.order) {
    return <p className="text-sm text-slate-500">Sin configuración económica para este proyecto.</p>;
  }

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <motion.div variants={fadeUpBlur}>
        <AdminPageHeader
          eyebrow="Economía · Treasury"
          title="Parámetros financieros"
          subtitle={`Precio AIG, bonificación, reglas de pago y sandbox · ${currentProject}`}
        >
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={onSave}
              className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              Guardar economía
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
          Cambios sin guardar en economía.
        </p>
      ) : null}

      <motion.div
        variants={fadeUpBlur}
        className="flex flex-wrap gap-1 rounded-2xl border border-white/[0.08] bg-slate-950/50 p-1"
        role="tablist"
        aria-label="Secciones economía"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition sm:flex-initial sm:px-4 ${
                on
                  ? 'bg-cyan-500/20 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.25)]'
                  : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
              }`}
            >
              <Icon className="h-4 w-4 opacity-80" aria-hidden />
              {t.label}
            </button>
          );
        })}
      </motion.div>

      {tab === 'price' ? (
        <motion.div variants={fadeUpBlur} className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-5">
          <h3 className="text-sm font-semibold text-white">Precio AIG (banda de referencia)</h3>
          <p className="mt-1 text-xs text-slate-500">
            Corredor operativo del token de referencia en operaciones P2P y valoraciones internas.
          </p>
          <div className="mt-4 space-y-3 sm:max-w-md">
            {[
              ['price.basePrice', 'Precio base'],
              ['price.minPrice', 'Piso'],
              ['price.maxPrice', 'Techo'],
            ].map(([path, label]) => (
              <label key={path} className="block text-xs">
                <span className="text-slate-500">{label}</span>
                <input
                  type="number"
                  step="any"
                  value={Number(cfg.price[path.split('.')[1]])}
                  onChange={(e) => patch(path, Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
                />
              </label>
            ))}
          </div>
        </motion.div>
      ) : null}

      {tab === 'bonuses' ? (
        <motion.div variants={fadeUpBlur} className="space-y-4">
          <div className="rounded-2xl border border-emerald-500/20 bg-slate-950/60 p-5">
            <h3 className="text-sm font-semibold text-white">Política de bonos y recompensas</h3>
            <p className="mt-1 text-xs text-slate-500">
              Sincroniza <span className="font-mono text-slate-400">rules.rewardsEnabled</span> con el motor de
              recompensas del proyecto.
            </p>
            <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-slate-900/40 px-3 py-3">
              <div>
                <span className="text-sm font-medium text-slate-200">Recompensas / bonos habilitados</span>
                <p className="text-[11px] text-slate-500">
                  Estado runtime:{' '}
                  <span className="font-mono text-cyan-200/80">{rewardSystemEnabled ? 'ON' : 'OFF'}</span>
                </p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(cfg.rules?.rewardsEnabled)}
                onChange={(e) => patch('rules.rewardsEnabled', e.target.checked)}
                className="h-4 w-4 rounded border-white/20"
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  currentProject &&
                  setRewardSystem(currentProject, !rewardSystemEnabled, { notify: true })
                }
                className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
              >
                Toggle rápido (solo estado)
              </button>
            </div>
          </div>

          {projectRewards ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-[10px] font-bold uppercase text-emerald-300/90">Pool (vista)</p>
                <p className="mt-1 font-mono text-xl text-white">
                  {Number(projectRewards.poolUsd).toLocaleString()} USD
                </p>
              </div>
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                <p className="text-[10px] font-bold uppercase text-cyan-300/90">Distribuido hoy</p>
                <p className="mt-1 font-mono text-xl text-white">
                  {Number(projectRewards.distributedToday).toLocaleString()} USD
                </p>
              </div>
            </div>
          ) : null}

          <p className="text-xs text-slate-500">
            El detalle por usuario sigue en el módulo <span className="text-slate-400">Recompensas</span>.
          </p>
        </motion.div>
      ) : null}

      {tab === 'rules' ? (
        <motion.div variants={fadeUpBlur} className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-5">
            <h3 className="text-sm font-semibold text-white">Tamaño de operaciones (pago)</h3>
            <p className="mt-1 text-xs text-slate-500">Límites económicos por orden en el mercado primario.</p>
            <div className="mt-4 space-y-3">
              {[
                ['order.minOrderAmount', 'Monto mínimo'],
                ['order.maxOrderAmount', 'Monto máximo'],
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
            <h3 className="text-sm font-semibold text-white">Techo de volumen (USD)</h3>
            <p className="mt-1 text-xs text-slate-500">Cap diario agregado en moneda de cuenta.</p>
            <label className="mt-4 block text-xs">
              <span className="text-slate-500">volume.dailyCapUsd</span>
              <input
                type="number"
                value={Number(cfg.volume?.dailyCapUsd ?? 0)}
                onChange={(e) => patch('volume.dailyCapUsd', Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-amber-500/15 bg-slate-950/60 p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-white">Reglas de elegibilidad (pago / venta)</h3>
            <div className="mt-4 flex flex-col gap-3">
              {[
                {
                  label: 'Exigir mining activo para vender',
                  value: cfg.rules?.requireMiningToSell,
                  onChange: (v) => patch('rules.requireMiningToSell', v),
                },
                {
                  label: 'Exigir perfil completo',
                  value: cfg.rules?.requireProfile,
                  onChange: (v) => patch('rules.requireProfile', v),
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
      ) : null}

      {tab === 'sim' ? (
        <motion.div variants={fadeUpBlur} className="rounded-2xl border border-cyan-500/20 bg-slate-950/60 p-5">
          <h3 className="text-sm font-semibold text-white">Simulación de orden (sandbox)</h3>
          <p className="mt-1 text-xs text-slate-500">
            Comprueba restricciones sin persistir — usa la configuración actual del formulario (incl. sin guardar).
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="text-slate-500">Cantidad (unidades)</span>
              <input
                type="number"
                step="any"
                value={simAmount}
                onChange={(e) => setSimAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs">
              <span className="text-slate-500">Precio límite (vacío = base)</span>
              <input
                type="number"
                step="any"
                value={simPrice}
                onChange={(e) => setSimPrice(e.target.value)}
                placeholder={String(cfg.price.basePrice)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
              />
            </label>
          </div>
          {simAnalysis ? (
            <ul className="mt-4 space-y-2">
              {simAnalysis.rows.map((r, i) => (
                <li
                  key={i}
                  className={`rounded-lg px-3 py-2 text-xs ${
                    r.ok ? 'bg-emerald-500/10 text-emerald-100' : 'bg-rose-500/10 text-rose-100'
                  }`}
                >
                  {r.text}
                </li>
              ))}
              {Number.isFinite(simAnalysis.notional) && simAnalysis.notional > 0 ? (
                <li className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
                  Notional estimado:{' '}
                  <span className="font-mono text-cyan-200">{simAnalysis.notional.toLocaleString()}</span>
                </li>
              ) : null}
              {simAnalysis.feeHint ? (
                <li className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
                  P2P fees (referencia · bps): maker {simAnalysis.feeHint.maker} →{' '}
                  <span className="font-mono text-slate-200">
                    {simAnalysis.feeHint.feeM.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>{' '}
                  · taker {simAnalysis.feeHint.taker} →{' '}
                  <span className="font-mono text-slate-200">
                    {simAnalysis.feeHint.feeT.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </li>
              ) : null}
            </ul>
          ) : null}
        </motion.div>
      ) : null}
    </motion.div>
  );
}

export const EconomyModule = memo(EconomyModuleInner);
EconomyModule.displayName = 'EconomyModule';
