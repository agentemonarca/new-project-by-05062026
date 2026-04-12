import React, { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  extractMesaInfoFromResultRaw,
  extractScoreLabelsFromResultRaw,
  extractVectorForecastFromActiveRow,
  iaRealPredictionToneClasses,
  iaRealVectorCellToneClasses,
  iaRealVectorMaturityDimClass,
  iaRealVectorResultDimClass,
  normalizeGanadorSide,
  recommendationSide,
  winnerVectorIndexFromGanador,
} from '../../utils/iaRealEngineUi.js';
import { formatPredictionSideLabel, predictionSideFromRawSignal } from '../../utils/providerMartingaleRead.js';
import { IaRealMartingaleGrid } from './IaRealMartingaleGrid.jsx';

/**
 * Visual-only execution layer for IA Real (provider shell). No timers affecting engine state.
 */
export function IaRealExecutionLayer({ engine, isLightMode, onOutcomePresented }) {
  const { status, activeRow, outcomeRow, visualStepIndex } = engine;
  const lastOutcomeFxRef = useRef('');

  useEffect(() => {
    if (status !== 'SUCCESS' && status !== 'FAILED') return;
    const id = outcomeRow?.id != null ? String(outcomeRow.id) : '';
    if (!id || lastOutcomeFxRef.current === id) return;
    lastOutcomeFxRef.current = id;
    onOutcomePresented?.(status === 'SUCCESS');
  }, [status, outcomeRow?.id, onOutcomePresented]);

  const vfLen = activeRow ? extractVectorForecastFromActiveRow(activeRow).length : 0;
  const stepProgressRatio =
    vfLen > 0 ? Math.min(1, Math.max(0, (Number(visualStepIndex) + 1) / vfLen)) : 0;

  const predictionSide = useMemo(
    () => predictionSideFromRawSignal(activeRow?.rawSignal ?? null),
    [activeRow?.rawSignal],
  );
  const predictionLabel = formatPredictionSideLabel(predictionSide);

  return (
    <>
      {status === 'IDLE' ? (
        <div
          className="absolute bottom-10 z-30 w-full max-w-lg px-4 pointer-events-none"
          data-layer="ia-real-signal"
          data-z="30"
        >
          <p
            className={`text-center text-sm font-black uppercase tracking-[0.35em] ${isLightMode ? 'text-slate-600' : 'text-white/70'}`}
          >
            Esperando señal…
          </p>
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        {activeRow && (status === 'WAITING_RESULT' || status === 'SYNC') ? (
          <motion.div
            key={`wait-${activeRow.id}`}
            role="region"
            aria-label="Señal activa"
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-12 z-30 w-full space-y-5 pointer-events-auto px-2"
            data-layer="ia-real-signal-data"
            data-z="30"
          >
            {status === 'SYNC' ? (
              <p
                className={`text-center text-[11px] font-black uppercase tracking-[0.2em] ${isLightMode ? 'text-amber-800' : 'text-amber-200/90'}`}
              >
                Sincronizando…
              </p>
            ) : null}
            <div className="flex justify-center gap-4 flex-wrap">
              <div
                className={`${isLightMode ? 'bg-white shadow-md' : 'bg-black/60'} px-6 py-4 rounded-3xl border border-white/5 min-w-[200px] backdrop-blur-md transition-shadow duration-300`}
              >
                <p className="armani-label-dynamic mb-1 opacity-60">Mesa</p>
                <p
                  className={`text-3xl font-black font-mono tracking-tighter ${isLightMode ? 'text-slate-800' : 'text-white'}`}
                >
                  {String(activeRow.mesa ?? '—')}
                </p>
              </div>
              <div
                className={`${isLightMode ? 'bg-white shadow-md' : 'bg-black/60'} px-6 py-4 rounded-3xl border border-white/5 min-w-[120px] backdrop-blur-md`}
              >
                <p className="armani-label-dynamic mb-1 opacity-60">Ronda</p>
                <p className={`text-4xl font-black font-mono ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                  {String(activeRow.round ?? '—')}
                </p>
              </div>
              <div
                className={`${isLightMode ? 'bg-white shadow-md' : 'bg-black/60'} px-6 py-4 rounded-3xl border border-white/5 min-w-[180px] backdrop-blur-md relative overflow-hidden`}
              >
                <p className="armani-label-dynamic mb-1 opacity-60">Apuesta (vector)</p>
                <motion.p
                  className={`text-2xl font-black font-mono ${iaRealPredictionToneClasses(predictionLabel, isLightMode)}`}
                  animate={
                    recommendationSide(predictionLabel) === 'PLAYER'
                      ? {
                          textShadow: isLightMode
                            ? [
                                '0 0 10px rgba(8,145,178,0.35)',
                                '0 0 28px rgba(8,145,178,0.75)',
                                '0 0 10px rgba(8,145,178,0.35)',
                              ]
                            : [
                                '0 0 14px rgba(34,211,238,0.45)',
                                '0 0 36px rgba(34,211,238,0.95)',
                                '0 0 14px rgba(34,211,238,0.45)',
                              ],
                        }
                      : recommendationSide(predictionLabel) === 'BANKER'
                        ? {
                            textShadow: isLightMode
                              ? [
                                  '0 0 10px rgba(190,18,60,0.25)',
                                  '0 0 26px rgba(225,29,72,0.55)',
                                  '0 0 10px rgba(190,18,60,0.25)',
                                ]
                              : [
                                  '0 0 14px rgba(251,113,133,0.45)',
                                  '0 0 34px rgba(251,113,133,0.9)',
                                  '0 0 14px rgba(251,113,133,0.45)',
                                ],
                          }
                        : { textShadow: ['0 0 0px transparent', '0 0 12px rgba(255,255,255,0.15)', '0 0 0px transparent'] }
                  }
                  transition={{ duration: 2.3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {predictionLabel}
                </motion.p>
              </div>
            </div>

            {activeRow ? (
              <IaRealMartingaleGrid
                rawSignal={activeRow.rawSignal}
                rawResult={null}
                visualStepIndex={visualStepIndex}
                isLightMode={isLightMode}
              />
            ) : null}

            {vfLen > 0 ? (
              <div className="max-w-md mx-auto px-1">
                <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden ring-1 ring-white/5">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400/90 via-violet-400/85 to-fuchsia-400/80"
                    initial={false}
                    animate={{ width: `${stepProgressRatio * 100}%` }}
                    transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                  />
                </div>
                <p className={`text-[10px] font-mono text-center mt-1.5 ${isLightMode ? 'text-slate-500' : 'text-white/40'}`}>
                  Paso {Math.min(vfLen, Number(visualStepIndex) + 1)} / {vfLen} · datos proveedor
                </p>
              </div>
            ) : null}

            <div className="flex justify-center flex-wrap gap-2.5">
              {extractVectorForecastFromActiveRow(activeRow).map((t, idx) => {
                const activeIdx = Number(visualStepIndex) || 0;
                const dim = iaRealVectorMaturityDimClass(idx, activeIdx);
                return (
                  <motion.div
                    key={`vf-${idx}`}
                    className={`will-change-transform ${dim}`}
                    animate={{ y: [0, -3, 0] }}
                    transition={{
                      duration: 3.2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: idx * 0.14,
                    }}
                  >
                    <div
                      className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center text-sm font-black transition-[transform,box-shadow] duration-200 ${iaRealVectorCellToneClasses(t, isLightMode, idx === activeIdx)}`}
                    >
                      {t}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <p
              className={`text-center text-xs font-black uppercase tracking-[0.28em] ${isLightMode ? 'text-slate-500' : 'text-white/55'}`}
            >
              Esperando resultado…
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {outcomeRow && (status === 'RESULT_ANIMATION' || status === 'SUCCESS' || status === 'FAILED') ? (
          <motion.div
            key={`res-${outcomeRow.id}`}
            role="region"
            aria-live="polite"
            aria-label="Resultado de mesa"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-12 z-30 w-full max-w-xl mx-auto pointer-events-auto px-3"
            data-layer="ia-real-result"
            data-z="30"
          >
            {(() => {
              const meta = extractMesaInfoFromResultRaw(outcomeRow.rawResult);
              const scoresLbl = extractScoreLabelsFromResultRaw(outcomeRow.rawResult);
              const gan = meta.ganador ? String(meta.ganador) : '—';
              const gSide = normalizeGanadorSide(meta.ganador);
              const cardsP = Array.isArray(meta.cartas_player) ? meta.cartas_player : [];
              const cardsB = Array.isArray(meta.cartas_banker) ? meta.cartas_banker : [];
              const vf = extractVectorForecastFromActiveRow(activeRow ?? outcomeRow);
              const winIdx = winnerVectorIndexFromGanador(vf, meta.ganador);
              const activeIdx = Number(visualStepIndex) || 0;
              const winFlash =
                gSide === 'PLAYER'
                  ? 'shadow-[0_0_28px_rgba(34,211,238,0.55)] border-cyan-400/50'
                  : gSide === 'BANKER'
                    ? 'shadow-[0_0_28px_rgba(251,113,133,0.5)] border-rose-400/45'
                    : '';

              return (
                <div className="space-y-4">
                  <IaRealMartingaleGrid
                    rawSignal={(activeRow ?? outcomeRow)?.rawSignal}
                    rawResult={outcomeRow.rawResult}
                    visualStepIndex={activeIdx}
                    isLightMode={isLightMode}
                  />
                  <div
                    className={`rounded-2xl border px-4 py-3 text-left ${isLightMode ? 'bg-white border-slate-200' : `bg-black/55 border-white/10 ${winFlash}`}`}
                  >
                    <p className="armani-label-dynamic mb-1 opacity-60">Ganador</p>
                    <motion.p
                      className={`text-2xl font-black font-mono ${
                        gSide === 'PLAYER'
                          ? isLightMode
                            ? 'text-cyan-700'
                            : 'text-cyan-200'
                          : gSide === 'BANKER'
                            ? isLightMode
                              ? 'text-rose-800'
                              : 'text-rose-200'
                            : isLightMode
                              ? 'text-slate-900'
                              : 'text-white'
                      }`}
                      initial={{ scale: 1.08, filter: 'brightness(1.35)' }}
                      animate={{ scale: 1, filter: 'brightness(1)' }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    >
                      {gan}
                    </motion.p>

                    <div className="mt-3 space-y-2">
                      {(cardsP.length > 0 || cardsB.length > 0) && (
                        <div className="flex flex-col gap-2 text-[11px] font-mono">
                          <div className="flex flex-wrap gap-1.5 items-center">
                            <span className={`opacity-60 w-12 ${gSide === 'PLAYER' ? 'text-cyan-400' : ''}`}>Player</span>
                            {cardsP.map((c, i) => (
                              <motion.span
                                key={`cp-${i}`}
                                initial={{ opacity: 0, rotateY: -40 }}
                                animate={{ opacity: 1, rotateY: 0 }}
                                transition={{ delay: 0.12 + i * 0.06, duration: 0.35 }}
                                className={`rounded-md px-2 py-0.5 border ${
                                  gSide === 'PLAYER'
                                    ? isLightMode
                                      ? 'border-cyan-400 bg-cyan-500/10 text-cyan-900'
                                      : 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100'
                                    : 'border-white/10'
                                }`}
                              >
                                {String(c)}
                              </motion.span>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-1.5 items-center">
                            <span className={`opacity-60 w-12 ${gSide === 'BANKER' ? 'text-rose-400' : ''}`}>Banker</span>
                            {cardsB.map((c, i) => (
                              <motion.span
                                key={`cb-${i}`}
                                initial={{ opacity: 0, rotateY: 40 }}
                                animate={{ opacity: 1, rotateY: 0 }}
                                transition={{ delay: 0.22 + (cardsP.length + i) * 0.06, duration: 0.35 }}
                                className={`rounded-md px-2 py-0.5 border ${
                                  gSide === 'BANKER'
                                    ? isLightMode
                                      ? 'border-rose-400 bg-rose-500/10 text-rose-900'
                                      : 'border-rose-400/50 bg-rose-500/15 text-rose-100'
                                    : 'border-white/10'
                                }`}
                              >
                                {String(c)}
                              </motion.span>
                            ))}
                          </div>
                        </div>
                      )}
                      {(scoresLbl.puntajePlayer || scoresLbl.puntajeBanker) && (
                        <motion.p
                          className="mt-1 text-sm font-mono opacity-90"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.55 }}
                        >
                          {scoresLbl.puntajePlayer != null ? `Player ${scoresLbl.puntajePlayer}` : ''}
                          {scoresLbl.puntajePlayer != null && scoresLbl.puntajeBanker != null ? ' · ' : ''}
                          {scoresLbl.puntajeBanker != null ? `Banker ${scoresLbl.puntajeBanker}` : ''}
                        </motion.p>
                      )}
                    </div>
                  </div>

                  {vf.length > 0 ? (
                    <div className="flex justify-center flex-wrap gap-2 pointer-events-none">
                      {vf.map((t, idx) => {
                        const dim = iaRealVectorResultDimClass(idx, activeIdx, winIdx);
                        const pulseWin = winIdx >= 0 && idx === winIdx;
                        return (
                          <motion.div
                            key={`vfr-${idx}`}
                            initial={{ scale: 0.85, opacity: 0 }}
                            animate={{
                              scale: pulseWin ? [1, 1.12, 1.05] : 1,
                              opacity: 1,
                            }}
                            transition={{
                              delay: 0.35 + idx * 0.05,
                              duration: pulseWin ? 0.55 : 0.3,
                            }}
                            className={`${dim}`}
                          >
                            <div
                              className={`w-11 h-11 rounded-2xl border-2 flex items-center justify-center text-xs font-black transition-[transform,box-shadow] duration-300 ${iaRealVectorCellToneClasses(
                                t,
                                isLightMode,
                                idx === activeIdx,
                                winIdx >= 0 && idx === winIdx,
                              )}`}
                            >
                              {t}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : null}

                  <AnimatePresence>
                    {status === 'SUCCESS' ? (
                      <motion.p
                        key="ok"
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: 0.45, duration: 0.35 }}
                        className="text-center text-lg font-black text-emerald-400 tracking-wide drop-shadow-[0_0_14px_rgba(52,211,153,0.55)]"
                      >
                        SEÑAL ACERTADA
                      </motion.p>
                    ) : null}
                    {status === 'FAILED' ? (
                      <motion.p
                        key="fail"
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: 0.45, duration: 0.35 }}
                        className="text-center text-lg font-black text-rose-400 tracking-wide drop-shadow-[0_0_14px_rgba(251,113,133,0.45)]"
                      >
                        SEÑAL FALLIDA
                      </motion.p>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })()}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
