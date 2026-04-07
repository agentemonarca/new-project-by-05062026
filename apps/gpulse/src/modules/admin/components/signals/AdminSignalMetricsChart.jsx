import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, CalendarRange, Loader2 } from 'lucide-react';
import { adminSignalsFetch } from '@/ui-genesis/lib/adminSignalsApi.js';
import { fadeUpBlur } from '@/ui-genesis/motion/variants.js';

const W = 640;
const H = 200;
const PAD = { t: 12, r: 12, b: 28, l: 40 };

/**
 * @param {number[]} values
 * @param {number} floor
 * @param {number} ceil
 */
function yDomain(values, floor, ceil) {
  const valid = values.filter((v) => v != null && !Number.isNaN(v));
  if (!valid.length) return { lo: floor, hi: ceil };
  let lo = Math.min(...valid);
  let hi = Math.max(...valid);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { lo: floor, hi: ceil };
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.08;
  return { lo: Math.max(floor, lo - pad), hi: Math.min(ceil, hi + pad) || hi + pad };
}

function scaleY(v, lo, hi, innerH) {
  if (v == null || Number.isNaN(v)) return null;
  const t = (v - lo) / (hi - lo);
  return innerH - t * innerH;
}

function scaleX(i, n, innerW) {
  if (n <= 1) return innerW / 2;
  return (i / (n - 1)) * innerW;
}

/**
 * @param {{
 *   data: object[],
 *   dataKey: string,
 *   color: string,
 *   yFixed?: { lo: number, hi: number } | null,
 *   unit?: string,
 * }} props
 */
function LineMetricChart({ data, dataKey, color, yFixed = null, unit = '' }) {
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const ys = data.map((d) => d[dataKey]);
  const { lo, hi } = yFixed
    ? { lo: yFixed.lo, hi: yFixed.hi }
    : yDomain(ys, 0, 60_000);

  const ptStrings = [];
  data.forEach((d, i) => {
    const v = d[dataKey];
    if (v == null || Number.isNaN(v)) return;
    const x = PAD.l + scaleX(i, data.length, innerW);
    const y = PAD.t + scaleY(v, lo, hi, innerH);
    ptStrings.push(`${x} ${y}`);
  });

  const lineD = ptStrings.length ? `M ${ptStrings.join(' L ')}` : '';
  const bottomY = PAD.t + innerH;
  let areaD = '';
  if (lineD && ptStrings.length) {
    const [fx] = ptStrings[0].split(' ').map(Number);
    const [lx] = ptStrings[ptStrings.length - 1].split(' ').map(Number);
    areaD = `${lineD} L ${lx} ${bottomY} L ${fx} ${bottomY} Z`;
  }

  const gradId = `grad-${dataKey}`.replace(/[^a-z0-9-]/gi, '');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-52 w-full max-w-full text-slate-500"
      role="img"
      aria-label={dataKey}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = PAD.t + innerH * (1 - t);
        return (
          <line
            key={t}
            x1={PAD.l}
            y1={y}
            x2={PAD.l + innerW}
            y2={y}
            stroke="currentColor"
            strokeOpacity={0.08}
          />
        );
      })}
      {areaD ? <path d={areaD} fill={`url(#${gradId})`} /> : null}
      {lineD ? (
        <path
          d={lineD}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {data.map((d, i) => {
        const v = d[dataKey];
        if (v == null || Number.isNaN(v)) return null;
        const x = PAD.l + scaleX(i, data.length, innerW);
        const y = PAD.t + scaleY(v, lo, hi, innerH);
        return <circle key={d.date} cx={x} cy={y} r={3.5} fill={color} stroke="#0f172a" strokeWidth={1} />;
      })}
      <text x={PAD.l} y={H - 6} fontSize="10" fill="currentColor" opacity={0.45} fontFamily="ui-monospace, monospace">
        {unit === '%' ? `0 % – 100 %` : `${Math.round(lo)}${unit} – ${Math.round(hi)}${unit}`}
      </text>
    </svg>
  );
}

/** @param {{ data: object[], color: string }} props */
function VolumeBarChart({ data, color }) {
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b - 8;
  const maxV = Math.max(1, ...data.map((d) => d.totalSignals ?? 0));
  const n = data.length;
  const gap = 3;
  const bw = n > 0 ? Math.max(2, (innerW - gap * (n - 1)) / n) : 0;
  const chartTop = PAD.t + 16;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-52 w-full max-w-full text-slate-500" role="img" aria-label="volume">
      <text x={PAD.l} y={14} fontSize="10" fill="currentColor" opacity={0.5} fontFamily="ui-monospace, monospace">
        máx. {maxV} señales / día
      </text>
      {data.map((d, i) => {
        const v = d.totalSignals ?? 0;
        const h = (v / maxV) * innerH;
        const x = PAD.l + i * (bw + gap);
        const y = chartTop + innerH - h;
        return (
          <rect
            key={d.date}
            x={x}
            y={y}
            width={bw}
            height={Math.max(0, h)}
            rx={3}
            fill={color}
            fillOpacity={0.85}
          />
        );
      })}
    </svg>
  );
}

function xTickLabel(dateStr) {
  if (!dateStr || dateStr.length < 10) return '';
  return dateStr.slice(5);
}

/** @param {{ data: object[] }} props */
function XDateTicks({ data }) {
  if (!data.length) return null;
  const step = Math.max(1, Math.ceil(data.length / 8));
  return (
    <div
      className="mt-1 flex justify-between px-1 font-mono text-[9px] text-slate-500"
      style={{ maxWidth: '100%', paddingLeft: `${(PAD.l / W) * 100}%`, paddingRight: `${(PAD.r / W) * 100}%` }}
    >
      {data.map((d, i) =>
        i % step === 0 || i === data.length - 1 ? (
          <span key={d.date}>{xTickLabel(d.date)}</span>
        ) : null,
      )}
    </div>
  );
}

/**
 * Histórico multi-día (`signal_metrics_daily`) — win rate, volumen, latencia.
 */
export function AdminSignalMetricsChart({ className = '' }) {
  const [preset, setPreset] = useState(14);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(/** @type {string | null} */ (null));
  const [mongoReady, setMongoReady] = useState(true);
  const [rows, setRows] = useState(/** @type {object[]} */ ([]));

  const range = useMemo(() => {
    const to = new Date();
    const toStr = to.toISOString().slice(0, 10);
    const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
    from.setUTCDate(from.getUTCDate() - (preset - 1));
    const fromStr = from.toISOString().slice(0, 10);
    return { fromStr, toStr };
  }, [preset]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const u = new URL('/api/admin/signals/metrics-daily', window.location.origin);
      u.searchParams.set('fromDate', range.fromStr);
      u.searchParams.set('toDate', range.toStr);
      const r = await adminSignalsFetch(u.toString());
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        setErr(j?.error || `HTTP ${r.status}`);
        setRows([]);
        return;
      }
      setMongoReady(Boolean(j.mongoReady));
      const days = Array.isArray(j.days) ? j.days : [];
      const normalized = days.map((d) => ({
        ...d,
        winRate: d.winRate != null ? Number(d.winRate) : null,
        avgLatencyMs:
          d.avgLatencyMs != null && d.avgLatencyMs !== '' ? Number(d.avgLatencyMs) : null,
      }));
      setRows(normalized);
    } catch (e) {
      setErr(String(e?.message || e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [range.fromStr, range.toStr]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <motion.div
      variants={fadeUpBlur}
      className={`rounded-2xl border border-violet-500/20 bg-slate-950/70 p-4 shadow-[inset_0_1px_0_rgba(139,92,246,0.06)] ${className}`}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-violet-300/90" strokeWidth={2} />
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200/90">
              Rendimiento histórico
            </h3>
            <p className="text-[10px] text-slate-500">
              <span className="font-mono text-slate-400">{range.fromStr}</span>
              {' → '}
              <span className="font-mono text-slate-400">{range.toStr}</span>
              {' · '}
              <code className="text-slate-600">signal_metrics_daily</code>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setPreset(d)}
              className={`rounded-lg border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors ${
                preset === d
                  ? 'border-violet-400/50 bg-violet-500/20 text-violet-100'
                  : 'border-white/10 bg-black/30 text-slate-400 hover:border-white/20'
              }`}
            >
              <CalendarRange className="mr-1 inline h-3 w-3 opacity-70" />
              {d}d
            </button>
          ))}
          <button
            type="button"
            onClick={() => load()}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-slate-300 hover:bg-white/[0.08]"
          >
            Refrescar
          </button>
        </div>
      </div>

      {!mongoReady ? (
        <p className="mb-3 text-center text-[11px] text-amber-200/90">
          Mongo no conectado en API — sin serie diaria.
        </p>
      ) : null}

      {err ? (
        <p className="mb-3 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
          {err}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Cargando métricas…</span>
        </div>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-[11px] text-slate-500">
          Sin filas en el rango. El job diario llena <span className="font-mono">signal_metrics_daily</span>.
        </p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-1">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-400/85">
              Win rate por día (%)
            </p>
            <LineMetricChart
              data={rows}
              dataKey="winRate"
              color="#34d399"
              yFixed={{ lo: 0, hi: 100 }}
              unit="%"
            />
            <XDateTicks data={rows} />
          </div>
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-400/85">
              Volumen de señales (total ingresada / día)
            </p>
            <VolumeBarChart data={rows} color="#818cf8" />
            <XDateTicks data={rows} />
          </div>
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-fuchsia-400/85">
              Latencia promedio (ms)
            </p>
            <LineMetricChart data={rows} dataKey="avgLatencyMs" color="#e879f9" unit="ms" />
            <XDateTicks data={rows} />
          </div>
        </div>
      )}
    </motion.div>
  );
}
