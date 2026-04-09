import React, { memo, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createEmptyMesaState, getEffectiveMesaId, LAB_LIFECYCLE_LABELS, useLabStore } from '../../store/useLabStore.js';
import {
  extractNestedSignal,
  formatForecastCell,
  getPatternString,
  getVectorForecast6,
} from '../../utils/supplierIntelExtract.js';

const sectionClass =
  'rounded-lg border border-white/[0.08] bg-gradient-to-br from-zinc-950/90 via-black/70 to-zinc-900/50 p-3 shadow-inner shadow-black/40';

function ForecastChip({ letter }) {
  const L = String(letter).toUpperCase();
  const cls =
    L === 'B'
      ? 'bg-red-600/85 text-white border-red-400/50'
      : L === 'P'
        ? 'bg-blue-600/85 text-white border-blue-400/50'
        : L === 'T' || L === 'E'
          ? 'bg-emerald-600/85 text-white border-emerald-400/50'
          : 'bg-slate-700 text-slate-200 border-white/10';
  return (
    <span className={`inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded border font-mono text-xs font-bold ${cls}`}>
      [{L}]
    </span>
  );
}

const IntelHeader = memo(function IntelHeader({ mesaId, estado, sig, roundStore, jugadaId, algoritmo, lifecycleState }) {
  const nombre = sig?.nombre_mesa != null ? String(sig.nombre_mesa) : mesaId ? `Mesa ${mesaId}` : '—';
  const ra = sig?.ronda_actual ?? sig?.ronda ?? roundStore;
  const ro = sig?.ronda_objetivo ?? sig?.objetivo_ronda;
  const rondaStr =
    ra != null && ro != null ? `${ra} → ${ro}` : ra != null ? String(ra) : ro != null ? String(ro) : '—';
  const ciclo = LAB_LIFECYCLE_LABELS[lifecycleState] ?? (estado === 'SIGNAL' ? 'SIGNAL DETECTED' : estado === 'RESULT' ? 'RESULT' : 'WAITING');

  return (
    <div className={`${sectionClass} border-cyan-500/20`}>
      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-400/90">Live context</p>
      <div className="mt-2 grid gap-2 font-mono text-[11px] text-slate-200 sm:grid-cols-2">
        <div>
          <span className="text-slate-500">Mesa</span>
          <p className="font-semibold text-cyan-200/95">{nombre}</p>
        </div>
        <div>
          <span className="text-slate-500">Ronda</span>
          <p className="text-slate-200">{rondaStr}</p>
        </div>
        <div>
          <span className="text-slate-500">Jugada ID</span>
          <p className="break-all text-violet-300/90">{jugadaId ?? '—'}</p>
        </div>
        <div>
          <span className="text-slate-500">Algoritmo</span>
          <p className="text-amber-200/90">{algoritmo ?? '—'}</p>
        </div>
        <div className="sm:col-span-2">
          <span className="text-slate-500">Estado ciclo</span>
          <p
            className={`mt-0.5 inline-flex rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
              ciclo === 'BETTING OPEN' || ciclo === 'SIGNAL DETECTED'
                ? 'border-amber-400/50 bg-amber-950/50 text-amber-200 animate-pulse'
                : ciclo === 'CYCLE COMPLETE' || ciclo === 'RESULT RECEIVED'
                  ? 'border-emerald-400/45 bg-emerald-950/40 text-emerald-200'
                  : 'border-slate-600/50 bg-slate-900/60 text-slate-400'
            }`}
          >
            {ciclo}
          </p>
        </div>
      </div>
    </div>
  );
});

const ForecastEngine = memo(function ForecastEngine({ sig }) {
  const vf = useMemo(() => getVectorForecast6(sig ?? {}), [sig]);
  const pattern = useMemo(() => getPatternString(sig ?? {}), [sig]);
  if (!sig && vf.length === 0) {
    return (
      <div className={sectionClass}>
        <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Forecast engine</p>
        <p className="mt-2 font-mono text-[10px] text-slate-600">Sin vector_forecast en el payload.</p>
      </div>
    );
  }
  return (
    <div className={`${sectionClass} border-violet-500/15`}>
      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-violet-300/90">Forecast engine</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(vf.length > 0 ? vf : ['?', '?', '?', '?', '?', '?']).map((c, i) => (
          <ForecastChip key={`${i}-${c}`} letter={c} />
        ))}
      </div>
      {pattern ? (
        <p className="mt-2 font-mono text-[9px] text-slate-600">
          pattern <span className="text-slate-500">{pattern}</span>
        </p>
      ) : null}
    </div>
  );
});

function cardsLine(label, cards, score) {
  const c = Array.isArray(cards) ? cards.join(' ') : cards != null ? String(cards) : '—';
  const s = score != null ? String(score) : '—';
  return (
    <p className="font-mono text-[10px] text-slate-300">
      <span className="text-slate-500">{label}:</span> <span className="text-slate-200">{c}</span> →{' '}
      <span className="tabular-nums text-cyan-300/90">{s}</span>
    </p>
  );
}

const LiveTimeline = memo(function LiveTimeline({ history, mesaInfo, intelSignalTs, intelResultTs }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history?.length, mesaInfo]);

  const pp = mesaInfo?.puntaje_player ?? mesaInfo?.puntaje_Player;
  const pb = mesaInfo?.puntaje_banker ?? mesaInfo?.puntaje_Banker;
  const cp = mesaInfo?.cartas_player;
  const cb = mesaInfo?.cartas_banker;

  return (
    <div className={`${sectionClass} border-amber-500/15`}>
      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-200/85">Live timeline</p>
      <div ref={scrollRef} className="mt-2 max-h-64 space-y-3 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {(history ?? []).map((e, idx) => {
            const t0 = e.timestamp;
            const rel =
              intelSignalTs != null && t0 != null
                ? Math.max(0, Math.round((t0 - intelSignalTs) / 1000))
                : idx === 0
                  ? 0
                  : null;
            return (
              <motion.div
                key={`${e.timestamp}-${idx}-${e.type}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="border-b border-white/[0.06] pb-2 last:border-b-0"
              >
                {e.type === 'SIGNAL' ? (
                  <div className="text-slate-300">
                    <span className="text-emerald-400/90">●</span> SIGNAL →{' '}
                    <span className="font-semibold text-slate-100">{formatForecastCell(e.value)}</span>
                    <div className="mt-0.5 font-mono text-[9px] text-slate-600">
                      ⏱️ t={rel != null ? `${rel}s` : '0'}
                    </div>
                  </div>
                ) : null}
                {e.type === 'MARTINGALE' ? (
                  <div className="text-amber-200/90">
                    <span className="text-amber-400">●</span> MARTINGALE <span className="font-mono">{e.step}</span>
                  </div>
                ) : null}
                {e.type === 'BETTING' ? (
                  <div className="text-cyan-200/90">
                    <span className="text-cyan-400">●</span> BETTING OPEN{' '}
                    {e.until != null ? (
                      <span className="font-mono text-[9px] text-slate-600">
                        (cierra en ~{Math.max(0, Math.round((e.until - (e.timestamp ?? Date.now())) / 1000))}s)
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {e.type === 'RESULT' ? (
                  <div
                    className={
                      e.win === true ? 'text-emerald-300' : e.win === false ? 'text-red-300' : 'text-slate-300'
                    }
                  >
                    <span className={e.win === true ? 'text-emerald-400' : e.win === false ? 'text-red-400' : 'text-slate-400'}>
                      ●
                    </span>{' '}
                    RESULT → <span className="font-semibold">{e.value != null ? String(e.value) : '—'}</span>{' '}
                    {e.win === true ? '✅' : e.win === false ? '❌' : ''}
                    <div className="mt-0.5 font-mono text-[9px] text-slate-600">
                      ⏱️ t=
                      {intelSignalTs != null && t0 != null
                        ? `${Math.max(0, Math.round((t0 - intelSignalTs) / 1000))}s`
                        : '—'}
                    </div>
                  </div>
                ) : null}
              </motion.div>
            );
          })}
        </AnimatePresence>
        {mesaInfo && (cp != null || cb != null || pp != null || pb != null) ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 rounded border border-white/[0.06] bg-black/30 p-2"
          >
            {cardsLine('PLAYER', cp, pp)}
            {cardsLine('BANKER', cb, pb)}
          </motion.div>
        ) : null}
      </div>
    </div>
  );
});

const MartingaleEngine = memo(function MartingaleEngine({ mesaInfo, sig }) {
  const mg = mesaInfo?.martingala ?? mesaInfo?.martingale;
  const obj = mg != null && typeof mg === 'object' && !Array.isArray(mg) ? mg : null;
  if (!obj && !sig?.martingale) {
    return (
      <div className={sectionClass}>
        <p className="font-mono text-[9px] uppercase text-slate-500">Martingale engine</p>
        <p className="mt-1 font-mono text-[10px] text-slate-600">Sin martingala activa.</p>
      </div>
    );
  }
  const vf = obj?.vector_forecast ?? obj?.vector_resultado;
  const vr = obj?.vector_resultado;
  const vw = obj?.vector_win;
  const step = obj?.contador_martingala ?? obj?.paso ?? obj?.step;
  const forecastStr = Array.isArray(vf) ? vf.map(formatForecastCell).join(' ') : '—';
  const resultadoStr = Array.isArray(vr) && vr.length > 0 ? String(vr[vr.length - 1]) : '—';
  const lastWin = Array.isArray(vw) && vw.length > 0 ? vw[vw.length - 1] : null;
  const win = lastWin === true || lastWin === 1 || lastWin === '1';

  return (
    <div className={`${sectionClass} border-yellow-500/20`}>
      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-yellow-200/85">Martingale engine</p>
      {step != null ? (
        <p className="mt-2 font-mono text-[11px] text-yellow-100">
          Martingala step: <span className="font-bold">{String(step)}</span>
        </p>
      ) : null}
      <p className="mt-1 font-mono text-[10px] text-slate-400">
        Forecast: <span className="text-slate-200">{forecastStr}</span>
      </p>
      <p className="mt-0.5 font-mono text-[10px] text-slate-400">
        Resultado: <span className="text-slate-100">{resultadoStr}</span>
      </p>
      <p className="mt-1 font-mono text-[10px]">
        Estado:{' '}
        <span className={win ? 'text-emerald-400' : 'text-red-400'}>{win ? 'WIN ✅' : 'LOSS ❌'}</span>
      </p>
    </div>
  );
});

const GameAnalytics = memo(function GameAnalytics({ mesaInfo }) {
  const de = mesaInfo?.data_evento ?? mesaInfo?.data_event;
  const ev = de != null && typeof de === 'object' && !Array.isArray(de) ? de : null;
  const cartas = ev?.Cartas ?? ev?.cartas ?? ev?.distribucion;
  const vp = ev?.victorias_player ?? ev?.VictoriasPlayer ?? ev?.player_wins;
  const vb = ev?.victorias_banker ?? ev?.VictoriasBanker ?? ev?.banker_wins;
  const vt = ev?.victorias_tie ?? ev?.VictoriasTie ?? ev?.tie_wins ?? ev?.empates;
  const restantes = ev?.cartas_restantes ?? ev?.CartasRestantes ?? ev?.mazo_restante;

  return (
    <div className={`${sectionClass} border-sky-500/15`}>
      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-sky-300/85">Game analytics</p>
      <div className="mt-2 grid gap-1 font-mono text-[10px] text-slate-300 sm:grid-cols-3">
        <div>
          <span className="text-slate-500">Victorias Player</span>
          <p className="text-sky-200">{vp != null ? String(vp) : '—'}</p>
        </div>
        <div>
          <span className="text-slate-500">Victorias Banker</span>
          <p className="text-sky-200">{vb != null ? String(vb) : '—'}</p>
        </div>
        <div>
          <span className="text-slate-500">Tie</span>
          <p className="text-sky-200">{vt != null ? String(vt) : '—'}</p>
        </div>
      </div>
      <div className="mt-2">
        <span className="font-mono text-[9px] text-slate-500">Cartas restantes</span>
        <p className="font-mono text-[10px] text-slate-300">{restantes != null ? String(restantes) : '—'}</p>
      </div>
      {cartas != null ? (
        <pre className="mt-2 max-h-24 overflow-auto rounded border border-white/[0.06] bg-black/40 p-2 font-mono text-[9px] text-slate-500">
          {typeof cartas === 'object' ? JSON.stringify(cartas, null, 0) : String(cartas)}
        </pre>
      ) : (
        <p className="mt-2 font-mono text-[9px] text-slate-600">Sin data_evento.Cartas</p>
      )}
    </div>
  );
});

const TableroGrid = memo(function TableroGrid({ tablero }) {
  const cells = Array.isArray(tablero) ? tablero.slice(-30) : [];
  return (
    <div className={`${sectionClass} border-rose-500/15`}>
      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-rose-200/85">Tablero (últimos 30)</p>
      {cells.length === 0 ? (
        <p className="mt-2 font-mono text-[10px] text-slate-600">Sin tablero en mesa_info.</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {cells.map((cell, i) => {
            const s = String(cell).trim().toUpperCase();
            const dot =
              s === 'B' || s.startsWith('BANK')
                ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.55)]'
                : s === 'P' || s.startsWith('PLAY')
                  ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.55)]'
                  : s === 'E' || s === 'T'
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                    : 'bg-slate-600';
            return <span key={`${i}-${cell}`} className={`h-3 w-3 rounded-full ${dot}`} title={String(cell)} />;
          })}
        </div>
      )}
    </div>
  );
});

const BetEngine = memo(function BetEngine({ mesaInfo }) {
  const de = mesaInfo?.data_evento ?? mesaInfo?.data_event;
  const ev = de != null && typeof de === 'object' && !Array.isArray(de) ? de : null;
  const monto = ev?.monto ?? ev?.Monto ?? ev?.apuesta ?? ev?.stake;
  const lado = ev?.lado ?? ev?.lado_beneficio ?? ev?.bet_side ?? ev?.prediction;
  const tiempo = ev?.tiempo ?? ev?.timestamp_apuesta ?? ev?.hora;

  return (
    <div className={`${sectionClass} border-fuchsia-500/15`}>
      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-fuchsia-200/85">Bet engine</p>
      <div className="mt-2 space-y-1 font-mono text-[10px] text-slate-300">
        <p>
          <span className="text-slate-500">Monto</span> — {monto != null ? String(monto) : '—'}
        </p>
        <p>
          <span className="text-slate-500">Lado</span> — {lado != null ? String(lado) : '—'}
        </p>
        <p>
          <span className="text-slate-500">Tiempo</span> — {tiempo != null ? String(tiempo) : '—'}
        </p>
      </div>
    </div>
  );
});

const TimeEngine = memo(function TimeEngine({ intelSignalTs, intelResultTs, steps }) {
  const dur =
    intelSignalTs != null && intelResultTs != null ? Math.max(0, intelResultTs - intelSignalTs) : null;
  return (
    <div className={`${sectionClass} border-slate-500/20`}>
      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">Time engine</p>
      <p className="mt-2 font-mono text-[10px] text-slate-300">
        Ciclo: <span className="text-cyan-300">{dur != null ? `${Math.round(dur)} ms` : '—'}</span>
        {intelSignalTs != null ? <span className="ml-2 text-slate-600">(fin − inicio)</span> : null}
      </p>
      <ul className="mt-2 space-y-1 font-mono text-[9px] text-slate-500">
        {(steps ?? []).map((s, i) => (
          <li key={`${s.at}-${i}`}>
            {s.label}: {s.deltaMs != null ? `${Math.round(s.deltaMs)} ms` : '—'}
          </li>
        ))}
      </ul>
    </div>
  );
});

export default function CycleIntelCommandPanel() {
  const mesas = useLabStore((s) => s.mesas);
  const selectedMesaId = useLabStore((s) => s.selectedMesaId);
  const lifecycleState = useLabStore((s) => s.lifecycleState);
  const effectiveId = useMemo(() => getEffectiveMesaId(mesas, selectedMesaId), [mesas, selectedMesaId]);

  const row = useMemo(
    () => (effectiveId ? mesas[effectiveId] : createEmptyMesaState()),
    [mesas, effectiveId],
  );

  const sigEff = useMemo(() => row.supplierSignalFull ?? extractNestedSignal(row.supplierLastRawSignal), [row]);

  const jugadaId = useMemo(() => {
    const s = sigEff;
    return (s?.id_jugada ?? s?.idJugada ?? s?.jugada_id ?? s?.id ?? row.supplierLastRawSignal?.id) ?? null;
  }, [sigEff, row.supplierLastRawSignal]);

  const algoritmo = sigEff?.nombre_algoritmo ?? sigEff?.algoritmo;

  const tablero = row.supplierMesaInfoFull?.tablero;

  return (
    <div className="flex w-full min-w-0 flex-col gap-3" aria-label="Cycle Intelligence Command Panel">
      <header className="shrink-0 border-b border-white/[0.07] pb-2">
        <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400/95">
          Cycle Intelligence
        </h2>
        <p className="mt-0.5 font-mono text-[9px] text-slate-600">Proveedor en vivo · decisión &amp; monitorización</p>
      </header>

      <div className="flex w-full min-w-0 flex-col space-y-3 pr-0">
        <IntelHeader
          mesaId={effectiveId}
          estado={row.estado}
          sig={sigEff}
          roundStore={row.round}
          jugadaId={jugadaId != null ? String(jugadaId) : null}
          algoritmo={algoritmo != null ? String(algoritmo) : null}
          lifecycleState={lifecycleState}
        />
        <ForecastEngine sig={sigEff} />
        <LiveTimeline
          history={row.currentCycleHistory}
          mesaInfo={row.supplierMesaInfoFull}
          intelSignalTs={row.intelSignalTs}
          intelResultTs={row.intelResultTs}
        />
        <MartingaleEngine mesaInfo={row.supplierMesaInfoFull} sig={sigEff} />
        <GameAnalytics mesaInfo={row.supplierMesaInfoFull} />
        <TableroGrid tablero={tablero} />
        <BetEngine mesaInfo={row.supplierMesaInfoFull} />
        <TimeEngine intelSignalTs={row.intelSignalTs} intelResultTs={row.intelResultTs} steps={row.intelStepDurations} />

        <details className="rounded border border-white/[0.06] bg-black/40 p-2 font-mono text-[9px] text-slate-600">
          <summary className="cursor-pointer text-slate-500">Payload bruto (debug)</summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[8px]">
            {JSON.stringify(
              {
                data_signal: sigEff,
                mesa_info: row.supplierMesaInfoFull,
              },
              null,
              2,
            )}
          </pre>
        </details>
      </div>
    </div>
  );
}
