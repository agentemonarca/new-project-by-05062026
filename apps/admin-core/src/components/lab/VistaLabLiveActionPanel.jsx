import React, { memo, useMemo, useState, useSyncExternalStore } from 'react';
import { Activity, Pause, Play, Radio } from 'lucide-react';
import {
  getSignalStreamDebugServerSnapshot,
  getSignalStreamDebugSnapshot,
  subscribeSignalStreamDebug,
} from '../../realtime/signalStreamDebugStore.js';

/** @param {unknown} frame */
function frameLayers(frame) {
  if (!frame || typeof frame !== 'object') return null;
  const f = /** @type {Record<string, unknown>} */ (frame);
  const layers = f.layers;
  return layers && typeof layers === 'object' && !Array.isArray(layers) ? /** @type {Record<string, unknown>} */ (layers) : null;
}

/** @param {unknown} layers */
function pickFaseNombre(layers) {
  const fase = layers && typeof layers === 'object' && layers !== null && 'fase' in layers ? /** @type {any} */ (layers).fase : null;
  if (fase && typeof fase === 'object' && fase.nombre != null) return String(fase.nombre);
  return '—';
}

/** @param {unknown} layers */
function pickVigilancia(layers) {
  const v = layers && typeof layers === 'object' && layers !== null && 'vigilancia' in layers ? /** @type {any} */ (layers).vigilancia : null;
  if (v && typeof v === 'object' && v.estado != null) return String(v.estado);
  return '—';
}

/** @param {unknown} layers */
function pickSignalTipo(layers) {
  const s = layers && typeof layers === 'object' && layers !== null && 'señal' in layers ? /** @type {any} */ (layers).señal : null;
  if (s && typeof s === 'object' && s.tipo != null) return String(s.tipo);
  return '—';
}

/** @param {unknown} layers */
function pickContext(layers) {
  const c = layers && typeof layers === 'object' && layers !== null && 'contexto' in layers ? /** @type {any} */ (layers).contexto : null;
  if (!c || typeof c !== 'object') return { mesa: '—', round: '—' };
  return {
    mesa: c.mesa != null ? String(c.mesa) : '—',
    round: c.round != null ? String(c.round) : '—',
  };
}

/** @param {unknown} layers */
function pickResumen(layers) {
  const ex = layers && typeof layers === 'object' && layers !== null && 'explicacion' in layers ? /** @type {any} */ (layers).explicacion : null;
  if (ex && typeof ex === 'object' && ex.resumen != null) return String(ex.resumen);
  return '';
}

const FASE_BADGE = {
  OBSERVE: 'border-slate-500/40 bg-slate-500/10 text-slate-200',
  PREPARE: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-100',
  EXECUTE: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
  RECOVER: 'border-orange-500/40 bg-orange-500/10 text-orange-100',
  STABILIZE: 'border-teal-500/40 bg-teal-500/10 text-teal-100',
  ALERT: 'border-rose-500/45 bg-rose-500/15 text-rose-100',
};

const VIG_BADGE = {
  PENDING: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
  ACTIVE: 'border-sky-500/40 bg-sky-500/10 text-sky-100',
  WON: 'border-emerald-500/45 bg-emerald-500/10 text-emerald-100',
  LOST: 'border-rose-500/45 bg-rose-500/15 text-rose-100',
  TIE: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-100',
  'N/A': 'border-white/10 bg-white/5 text-[#848E9C]',
};

const UI_PAUSED_KEY = 'vistalab.pipeline.uiPaused';

function readUiPaused() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(UI_PAUSED_KEY) === '1';
  } catch {
    return false;
  }
}

function persistUiPaused(paused) {
  try {
    localStorage.setItem(UI_PAUSED_KEY, paused ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/**
 * @param {{ socketConnected: boolean, onResume: () => void, bufferedFrames?: number }} props
 */
function VistaLabPipelinePausedBar({ socketConnected, onResume, bufferedFrames = 0 }) {
  return (
    <div
      className="overflow-hidden rounded-2xl border shadow-[0_0_40px_rgba(252,213,53,0.06)]"
      style={{ borderColor: '#2B3139', backgroundColor: 'rgba(11, 14, 17, 0.92)' }}
      data-testid="vistalab-live-action-panel-paused"
    >
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5"
        style={{ borderColor: '#2B3139', background: 'linear-gradient(90deg, rgba(252,213,53,0.06), transparent)' }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Pause className="h-4 w-4 shrink-0 text-[#848E9C]" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#B7BDC6]">Acción en vivo · pipeline</p>
            <p className="text-[10px] text-[#5E6673]">
              Pausado · no se muestra el visor (el buffer sigue recibiendo{' '}
              <span className="font-mono text-[#848E9C]">signal_stream_frame</span>
              {bufferedFrames > 0 ? ` · ${bufferedFrames} en memoria` : ''}).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-mono font-semibold ${
              socketConnected ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/35 bg-rose-500/10 text-rose-100'
            }`}
          >
            <Radio className="h-3 w-3" aria-hidden />
            {socketConnected ? 'Socket OK' : 'Sin socket'}
          </span>
          <button
            type="button"
            onClick={onResume}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#FCD535]/40 bg-[#FCD535]/10 px-3 py-1.5 text-[11px] font-semibold text-[#FCD535] transition hover:bg-[#FCD535]/15"
          >
            <Play className="h-3.5 w-3.5" aria-hidden />
            Mostrar
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Pipeline en vivo: `signal_stream_frame` (core-api).
 * @param {{ socketConnected: boolean, onPause: () => void, snap: ReturnType<typeof getSignalStreamDebugSnapshot> }} props
 */
function VistaLabLiveActionContent({ socketConnected, onPause, snap }) {
  const latest = snap.frames.length > 0 ? snap.frames[0] : null;
  const latestRec = latest && typeof latest === 'object' ? /** @type {Record<string, unknown>} */ (latest) : null;
  const layers = frameLayers(latest);

  const faseNombre = pickFaseNombre(layers);
  const vig = pickVigilancia(layers);
  const tipo = pickSignalTipo(layers);
  const ctx = pickContext(layers);
  const resumen = pickResumen(layers);

  const eventName = latestRec?.eventName != null ? String(latestRec.eventName) : '—';
  const origin = latestRec?.origin != null ? String(latestRec.origin) : '—';
  const source = latestRec?.source != null ? String(latestRec.source) : null;
  const ts = latestRec?.ts != null && Number.isFinite(Number(latestRec.ts)) ? Number(latestRec.ts) : null;

  const timeline = useMemo(() => {
    return snap.frames.slice(0, 14).map((fr, i) => {
      const r = fr && typeof fr === 'object' ? /** @type {Record<string, unknown>} */ (fr) : {};
      const L = frameLayers(fr);
      const t = r.ts != null && Number.isFinite(Number(r.ts)) ? Number(r.ts) : 0;
      return {
        key: `${t}-${i}-${String(r.eventName ?? '')}`,
        t,
        eventName: r.eventName != null ? String(r.eventName) : '—',
        origin: r.origin != null ? String(r.origin) : '—',
        fase: pickFaseNombre(L),
        vig: pickVigilancia(L),
        mesa: pickContext(L).mesa,
      };
    });
  }, [snap.frames, snap.rev]);

  const c = snap.latestCounters;

  return (
    <div
      className="overflow-hidden rounded-2xl border shadow-[0_0_40px_rgba(252,213,53,0.06)]"
      style={{ borderColor: '#2B3139', backgroundColor: 'rgba(11, 14, 17, 0.92)' }}
      data-testid="vistalab-live-action-panel"
    >
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: '#2B3139', background: 'linear-gradient(90deg, rgba(252,213,53,0.08), transparent)' }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
            style={{ borderColor: '#FCD53555', backgroundColor: 'rgba(252,213,53,0.1)' }}
          >
            <Activity className="h-5 w-5 text-[#FCD535]" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight text-[#EAECEF]">Acción en vivo · pipeline</h3>
            <p className="mt-0.5 text-[10px] leading-snug text-[#848E9C]">
              Socket <span className="font-mono text-[#C8CDD4]">/admin-signals</span> → evento → relay/intérprete →{' '}
              <span className="text-[#0ECB81]/95">fase</span> + <span className="text-violet-300/90">vigilancia</span> (
              <span className="font-mono">signal_stream_frame</span>).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <button
            type="button"
            onClick={onPause}
            title="Ocultar el visor del pipeline (puedes volver a mostrarlo cuando quieras)"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.12] bg-black/25 px-2 py-1 font-semibold text-[#B7BDC6] transition hover:border-white/20 hover:bg-white/[0.06]"
          >
            <Pause className="h-3 w-3" aria-hidden />
            Pausa
          </button>
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono font-semibold ${
              socketConnected ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/35 bg-rose-500/10 text-rose-100'
            }`}
          >
            <Radio className="h-3 w-3" aria-hidden />
            {socketConnected ? 'Socket OK' : 'Sin socket'}
          </span>
          {ts != null ? (
            <span className="rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 font-mono text-[#848E9C]">
              último frame · {new Date(ts).toLocaleTimeString()}
            </span>
          ) : (
            <span className="text-[#5E6673]">Sin frames aún</span>
          )}
        </div>
      </div>

      <div className="grid gap-3 p-4 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-7">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#5E6673]">Último evento procesado</p>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg border border-[#FCD535]/35 bg-[#FCD535]/5 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-[#FCD535]">
              {eventName}
            </span>
            <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-[#C8CDD4]">
              origen: <span className="font-mono text-[#EAECEF]">{origin}</span>
              {source ? (
                <>
                  {' '}
                  · <span className="font-mono text-[#848E9C]">{source}</span>
                </>
              ) : null}
            </span>
            <span
              className={`rounded-lg border px-2.5 py-1.5 font-mono text-[11px] font-semibold ${FASE_BADGE[faseNombre] ?? 'border-white/10 bg-white/5 text-[#EAECEF]'}`}
            >
              Fase · {faseNombre}
            </span>
            <span
              className={`rounded-lg border px-2.5 py-1.5 font-mono text-[11px] font-semibold ${VIG_BADGE[vig] ?? 'border-white/10 bg-white/5 text-[#C8CDD4]'}`}
            >
              Vigilancia · {vig}
            </span>
            <span className="rounded-lg border border-violet-500/30 bg-violet-500/5 px-2.5 py-1.5 font-mono text-[11px] text-violet-100/95">
              Tipo señal · {tipo}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 text-[11px] text-[#848E9C]">
            <span>
              Mesa <span className="font-mono text-[#EAECEF]">{ctx.mesa}</span>
            </span>
            <span>
              Ronda <span className="font-mono text-[#EAECEF]">{ctx.round}</span>
            </span>
          </div>
          {resumen ? (
            <p className="rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2 text-[11px] leading-relaxed text-[#B7BDC6]" title={resumen}>
              {resumen.length > 420 ? `${resumen.slice(0, 420)}…` : resumen}
            </p>
          ) : (
            <p className="text-[11px] text-[#5E6673]">
              Cuando llegue tráfico, aquí verás el resumen interpretado (misma fuente que Debug → Interpretación del stream).
            </p>
          )}
        </div>

        <div className="lg:col-span-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#5E6673]">Contadores sesión (intérprete)</p>
          {!c || typeof c !== 'object' ? (
            <p className="mt-2 text-[11px] text-[#5E6673]">Sin contadores aún.</p>
          ) : (
            <div className="mt-2 grid max-h-44 gap-2 overflow-y-auto rounded-lg border border-white/[0.06] bg-black/20 p-2 text-[10px]">
              {'eventos' in c && c.eventos && typeof c.eventos === 'object' ? (
                <div>
                  <span className="font-semibold text-[#848E9C]">Eventos</span>
                  <ul className="mt-1 space-y-0.5 font-mono text-[#C8CDD4]">
                    {Object.entries(/** @type {Record<string, number>} */ (c.eventos))
                      .filter(([, n]) => Number(n) > 0)
                      .slice(0, 8)
                      .map(([k, n]) => (
                        <li key={k}>
                          {k}: <span className="text-[#FCD535]">{n}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
              {'fases' in c && c.fases && typeof c.fases === 'object' ? (
                <div>
                  <span className="font-semibold text-[#848E9C]">Fases</span>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {Object.entries(/** @type {Record<string, number>} */ (c.fases)).map(([k, n]) => (
                      <li
                        key={k}
                        className="rounded border border-emerald-500/20 bg-emerald-500/5 px-1.5 py-0.5 font-mono text-[10px] text-emerald-100/90"
                      >
                        {k} <span className="text-[#848E9C]">{n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {'vigilancia' in c && c.vigilancia && typeof c.vigilancia === 'object' ? (
                <div>
                  <span className="font-semibold text-[#848E9C]">Vigilancia</span>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {Object.entries(/** @type {Record<string, number>} */ (c.vigilancia)).map(([k, n]) => (
                      <li
                        key={k}
                        className="rounded border border-violet-500/20 bg-violet-500/5 px-1.5 py-0.5 font-mono text-[10px] text-violet-100/90"
                      >
                        {k} <span className="text-[#848E9C]">{n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-[#2B3139] px-4 py-3" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#5E6673]">Línea de tiempo · últimos {timeline.length} frames</p>
        {timeline.length === 0 ? (
          <p className="mt-2 text-[11px] text-[#5E6673]">
            Sin actividad interpretada. Comprueba socket a <span className="font-mono text-[#848E9C]">/admin-signals</span> y
            tráfico del proveedor; en core-api solo se cortan frames con{' '}
            <span className="font-mono text-[#848E9C]">ADMIN_SIGNALS_STREAM_FRAMES_OFF=1</span>.
          </p>
        ) : (
          <div className="custom-scrollbar mt-2 max-h-52 overflow-auto rounded-lg border border-[#2B3139]">
            <table className="w-full border-collapse text-left text-[10px]">
              <thead>
                <tr className="border-b border-[#2B3139] bg-black/30 text-[#5E6673]">
                  <th className="px-2 py-1.5 font-semibold">Hora</th>
                  <th className="px-2 py-1.5 font-semibold">Evento</th>
                  <th className="px-2 py-1.5 font-semibold">Origen</th>
                  <th className="px-2 py-1.5 font-semibold">Fase</th>
                  <th className="px-2 py-1.5 font-semibold">Vig.</th>
                  <th className="px-2 py-1.5 font-semibold">Mesa</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((row) => (
                  <tr key={row.key} className="border-b border-[#2B3139]/80 hover:bg-white/[0.03]">
                    <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[#848E9C]">
                      {row.t ? new Date(row.t).toLocaleTimeString() : '—'}
                    </td>
                    <td className="px-2 py-1.5 font-mono font-semibold text-[#FCD535]">{row.eventName}</td>
                    <td className="px-2 py-1.5 font-mono text-[#C8CDD4]">{row.origin}</td>
                    <td className="px-2 py-1.5 font-mono text-emerald-200/90">{row.fase}</td>
                    <td className="px-2 py-1.5 font-mono text-violet-200/90">{row.vig}</td>
                    <td className="max-w-[120px] truncate px-2 py-1.5 font-mono text-[#B7BDC6]" title={row.mesa}>
                      {row.mesa}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * @param {{ socketConnected: boolean }} props
 */
function VistaLabLiveActionPanelInner({ socketConnected }) {
  const [uiPaused, setUiPaused] = useState(readUiPaused);
  const snap = useSyncExternalStore(
    subscribeSignalStreamDebug,
    getSignalStreamDebugSnapshot,
    getSignalStreamDebugServerSnapshot,
  );

  if (uiPaused) {
    return (
      <VistaLabPipelinePausedBar
        socketConnected={socketConnected}
        bufferedFrames={snap.frames.length}
        onResume={() => {
          persistUiPaused(false);
          setUiPaused(false);
        }}
      />
    );
  }

  return (
    <VistaLabLiveActionContent
      socketConnected={socketConnected}
      snap={snap}
      onPause={() => {
        persistUiPaused(true);
        setUiPaused(true);
      }}
    />
  );
}

export const VistaLabLiveActionPanel = memo(VistaLabLiveActionPanelInner);
VistaLabLiveActionPanel.displayName = 'VistaLabLiveActionPanel';
