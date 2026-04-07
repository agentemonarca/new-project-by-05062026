import { memo, useMemo } from 'react';
import { FileJson2, Layers } from 'lucide-react';
import { SIGNAL_STREAM_DEBUG_MAX_FRAMES } from '../../realtime/signalStreamDebugStore.js';

/** @param {unknown} v @param {number} max */
function previewJson(v, max = 320) {
  if (v == null) return '—';
  try {
    const s = JSON.stringify(v);
    return s.length > max ? `${s.slice(0, max)}…` : s;
  } catch {
    return String(v).slice(0, max);
  }
}

/**
 * Capas alineadas con buildFullSignalState (core-api).
 * @param {{ layers: Record<string, unknown> }}
 */
function LayerBlocks({ layers }) {
  const ctx = layers.contexto && typeof layers.contexto === 'object' ? layers.contexto : null;
  const señal = layers.señal && typeof layers.señal === 'object' ? layers.señal : null;
  const evento = layers.evento && typeof layers.evento === 'object' ? layers.evento : null;
  const vigilancia = layers.vigilancia && typeof layers.vigilancia === 'object' ? layers.vigilancia : null;
  const fase = layers.fase && typeof layers.fase === 'object' ? layers.fase : null;
  const expl = layers.explicacion && typeof layers.explicacion === 'object' ? layers.explicacion : null;

  return (
    <div className="grid gap-2 border-t border-white/5 pt-3 sm:grid-cols-2">
      <div className="rounded-lg border border-white/[0.07] bg-slate-900/45 p-2.5">
        <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">Contexto</div>
        {ctx ? (
          <ul className="space-y-0.5 text-[10px] text-slate-400">
            <li>
              <span className="text-slate-600">mesa:</span> {String(ctx.mesa ?? '—')}
            </li>
            <li>
              <span className="text-slate-600">round:</span> {String(ctx.round ?? '—')}
            </li>
            <li className="truncate" title={previewJson(ctx.history, 800)}>
              <span className="text-slate-600">history:</span> {ctx.history != null ? previewJson(ctx.history, 120) : '—'}
            </li>
          </ul>
        ) : (
          <span className="text-[10px] text-slate-600">—</span>
        )}
      </div>
      <div className="rounded-lg border border-violet-500/15 bg-violet-950/20 p-2.5">
        <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-violet-400/80">Señal</div>
        {señal ? (
          <ul className="space-y-0.5 text-[10px] text-slate-300">
            <li>
              <span className="text-violet-500/60">tipo:</span> {String(señal.tipo ?? '—')}
            </li>
            <li>
              <span className="text-violet-500/60">dirección:</span> {String(señal.direccion ?? '—')}
            </li>
            <li>
              <span className="text-violet-500/60">martingale:</span> {String(señal.martingale ?? '—')}
            </li>
          </ul>
        ) : (
          <span className="text-[10px] text-slate-600">—</span>
        )}
      </div>
      <div className="rounded-lg border border-cyan-500/15 bg-cyan-950/15 p-2.5">
        <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-cyan-400/80">Evento (juego)</div>
        {evento ? (
          <p className="text-[10px] text-slate-300">
            <span className="text-cyan-500/60">resultado:</span> {String(evento.resultado ?? '—')}
          </p>
        ) : (
          <span className="text-[10px] text-slate-600">—</span>
        )}
      </div>
      <div className="rounded-lg border border-amber-500/15 bg-amber-950/15 p-2.5">
        <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-amber-400/80">Vigilancia</div>
        {vigilancia ? (
          <p className="text-[10px] text-amber-100/90">
            <span className="text-amber-500/60">estado:</span> {String(vigilancia.estado ?? '—')}
          </p>
        ) : (
          <span className="text-[10px] text-slate-600">—</span>
        )}
      </div>
      <div className="rounded-lg border border-emerald-500/15 bg-emerald-950/15 p-2.5 sm:col-span-2">
        <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-emerald-400/80">Fase</div>
        {fase ? (
          <p className="text-[11px] font-semibold text-emerald-100/90">{String(fase.nombre ?? '—')}</p>
        ) : (
          <span className="text-[10px] text-slate-600">—</span>
        )}
      </div>
      <div className="sm:col-span-2 rounded-lg border border-white/[0.08] bg-slate-950/50 p-3">
        <div className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">
          <FileJson2 className="h-3.5 w-3.5" aria-hidden />
          Explicación
        </div>
        {expl?.resumen ? (
          <p className="text-[11px] leading-relaxed text-slate-200">{String(expl.resumen)}</p>
        ) : null}
        {expl?.detalle ? (
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{String(expl.detalle)}</p>
        ) : null}
        {!expl?.resumen && !expl?.detalle ? <span className="text-[10px] text-slate-600">—</span> : null}
      </div>
    </div>
  );
}

/**
 * @param {{ frames: unknown[] }}
 */
function SignalDetailListInner({ frames }) {
  const rows = useMemo(() => frames.slice(0, SIGNAL_STREAM_DEBUG_MAX_FRAMES), [frames]);

  return (
    <section className="rounded-2xl border border-slate-600/25 bg-gradient-to-b from-slate-950/95 to-slate-950/50 p-4 shadow-[0_0_28px_rgba(148,163,184,0.05)]">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-500/30 bg-slate-800/60">
            <Layers className="h-5 w-5 text-slate-300" aria-hidden />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold tracking-tight text-white">DETALLE</h3>
            <p className="mt-0.5 max-w-xl text-[11px] text-slate-500">
              Últimos {SIGNAL_STREAM_DEBUG_MAX_FRAMES} marcos · estructura{' '}
            <code className="text-slate-400">buildFullSignalState</code> (contexto,
              señal, evento, vigilancia, fase, explicación + raw).
            </p>
          </div>
        </div>
        <span className="rounded-full border border-white/10 bg-slate-900/80 px-2.5 py-1 text-[10px] font-medium text-slate-400">
          {rows.length} / {SIGNAL_STREAM_DEBUG_MAX_FRAMES}
        </span>
      </div>

      <div className="max-h-[min(70vh,36rem)] space-y-3 overflow-y-auto overscroll-contain scroll-smooth pr-1 [scrollbar-gutter:stable]">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-600">Sin registros. Conecta el socket o activa el test emit.</p>
        ) : (
          rows.map((fr, i) => {
            const f = fr && typeof fr === 'object' ? fr : {};
            const layers = f.layers && typeof f.layers === 'object' ? f.layers : {};
            return (
              <article
                key={`${f.ts ?? i}-${String(f.eventName ?? 'ev')}-${i}`}
                className="rounded-xl border border-white/[0.08] bg-slate-900/35 p-3 shadow-inner"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-white/5 pb-2">
                  <span className="font-mono text-[11px] font-semibold text-cyan-200/95">{String(f.eventName ?? '—')}</span>
                  <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{String(f.origin ?? '')}</span>
                  {f.source ? (
                    <span className="rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-200/90">
                      {String(f.source)}
                    </span>
                  ) : null}
                  <span className="ml-auto text-[10px] tabular-nums text-slate-600">{f.ts ? new Date(f.ts).toISOString() : ''}</span>
                </div>
                <div className="mb-2 rounded-lg border border-cyan-500/10 bg-black/20 p-2">
                  <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-cyan-500/70">RAW</div>
                  <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-words text-[9px] leading-relaxed text-slate-500 scroll-smooth">
                    {previewJson(layers.raw, 1200)}
                  </pre>
                </div>
                <LayerBlocks layers={layers} />
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

export const SignalDetailList = memo(SignalDetailListInner);
SignalDetailList.displayName = 'SignalDetailList';
