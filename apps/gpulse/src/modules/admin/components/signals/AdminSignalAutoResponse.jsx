import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bot,
  Loader2,
  Play,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { adminSignalsFetch } from '@/ui-genesis/lib/adminSignalsApi.js';
import { GradientButton } from '@/ui-genesis/components/GradientButton.jsx';
import { fadeUpBlur } from '@/ui-genesis/motion/variants.js';

const LABELS = {
  WINRATE_CRITICAL: 'Win rate crítico',
  WINRATE_DROP: 'Caída win rate',
  LATENCY_SPIKE: 'Pico latencia',
  LOW_VOLUME: 'Volumen bajo',
};

function actionLabel(a) {
  switch (a) {
    case 'disable_signals':
      return 'Ocultar señales a usuarios';
    case 'cautela_delay':
      return 'Delay +1000 ms (cautela)';
    case 'increase_delay':
      return 'Subir delay (~800 ms)';
    case 'info_only':
      return 'Solo log informativo';
    case 'none':
      return 'Sin acción';
    default:
      return a;
  }
}

/**
 * Panel auto-respuesta (alertas diarias → runtime).
 */
export function AdminSignalAutoResponse({ className = '' }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runBusy, setRunBusy] = useState(false);
  const [err, setErr] = useState(/** @type {string | null} */ (null));
  const [state, setState] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [draftActions, setDraftActions] = useState(/** @type {Record<string, string>} */ ({}));

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await adminSignalsFetch('/api/admin/signals/auto-response-config');
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        setErr(j?.error || `HTTP ${r.status}`);
        return;
      }
      setState(j);
      if (j.actions && typeof j.actions === 'object') {
        setDraftActions({ ...j.actions });
      }
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveAll = async () => {
    setSaving(true);
    setErr(null);
    try {
      const r = await adminSignalsFetch('/api/admin/signals/auto-response-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: state?.enabled,
          actions: draftActions,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        setErr(j?.error || `HTTP ${r.status}`);
        return;
      }
      setState(j);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const setEnabled = async (enabled) => {
    setSaving(true);
    setErr(null);
    try {
      const r = await adminSignalsFetch('/api/admin/signals/auto-response-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, actions: draftActions }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        setErr(j?.error || `HTTP ${r.status}`);
        return;
      }
      setState(j);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    setRunBusy(true);
    setErr(null);
    try {
      const r = await adminSignalsFetch('/api/admin/signals/auto-response/run', {
        method: 'POST',
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        setErr(j?.error || `HTTP ${r.status}`);
        return;
      }
      await load();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setRunBusy(false);
    }
  };

  const validActions = Array.isArray(state?.validActions) ? state.validActions : [];
  const enabled = Boolean(state?.enabled);

  return (
    <motion.div
      variants={fadeUpBlur}
      className={`rounded-2xl border border-emerald-500/20 bg-slate-950/75 p-4 ${className}`}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2">
          <Bot className="mt-0.5 h-4 w-4 text-emerald-300/90" strokeWidth={2} />
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200/90">
              Auto-respuesta
            </h3>
            <p className="text-[10px] text-slate-500">
              Reacciona a alertas diarias · scheduler en API (intervalo configurable)
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => setEnabled(!enabled)}
            className={`rounded-lg border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide ${
              enabled
                ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-100'
                : 'border-white/10 bg-black/35 text-slate-400'
            }`}
          >
            {enabled ? 'ON' : 'OFF'}
          </button>
          <GradientButton
            type="button"
            variant="ghost"
            disabled={runBusy || loading}
            className="!border-white/12 !bg-white/[0.05] !py-1.5 !text-[10px] !text-slate-200"
            onClick={() => runNow()}
          >
            {runBusy ? (
              <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
            ) : (
              <Play className="mr-1 inline h-3 w-3" />
            )}
            Ejecutar ahora
          </GradientButton>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Cargando…</span>
        </div>
      ) : null}

      {err ? (
        <p className="mb-3 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
          {err}
        </p>
      ) : null}

      {!loading && state ? (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {state.cautelaMode ? (
              <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-100">
                <ShieldAlert className="h-3 w-3" />
                Modo cautela
              </span>
            ) : null}
            {state.latencyWarning ? (
              <span className="inline-flex items-center gap-1 rounded-lg border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-[10px] text-orange-100">
                <SlidersHorizontal className="h-3 w-3" />
                Warning latencia
              </span>
            ) : null}
            {!state.cautelaMode && !state.latencyWarning ? (
              <span className="inline-flex items-center gap-1 rounded-lg border border-slate-600/40 bg-slate-500/10 px-2 py-1 text-[10px] text-slate-400">
                <ShieldCheck className="h-3 w-3" />
                Sin flags activos
              </span>
            ) : null}
          </div>

          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Acciones por tipo de alerta
          </p>
          <div className="mb-3 space-y-2">
            {Object.keys(LABELS).map((key) => (
              <label
                key={key}
                className="flex flex-col gap-1 rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-[11px] text-slate-300">
                  <span className="font-mono text-[10px] text-slate-500">{key}</span>
                  <span className="ml-2 text-slate-400">{LABELS[key]}</span>
                </span>
                <select
                  className="max-w-full rounded-md border border-white/10 bg-black/50 px-2 py-1 font-mono text-[11px] text-white"
                  value={draftActions[key] ?? 'none'}
                  onChange={(e) =>
                    setDraftActions((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                >
                  {validActions.map((a) => (
                    <option key={a} value={a}>
                      {actionLabel(a)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <GradientButton
            type="button"
            variant="ghost"
            disabled={saving}
            className="!mb-4 !w-full !border-emerald-500/25 !bg-emerald-500/10 !py-2 !text-xs !text-emerald-100 sm:!w-auto"
            onClick={() => saveAll()}
          >
            {saving ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : null}
            Guardar acciones
          </GradientButton>

          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Última ejecución
          </p>
          <div className="max-h-48 overflow-auto rounded-lg border border-white/[0.06] bg-black/40 p-2 font-mono text-[10px] text-slate-400">
            {state.lastRunAt ? (
              <p className="mb-2 text-slate-500">
                {new Date(state.lastRunAt).toLocaleString()} UTC local
              </p>
            ) : (
              <p className="mb-2 text-slate-600">Aún sin ciclo registrado</p>
            )}
            <pre className="whitespace-pre-wrap break-all text-[10px] leading-relaxed">
              {state.lastAction
                ? JSON.stringify(state.lastAction, null, 2)
                : '—'}
            </pre>
          </div>
        </>
      ) : null}
    </motion.div>
  );
}
