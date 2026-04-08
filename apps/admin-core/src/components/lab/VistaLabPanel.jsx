import React, { memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pause, Play, FlaskConical } from 'lucide-react';
import { useVistaLabAdmin } from '../../contexts/VistaLabAdminContext.jsx';
import ResultCasinoScoreBlock from '../ResultCasinoScoreBlock.jsx';
import VistaLabCardReveal from './VistaLabCardReveal.jsx';
import { LAB_PHASE, SIGNAL_DETECTED_TO_IN_PROGRESS_MS } from '../../lab/vistaLabSharedConstants.js';

/**
 * Cuando todo el buffer visible es ✗, explica el caso típico “señal de prueba vs resultados reales”.
 * @param {Record<string, unknown> | null} activeSignal
 * @param {unknown[]} results
 */
function vistaLabMesaMismatchHint(activeSignal, results) {
  if (!activeSignal || !Array.isArray(results) || results.length === 0) return null;
  const sigMesa = String(activeSignal.mesa ?? '').trim();
  if (!sigMesa) return null;
  const rows = results.slice(0, 8);
  const mesas = new Set(
    rows.map((r) => (r && typeof r === 'object' ? String(/** @type {Record<string, unknown>} */ (r).mesa ?? '').trim() : '')).filter(
      Boolean,
    ),
  );
  if (mesas.size === 0) return null;
  const anyRowSharesMesa = rows.some((r) => {
    if (!r || typeof r !== 'object') return false;
    return String(/** @type {Record<string, unknown>} */ (r).mesa ?? '').trim() === sigMesa;
  });
  if (anyRowSharesMesa) return null;
  const list = [...mesas].join(', ');
  return `Ningún resultado en esta vista comparte la mesa con la señal activa («${sigMesa}» vs buffer: ${list}). Por eso todos son ✗ no match — hace falta el mismo evento de mesa y criterios alineados (ck / id↔signalId / round).`;
}

function VistaLabPanelInner() {
  const { snap, cycle } = useVistaLabAdmin();
  const {
    phase,
    activeSignal,
    activeResult,
    isRunning,
    labNotice,
    cooldownCount,
    shotIndex,
    bettingRemainingMs,
    start,
    pause,
    phaseStripOrder,
    phaseIndex,
    labMode,
    resultMatchesSignal,
  } = cycle;

  const forecast6 =
    activeSignal && Array.isArray(activeSignal.forecast6) ? activeSignal.forecast6 : ['—', '—', '—', '—', '—', '—'];

  const winnerSide = (() => {
    const sd = activeResult?.scoreDetail && typeof activeResult.scoreDetail === 'object' ? activeResult.scoreDetail : null;
    const raw = (sd && 'ganador' in sd ? /** @type {any} */ (sd).ganador : null) ?? activeResult?.ganador ?? null;
    const s = String(raw ?? '').trim().toUpperCase();
    if (s.startsWith('PLAY') || s === 'P' || s === 'PLAYER') return 'PLAYER';
    if (s.startsWith('BANK') || s === 'B' || s === 'BANKER') return 'BANKER';
    return null;
  })();

  const resultTone = (() => {
    const v = String(activeResult?.verdict ?? '').toUpperCase();
    if (v === 'WIN') return 'win';
    if (v === 'LOSS') return 'loss';
    if (v === 'TIE') return 'tie';
    return 'neutral';
  })();


  return (
    <div className="space-y-6">
      <p className="text-[11px] text-[#848E9C]">
        Socket:{' '}
        <span className={snap.connected ? 'font-semibold text-emerald-400' : 'font-semibold text-rose-400'}>
          {snap.connected ? 'conectado' : 'desconectado'}
        </span>
      </p>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl border"
            style={{ borderColor: '#2B3139', backgroundColor: 'rgba(252,213,53,0.08)' }}
          >
            <FlaskConical className="h-5 w-5 text-[#FCD535]" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#EAECEF]">VistaLab</h2>
            <p className="text-[11px] text-[#848E9C]">
              {labMode === 'phase1'
                ? 'Fase 1 · detección NEW_SIGNAL · una señal activa (la más reciente) · sin resultados'
                : labMode === 'phase2'
                  ? `Fase 2 · detección + IN_PROGRESS automático (${SIGNAL_DETECTED_TO_IN_PROGRESS_MS}ms) · espera NEW_RESULT`
                  : labMode === 'phase3'
                    ? 'Fase 3 · recepción NEW_RESULT en buffer (diagnóstico · sin match · sin tocar fases)'
                    : labMode === 'phase4'
                      ? 'Fase 4 · match estricto señal↔resultado · ✓/✗ en lista · sin animación post-match'
                      : 'Ciclo automático · una señal activa · fases en tiempo real'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={start}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
          >
            <Play className="h-3.5 w-3.5" aria-hidden /> Start
          </button>
          <button
            type="button"
            onClick={pause}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20"
          >
            <Pause className="h-3.5 w-3.5" aria-hidden /> Pause
          </button>
        </div>
      </div>

      {labNotice ? (
        <p className="rounded-lg border border-cyan-500/25 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-100/95">{labNotice}</p>
      ) : null}

      {!isRunning ? (
        <p className="rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-2 text-xs text-amber-200/90">
          {labMode === 'phase3' ? (
            <>
              En <strong>fase 3</strong> los <span className="font-mono">NEW_RESULT</span> entran igual con el socket;{' '}
              <strong>Start</strong> solo sirve para el aviso de arriba. Pulsa Start si quieres confirmar conexión.
            </>
          ) : (
            <>
              Pulsa <strong>Start</strong> para escuchar el buffer y arrancar el ciclo cuando llegue una señal (o si ya hay
              una al frente).
            </>
          )}
        </p>
      ) : null}

      <div
        className="rounded-xl border px-4 py-3 text-[11px] leading-relaxed text-[#B7BDC6]"
        style={{ borderColor: '#2B3139', backgroundColor: 'rgba(11, 14, 17, 0.55)' }}
      >
        {labMode === 'phase1' ? (
          <>
            <p className="font-bold uppercase tracking-wider text-[#848E9C]">Fase 1 — detección de señal</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-[#B7BDC6]">
              <li>
                El store ya formatea cada <span className="font-mono text-[#EAECEF]">NEW_SIGNAL</span> con{' '}
                <span className="font-mono text-[#EAECEF]">formatSignal</span>; VistaLab toma solo la fila{' '}
                <span className="text-[#EAECEF]">más reciente</span> (<span className="font-mono">signals[0]</span>).
              </li>
              <li>
                Sin listas de señales ni varias mesas en pantalla: una tarjeta de señal activa o estado{' '}
                <span className="font-mono text-[#EAECEF]">WAITING</span>.
              </li>
              <li className="text-amber-200/85">
                No se procesan <span className="font-mono">NEW_RESULT</span> ni se avanza a READY / IN_PROGRESS en esta
                fase.
              </li>
            </ul>
          </>
        ) : labMode === 'phase3' ? (
          <>
            <p className="font-bold uppercase tracking-wider text-[#848E9C]">Fase 3 — recepción en buffer</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-[#B7BDC6]">
              <li>
                En <span className="font-mono text-[#EAECEF]">adminSignalsLiveStore</span>, cada{' '}
                <span className="font-mono text-[#EAECEF]">NEW_RESULT</span> hace{' '}
                <span className="font-mono text-[10px] text-[#848E9C]">results = [formatResult(...), ...results]</span>{' '}
                (equivalente a <span className="font-mono text-[10px]">unshift</span> del más reciente).
              </li>
              <li>
                VistaLab <strong>no</strong> empareja con señales, <strong>no</strong> consume filas y <strong>no</strong>{' '}
                cambia <span className="font-mono">phase</span> del ciclo por un resultado.
              </li>
              <li>Lista inferior: hasta 8 entradas; cada una marcada como recibida.</li>
            </ul>
            <p className="mt-2 border-t border-[#2B3139] pt-2 text-xs font-semibold text-[#0ECB81]">
              Buffer total: {snap.results.length} resultado{snap.results.length === 1 ? '' : 's'}
              {snap.results.length === 0 ? (
                <span className="ml-2 text-amber-200/90">· vacío — esperando NEW_RESULT</span>
              ) : null}
            </p>
          </>
        ) : labMode === 'full' ? (
          <>
            <p className="font-bold uppercase tracking-wider text-[#848E9C]">Ciclo completo — VistaLab</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-[#B7BDC6]">
              <li>
                Con <span className="font-mono text-[#EAECEF]">autoStart</span> el motor ya está en marcha si el socket está{' '}
                <strong>conectado</strong> y has pulsado <strong>Start</strong> (o se disparó al cargar /admin).
              </li>
              <li>
                En <span className="font-mono text-[#EAECEF]">WAITING</span> no verás fases hasta que exista al menos una
                señal válida en <span className="font-mono">signals[0]</span> (evento <span className="font-mono">NEW_SIGNAL</span>
                ).
              </li>
              <li>
                <strong>Socket</strong> (esta vista) ≠ badge <strong>Mongo</strong> del encabezado: el socket puede estar
                conectado aunque Mongo figure desconectado (persistencia opcional; revisa <span className="font-mono">MONGO_URI</span>
                ).
              </li>
              <li>
                Si aquí ves <strong>Socket: desconectado</strong>: levanta <span className="font-mono">core-api</span> en{' '}
                <span className="font-mono">5050</span>, entra en admin (sesión o{' '}
                <span className="font-mono">VITE_GENESIS_ADMIN_API_KEY</span> alineada con el backend).
              </li>
            </ul>
            {phase === LAB_PHASE.WAITING && isRunning ? (
              <p className="mt-2 border-t border-[#2B3139] pt-2 text-xs text-[#FCD535]">
                {snap.connected
                  ? 'En espera de la primera señal en buffer — el ciclo avanzará en cuanto llegue NEW_SIGNAL al socket.'
                  : 'Sin conexión al namespace /admin-signals — revisa proxy y API.'}
              </p>
            ) : null}
            {phase === LAB_PHASE.IN_PROGRESS ? (
              <p className="mt-2 border-t border-[#2B3139] pt-2 text-sm font-semibold text-[#FCD535]">
                BETTING · tiro {Number(shotIndex) + 1}/6 ·{' '}
                {bettingRemainingMs != null ? `${Math.ceil(bettingRemainingMs / 1000)}s` : '—'}
              </p>
            ) : null}
            {phase === LAB_PHASE.LOCKED ? (
              <p className="mt-2 border-t border-[#2B3139] pt-2 text-sm font-semibold text-amber-200/95">
                LOCKED · apuestas cerradas · tiro {Number(shotIndex) + 1}/6
              </p>
            ) : null}
            {phase === LAB_PHASE.PAUSE ? (
              <p className="mt-2 border-t border-[#2B3139] pt-2 text-xs text-[#848E9C]">
                Pausa entre tiros… (tiro {Number(shotIndex) + 1}/6)
              </p>
            ) : null}
            {phase === LAB_PHASE.IN_PROGRESS && activeSignal ? (
              <div
                className="mt-3 border-t border-[#2B3139] pt-3 text-[10px] text-[#848E9C]"
                data-testid="vistalab-full-inprogress-diagnostics"
              >
                <p className="font-bold uppercase tracking-wider text-[#5E6673]">IN_PROGRESS · diagnóstico</p>
                <p className="mt-1.5 text-[#B7BDC6]">
                  Señal activa · mesa <span className="font-mono text-[#EAECEF]">{String(activeSignal.mesa ?? '—')}</span>
                  {' · '}
                  <span className="font-mono text-[#EAECEF]">id={String(activeSignal.id ?? '—')}</span>
                  {' · '}
                  <span className="font-mono text-[#EAECEF]">ck={String(activeSignal.correlationKey ?? '—')}</span>
                  {' · '}
                  <span className="font-mono text-[#EAECEF]">round={String(activeSignal.round ?? '—')}</span>
                </p>
                {snap.results.length === 0 ? (
                  <p className="mt-2 text-amber-200/90">
                    Sin resultados en buffer — en modo <span className="font-mono">full</span> hace falta un{' '}
                    <span className="font-mono">NEW_RESULT</span> que empareje para seguir el ciclo (revelado de cartas,
                    etc.).
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1 font-mono text-[9px] leading-snug text-[#B7BDC6]">
                    {snap.results.slice(0, 8).map((r) => {
                      const ok = resultMatchesSignal(activeSignal, r);
                      const rid = r?.recvId != null ? String(r.recvId) : '—';
                      return (
                        <li key={rid} className={ok ? 'text-emerald-300/95' : ''}>
                          {ok ? '✓ match' : '✗ no match'} · {rid.slice(0, 24)}… · mesa {String(r?.mesa ?? '—')} · sid{' '}
                          {String(r?.signalId ?? '—')} · ck {String(r?.correlationKey ?? '—')} · round{' '}
                          {String(r?.round ?? r?.roundId ?? '—')}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null}
          </>
        ) : labMode === 'phase4' ? (
          <>
            <p className="font-bold uppercase tracking-wider text-[#848E9C]">Fase 4 — match señal ↔ resultado</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-[#B7BDC6]">
              <li>
                Orden obligatorio en <span className="font-mono text-[#EAECEF]">resultMatchesSignal</span>:{' '}
                <strong>(1)</strong> <span className="font-mono">correlationKey</span> — si alguno trae CK, solo CK (no mezclar
                con mesa/round); <strong>(2)</strong> <span className="font-mono">id ↔ signalId</span> con misma mesa si ambas
                vienen; <strong>(3)</strong> <span className="font-mono">mesa + round</span> (ambos rounds obligatorios).
              </li>
              <li>
                Primer acierto: <span className="font-mono text-[10px]">findMatchingResultForSignal</span> →{' '}
                <span className="font-mono">setActiveResult</span>. La fase permanece en{' '}
                <span className="font-mono">IN_PROGRESS</span> (no CARD_REVEAL).
              </li>
            </ul>
            {phase === LAB_PHASE.IN_PROGRESS ? (
              <p className="mt-2 border-t border-[#2B3139] pt-2 text-sm font-medium text-[#FCD535]">
                {activeResult ? '✓ Match identificado — revisa panel Resultado' : '⏳ Esperando resultado…'}
              </p>
            ) : null}
            {phase === LAB_PHASE.IN_PROGRESS && activeSignal ? (
              <div
                className="mt-3 border-t border-[#2B3139] pt-3 text-[10px] text-[#848E9C]"
                data-testid="vistalab-phase4-match-diagnostics"
              >
                <p className="font-bold uppercase tracking-wider text-[#5E6673]">Diagnóstico · hasta 8 filas</p>
                <p className="mt-1.5 text-[#B7BDC6]">
                  Señal activa · mesa <span className="font-mono text-[#EAECEF]">{String(activeSignal.mesa ?? '—')}</span>
                  {' · '}
                  <span className="font-mono text-[#EAECEF]">id={String(activeSignal.id ?? '—')}</span>
                  {' · '}
                  <span className="font-mono text-[#EAECEF]">ck={String(activeSignal.correlationKey ?? '—')}</span>
                  {' · '}
                  <span className="font-mono text-[#EAECEF]">round={String(activeSignal.round ?? '—')}</span>
                </p>
                {snap.results.length === 0 ? (
                  <p className="mt-2 text-amber-200/90">
                    Buffer de resultados vacío — esperando <span className="font-mono">NEW_RESULT</span>.
                  </p>
                ) : (
                  <>
                    <ul className="mt-2 space-y-1 font-mono text-[9px] leading-snug text-[#B7BDC6]">
                      {snap.results.slice(0, 8).map((r) => {
                        const ok = resultMatchesSignal(activeSignal, r);
                        const rid = r?.recvId != null ? String(r.recvId) : '—';
                        return (
                          <li key={rid} className={ok ? 'text-emerald-300/95' : ''}>
                            {ok ? '✓ match' : '✗ no match'} · {rid.slice(0, 24)}… · mesa {String(r?.mesa ?? '—')} · sid{' '}
                            {String(r?.signalId ?? '—')} · ck {String(r?.correlationKey ?? '—')} · round{' '}
                            {String(r?.round ?? r?.roundId ?? '—')}
                          </li>
                        );
                      })}
                    </ul>
                    {(() => {
                      const mesaHint = vistaLabMesaMismatchHint(activeSignal, snap.results);
                      return mesaHint ? (
                        <p className="mt-2 rounded-md border border-amber-500/25 bg-amber-950/25 px-2 py-1.5 text-[10px] leading-snug text-amber-100/95">
                          {mesaHint}
                        </p>
                      ) : null;
                    })()}
                  </>
                )}
              </div>
            ) : null}
          </>
        ) : labMode === 'phase2' ? (
          <>
            <p className="font-bold uppercase tracking-wider text-[#848E9C]">Fase 2 — transición a IN_PROGRESS</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-[#B7BDC6]">
              <li>
                Tras <span className="font-mono text-[#EAECEF]">SIGNAL_DETECTED</span>, a los{' '}
                <span className="text-[#FCD535]">{SIGNAL_DETECTED_TO_IN_PROGRESS_MS}ms</span> se pasa a{' '}
                <span className="font-mono text-[#EAECEF]">IN_PROGRESS</span> <strong>sin clic</strong> y{' '}
                <strong>sin usar</strong> aún datos de <span className="font-mono">NEW_RESULT</span>.
              </li>
              <li>
                En <span className="font-mono text-[#EAECEF]">IN_PROGRESS</span> el motor solo escucha el buffer de
                resultados para emparejar (no antes).
              </li>
              <li>Mientras esperas resultado, no se actualiza la señal activa desde una nueva cabeza del buffer.</li>
            </ul>
            {phase === LAB_PHASE.IN_PROGRESS ? (
              <p className="mt-2 border-t border-[#2B3139] pt-2 text-sm font-medium text-[#FCD535]">
                ⏳ Esperando resultado…
              </p>
            ) : null}
            {phase === LAB_PHASE.IN_PROGRESS && activeSignal ? (
              <div
                className="mt-3 border-t border-[#2B3139] pt-3 text-[10px] text-[#848E9C]"
                data-testid="vistalab-inprogress-diagnostics"
              >
                <p className="font-bold uppercase tracking-wider text-[#5E6673]">Diagnóstico en vivo</p>
                <p className="mt-1.5 text-[#B7BDC6]">
                  Señal activa · mesa <span className="font-mono text-[#EAECEF]">{String(activeSignal.mesa ?? '—')}</span>
                  {' · '}
                  <span className="font-mono text-[#EAECEF]">id={String(activeSignal.id ?? '—')}</span>
                  {' · '}
                  <span className="font-mono text-[#EAECEF]">ck={String(activeSignal.correlationKey ?? '—')}</span>
                  {' · '}
                  <span className="font-mono text-[#EAECEF]">round={String(activeSignal.round ?? '—')}</span>
                </p>
                {snap.results.length === 0 ? (
                  <p className="mt-2 text-amber-200/90">
                    No hay filas en el buffer de resultados: hasta que llegue <span className="font-mono">NEW_RESULT</span>, la
                    fase no avanza (no es un fallo del temporizador).
                  </p>
                ) : (
                  <>
                    <ul className="mt-2 space-y-1 font-mono text-[9px] leading-snug text-[#B7BDC6]">
                      {snap.results.slice(0, 8).map((r) => {
                        const ok = resultMatchesSignal(activeSignal, r);
                        const rid = r?.recvId != null ? String(r.recvId) : '—';
                        return (
                          <li key={rid} className={ok ? 'text-emerald-300/95' : ''}>
                            {ok ? '✓ match' : '✗ no match'} · {rid.slice(0, 24)}… · mesa {String(r?.mesa ?? '—')} · sid{' '}
                            {String(r?.signalId ?? '—')} · ck {String(r?.correlationKey ?? '—')} · round{' '}
                            {String(r?.round ?? r?.roundId ?? '—')}
                          </li>
                        );
                      })}
                    </ul>
                    {(() => {
                      const mesaHint = vistaLabMesaMismatchHint(activeSignal, snap.results);
                      return mesaHint ? (
                        <p className="mt-2 rounded-md border border-amber-500/25 bg-amber-950/25 px-2 py-1.5 text-[10px] leading-snug text-amber-100/95">
                          {mesaHint}
                        </p>
                      ) : null;
                    })()}
                  </>
                )}
              </div>
            ) : null}
          </>
        ) : (
          <>
            <p className="font-bold uppercase tracking-wider text-[#848E9C]">Reglas en IN_PROGRESS</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-[#B7BDC6]">
              <li>
                Solo avanza si <span className="font-mono text-[#EAECEF]">isRunning</span> es true (Pause lo congela).
              </li>
              <li>
                Busca en el buffer un <span className="text-[#EAECEF]">NEW_RESULT</span> que empareje con la señal activa:
                <span className="mt-1 block pl-2 font-mono text-[10px] text-[#848E9C]">
                  correlationKey ↔ correlationKey · signalId ↔ id · mesa + round
                </span>
              </li>
              <li>Cada <span className="font-mono text-[#EAECEF]">recvId</span> de resultado solo se consume una vez en el ciclo.</li>
              <li>
                Si no hay match, la fase se queda en IN_PROGRESS hasta que llegue uno válido o pulses Pause.
              </li>
            </ul>
            {phase === LAB_PHASE.IN_PROGRESS ? (
              <p className="mt-2 border-t border-[#2B3139] pt-2 text-[10px] text-[#FCD535]">
                En curso: esperando resultado emparejado… (buffer {snap.results.length} filas)
              </p>
            ) : null}
            {phase === LAB_PHASE.IN_PROGRESS && activeSignal ? (
              <div
                className="mt-3 border-t border-[#2B3139] pt-3 text-[10px] text-[#848E9C]"
                data-testid="vistalab-inprogress-diagnostics"
              >
                <p className="font-bold uppercase tracking-wider text-[#5E6673]">Diagnóstico en vivo</p>
                <p className="mt-1.5 text-[#B7BDC6]">
                  Señal activa · mesa <span className="font-mono text-[#EAECEF]">{String(activeSignal.mesa ?? '—')}</span>
                  {' · '}
                  <span className="font-mono text-[#EAECEF]">id={String(activeSignal.id ?? '—')}</span>
                  {' · '}
                  <span className="font-mono text-[#EAECEF]">ck={String(activeSignal.correlationKey ?? '—')}</span>
                  {' · '}
                  <span className="font-mono text-[#EAECEF]">round={String(activeSignal.round ?? '—')}</span>
                </p>
                {snap.results.length === 0 ? (
                  <p className="mt-2 text-amber-200/90">
                    No hay filas en el buffer de resultados: hasta que llegue <span className="font-mono">NEW_RESULT</span>, la
                    fase no avanza (no es un fallo del temporizador).
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1 font-mono text-[9px] leading-snug text-[#B7BDC6]">
                    {snap.results.slice(0, 8).map((r) => {
                      const ok = resultMatchesSignal(activeSignal, r);
                      const rid = r?.recvId != null ? String(r.recvId) : '—';
                      return (
                        <li key={rid} className={ok ? 'text-emerald-300/95' : ''}>
                          {ok ? '✓ match' : '✗ no match'} · {rid.slice(0, 24)}… · mesa {String(r?.mesa ?? '—')} · sid{' '}
                          {String(r?.signalId ?? '—')} · ck {String(r?.correlationKey ?? '—')} · round{' '}
                          {String(r?.round ?? r?.roundId ?? '—')}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null}
          </>
        )}
      </div>

      <div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        aria-label="Fases del ciclo"
      >
        {phaseStripOrder.length === 0 ? (
          <p className="col-span-full text-center text-[10px] font-semibold uppercase tracking-wider text-[#5E6673]">
            Fase 3 — sin strip de fases (solo buffer de resultados)
          </p>
        ) : null}
        {phaseStripOrder.map((p) => {
          const idx = phaseStripOrder.indexOf(p);
          const active = phase === p;
          const past = phaseIndex > idx;
          const label =
            p === LAB_PHASE.EVALUATION_WIN || p === LAB_PHASE.EVALUATION_LOSS
              ? `EVALUATION · ${p.endsWith('WIN') ? 'WIN' : 'LOSS'}`
              : p;

          return (
            <div
              key={p}
              className="rounded-xl border px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide transition-all duration-200"
              style={{
                borderColor: active ? '#FCD535' : past ? '#474D57' : '#2B3139',
                backgroundColor: active
                  ? 'rgba(252, 213, 53, 0.12)'
                  : past
                    ? 'rgba(14, 203, 129, 0.06)'
                    : 'rgba(11, 14, 17, 0.6)',
                color: active ? '#FCD535' : past ? '#848E9C' : '#5E6673',
              }}
            >
              {label}
            </div>
          );
        })}
      </div>

      {labMode === 'phase3' ? (
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: '#2B3139', backgroundColor: 'rgba(11, 14, 17, 0.65)' }}
          data-testid="vistalab-results-buffer-diagnostic"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#848E9C]">Diagnóstico · buffer NEW_RESULT</p>
          <p className="mt-1 text-[11px] text-[#848E9C]">Hasta 8 elementos más recientes · cada fila = recibido en store</p>
          {snap.results.length === 0 ? (
            <p className="mt-4 text-sm text-amber-200/90">Buffer vacío — aún no ha llegado ningún NEW_RESULT.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {snap.results.slice(0, 8).map((r, i) => {
                const rid = r?.recvId != null ? String(r.recvId) : `row-${i}`;
                return (
                  <li
                    key={rid}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-[11px]"
                    style={{ borderColor: '#2B3139', backgroundColor: 'rgba(14, 203, 129, 0.06)' }}
                  >
                    <span
                      className="shrink-0 rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300"
                      aria-label="Recibido"
                    >
                      Recibido
                    </span>
                    <span className="font-mono text-[#EAECEF]">
                      #{i + 1} · mesa {String(r?.mesa ?? '—')} · ronda {String(r?.round ?? r?.roundId ?? '—')} ·{' '}
                      <span
                        className="font-bold"
                        style={{
                          color:
                            r?.verdict === 'WIN' ? '#0ECB81' : r?.verdict === 'LOSS' ? '#F6465D' : '#EAECEF',
                        }}
                      >
                        {String(r?.verdict ?? '—')}
                      </span>
                    </span>
                    <span className="font-mono text-[9px] text-[#848E9C]">{rid}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
      <div className={labMode === 'phase1' ? 'space-y-4' : 'grid gap-4 lg:grid-cols-2'}>
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: '#2B3139', backgroundColor: 'rgba(11, 14, 17, 0.65)' }}
          data-testid="vistalab-active-signal-card"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#848E9C]">Señal activa</p>
          {phase === LAB_PHASE.WAITING && !activeSignal ? (
            <p className="mt-3 text-sm font-medium text-[#848E9C]">WAITING — sin NEW_SIGNAL en buffer (o Pause).</p>
          ) : null}
          {activeSignal ? (
            <div className="mt-3 space-y-4">
              <dl className="space-y-2 font-mono text-xs text-[#EAECEF]">
                <div className="flex justify-between gap-2">
                  <dt className="text-[#848E9C]">Mesa</dt>
                  <dd>{String(activeSignal.mesa ?? '—')}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#848E9C]">Ronda</dt>
                  <dd>{String(activeSignal.round ?? '—')}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#848E9C]">Algoritmo</dt>
                  <dd className="text-right text-[#FCD535]">{String(activeSignal.algorithm ?? '—')}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#848E9C]">Fase</dt>
                  <dd className="text-[#0ECB81]">{phase}</dd>
                </div>
              </dl>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#848E9C]">Forecast (6)</p>
                <div className="mt-2 grid grid-cols-6 gap-2">
                  {forecast6.map((cell, i) => (
                    <div
                      key={i}
                      className="flex aspect-square max-h-14 items-center justify-center rounded-lg border text-sm font-black tabular-nums"
                      style={{
                        borderColor: '#474D57',
                        backgroundColor: 'rgba(252, 213, 53, 0.06)',
                        color: '#FCD535',
                      }}
                      title={`Tiro ${i + 1}`}
                    >
                      {cell}
                    </div>
                  ))}
                </div>
              </div>
              {labMode !== 'phase1' ? (
                <dl className="space-y-1 border-t border-[#2B3139] pt-3 font-mono text-xs text-[#EAECEF]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#848E9C]">Predicción</dt>
                    <dd>{String(activeSignal.predictionLabel ?? activeSignal.recommendation ?? '—')}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#848E9C]">Martingale</dt>
                    <dd className="text-[#FCD535]">{String(activeSignal.martingale ?? '—')}</dd>
                  </div>
                </dl>
              ) : null}
            </div>
          ) : phase !== LAB_PHASE.WAITING ? (
            <p className="mt-3 text-sm text-[#5E6673]">Esperando NEW_SIGNAL…</p>
          ) : null}
        </div>

        {labMode !== 'phase1' ? (
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: '#2B3139', backgroundColor: 'rgba(11, 14, 17, 0.65)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#848E9C]">Resultado</p>
            {(phase === LAB_PHASE.IN_PROGRESS || phase === LAB_PHASE.LOCKED) && !activeResult ? (
              <p className="mt-3 text-sm font-medium text-amber-200/95">
                ⏳ Esperando resultado… {phase === LAB_PHASE.IN_PROGRESS && bettingRemainingMs != null ? `(betting ${Math.ceil(bettingRemainingMs / 1000)}s)` : null}
              </p>
            ) : null}
            {activeResult ? (
              <div className="mt-3 space-y-2">
                {labMode === 'phase4' ? (
                  <p className="text-xs font-semibold text-emerald-400">✓ Match identificado (orden CK → id/signalId → mesa+round)</p>
                ) : null}
                <p className="text-xs text-[#848E9C]">
                  Veredicto{' '}
                  <span
                    className="font-bold"
                    style={{
                      color:
                        activeResult.verdict === 'WIN'
                          ? '#0ECB81'
                          : activeResult.verdict === 'LOSS'
                            ? '#F6465D'
                            : '#EAECEF',
                    }}
                  >
                    {String(activeResult.verdict ?? '—')}
                  </span>
                </p>
                <AnimatePresence mode="wait">
                  {labMode === 'full' && phase === LAB_PHASE.RESULT ? (
                    <motion.div
                      key={`reveal-${String(activeResult.recvId ?? '')}-${phase}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <VistaLabCardReveal activeResult={activeResult} visible />
                    </motion.div>
                  ) : phase === LAB_PHASE.RESULT || phase === LAB_PHASE.EVALUATION_WIN || phase === LAB_PHASE.EVALUATION_LOSS ? (
                    <motion.div
                      key={`result-${String(activeResult.recvId ?? '')}-${phase}`}
                      initial={{ opacity: 0, scale: 0.985 }}
                      animate={{ opacity: 1, scale: [0.985, 1.02, 1] }}
                      exit={{ opacity: 0, scale: 0.99 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="rounded-xl border p-3"
                      style={{
                        borderColor:
                          resultTone === 'win'
                            ? 'rgba(14,203,129,0.55)'
                            : resultTone === 'loss'
                              ? 'rgba(246,70,93,0.6)'
                              : resultTone === 'tie'
                                ? 'rgba(252,213,53,0.5)'
                                : '#2B3139',
                        background:
                          winnerSide === 'PLAYER'
                            ? 'radial-gradient(1200px 240px at 20% 0%, rgba(56,189,248,0.18), rgba(11,14,17,0.72))'
                            : winnerSide === 'BANKER'
                              ? 'radial-gradient(1200px 240px at 20% 0%, rgba(246,70,93,0.18), rgba(11,14,17,0.72))'
                              : 'rgba(11, 14, 17, 0.65)',
                        boxShadow:
                          winnerSide === 'PLAYER'
                            ? '0 0 0 1px rgba(56,189,248,0.08), 0 0 28px rgba(56,189,248,0.12)'
                            : winnerSide === 'BANKER'
                              ? '0 0 0 1px rgba(246,70,93,0.08), 0 0 28px rgba(246,70,93,0.12)'
                              : 'none',
                      }}
                      data-testid="vistalab-result-highlight"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#848E9C]">Resultado</p>
                        <span
                          className="rounded-md border px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            borderColor:
                              winnerSide === 'PLAYER'
                                ? 'rgba(56,189,248,0.35)'
                                : winnerSide === 'BANKER'
                                  ? 'rgba(246,70,93,0.35)'
                                  : 'rgba(71,77,87,0.55)',
                            color:
                              winnerSide === 'PLAYER'
                                ? '#93C5FD'
                                : winnerSide === 'BANKER'
                                  ? '#FDA4AF'
                                  : '#EAECEF',
                            backgroundColor: 'rgba(0,0,0,0.18)',
                          }}
                        >
                          Ganador: {String(activeResult.ganador ?? '—')}
                        </span>
                      </div>

                      <ResultCasinoScoreBlock scoreDetail={activeResult.scoreDetail} ganador={activeResult.ganador} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key={`score-${String(activeResult.recvId ?? '')}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ResultCasinoScoreBlock scoreDetail={activeResult.scoreDetail} ganador={activeResult.ganador} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : phase !== LAB_PHASE.IN_PROGRESS ? (
              <p className="mt-3 text-sm text-[#5E6673]">Sin resultado aún (CARD_REVEAL / RESULT…)</p>
            ) : null}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed px-4 py-3 text-center text-[11px] text-[#5E6673]" style={{ borderColor: '#2B3139' }}>
            Fase 1: panel de resultados desactivado. Usa{' '}
            <span className="font-mono">phase2</span>, <span className="font-mono">phase3</span>,{' '}
            <span className="font-mono">phase4</span> o <span className="font-mono">full</span>.
          </p>
        )}
      </div>
      )}

      {labMode === 'full' && phase === LAB_PHASE.COOLDOWN && cooldownCount != null ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-xl border py-8"
          style={{ borderColor: '#FCD535', backgroundColor: 'rgba(252, 213, 53, 0.06)' }}
        >
          <p className="text-sm font-medium text-[#EAECEF]">⏳ Preparando siguiente señal…</p>
          <p className="text-4xl font-black tabular-nums text-[#FCD535]">{cooldownCount}</p>
          <p className="text-[11px] text-[#848E9C]">Cuenta regresiva · siguiente ciclo</p>
        </div>
      ) : null}
    </div>
  );
}

export const VistaLabPanel = memo(VistaLabPanelInner);
VistaLabPanel.displayName = 'VistaLabPanel';

export { LAB_PHASE } from '../../lab/vistaLabSharedConstants.js';
