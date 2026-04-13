import { PHASES } from '../domain/engine/index.js';
import {
  extractMesaInfoFromResultRaw,
  extractVectorForecastFromActiveRow,
  forecastStepIndexFromProviderRow,
} from './iaRealEngineUi.js';

const FASES = PHASES;

/**
 * Canonical idle snapshot for IA Real provider shell (`App.jsx` + tests).
 */
export function createIdleIaRealVisualState() {
  return {
    status: 'IDLE',
    activeRow: null,
    outcomeRow: null,
    visualStepIndex: 0,
    visualProgress: 0,
    startedAt: null,
    phaseVisual: null,
  };
}

/**
 * Maps engine `.status` to legacy `FASES` for sync HUD / audio / portal only.
 * @param {string} status
 */
export function iaRealStatusToPresentationFase(status) {
  switch (status) {
    case 'WAITING_RESULT':
    case 'SYNC':
      return FASES.SEÑAL;
    case 'RESULT_ANIMATION':
    case 'RESULT':
    case 'RESULT_SEQUENCE':
    case 'SUCCESS':
    case 'FAILED':
      return FASES.RESULTADO;
    case 'IDLE':
    default:
      return FASES.STANDBY;
  }
}

/**
 * Pure mirror of NEW_SIGNAL handler: immediate WAITING_RESULT (or SYNC when blocked).
 * @param {{ rawSignal?: object, recommendation?: string, mesa?: string, round?: string, martingale?: number }} row
 * @param {{ isSyncBlocked?: boolean, startedAt?: number }} [opts]
 */
export function iaRealStateAfterNewSignal(row, opts = {}) {
  const vf0 = extractVectorForecastFromActiveRow(row);
  const vIdx = forecastStepIndexFromProviderRow(row, vf0.length);
  const t0 = opts.startedAt ?? 0;
  const base = {
    activeRow: row,
    outcomeRow: null,
    visualStepIndex: vIdx,
    visualProgress: 0,
    startedAt: t0,
  };
  if (opts.isSyncBlocked) {
    return { ...base, status: 'SYNC' };
  }
  return { ...base, status: 'WAITING_RESULT' };
}

/**
 * Pure mirror of NEW_RESULT handler (outcome classification).
 * `done.winStatus` comes from `normalizeNewResultPayload` (`vector_win[last]` when present, else relay).
 * @param {object} prev
 * @param {{ recommendation?: string, rawResult?: object, winStatus?: boolean | null }} done
 */
export function iaRealStateAfterSettledResult(prev, done) {
  return {
    ...prev,
    status: 'RESULT',
    outcomeRow: done,
    phaseVisual: 'RESULT',
  };
}

/**
 * Simulador (replay): construye estado de motor solo desde una fila de `extHistory` (sin tocar el store).
 * @param {object | null | undefined} row
 */
export function replayHistoryRowToEngineState(row) {
  if (!row) return createIdleIaRealVisualState();
  if (String(row.status) === 'pending') {
    return iaRealStateAfterNewSignal(row, { isSyncBlocked: false });
  }
  const base = iaRealStateAfterNewSignal(row, { isSyncBlocked: false });
  return iaRealStateAfterSettledResult(base, row);
}

/**
 * Provider-only martingale / contador update on the same pending row (no local T-loop).
 * @param {object} prev
 * @param {object} row
 */
export function iaRealStateAfterProviderRowRefresh(prev, row) {
  const vf = extractVectorForecastFromActiveRow(row);
  const vIdx = forecastStepIndexFromProviderRow(row, vf.length);
  return {
    ...prev,
    activeRow: row,
    visualStepIndex: vIdx,
  };
}

/** @returns {boolean} */
export function idleHasNoMesaVisible(state) {
  return state.status === 'IDLE' && state.activeRow == null;
}
