/**
 * Pure execution state machine: signal → result → martingale (no I/O).
 * Comparación P/B/T unificada (PLAYER/BANKER/TIE o letras).
 */

import {
  forecastStepIndexFromContador,
  winStatusFromVectorWinLastArray,
} from '../../utils/forecastMartingaleStep.js';
import { warnEngineReject } from './engineDeterministicForensic.js';

/**
 * Winx/Vista: índice de celda desde `contador_martingala` o, en señal, `martingale` (0-based) + 1.
 * @param {Record<string, unknown>} p
 */
function effectiveContadorFromSignalPayload(p) {
  if (p.contador_martingala != null && String(p.contador_martingala).trim() !== '') {
    return Number(p.contador_martingala);
  }
  const mg = p.martingale;
  if (mg != null && Number.isFinite(Number(mg))) {
    return Number(mg) + 1;
  }
  return 1;
}

/** @param {unknown} v */
function normalizeOutcome(v) {
  if (v == null) return '';
  const u = String(v).trim().toUpperCase();
  if (u === 'P' || u.startsWith('PLAY')) return 'P';
  if (u === 'B' || u.startsWith('BANK')) return 'B';
  if (u === 'T' || u === 'E' || u.startsWith('TIE') || u.startsWith('EMP')) return 'T';
  return u.length ? u[0] : '';
}

/** @param {unknown} v */
function normalizeForecastCell(v) {
  const o = normalizeOutcome(v);
  if (o === 'P') return 'PLAYER';
  if (o === 'B') return 'BANKER';
  if (o === 'T') return 'TIE';
  return v != null ? String(v) : null;
}

/**
 * @param {unknown} raw
 * @returns {unknown[]}
 */
export function padForecastVector(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }
  const cells = raw.slice(0, 6).map((c) => normalizeForecastCell(c));
  while (cells.length < 6) {
    cells.push(cells[cells.length - 1] ?? null);
  }
  return cells;
}

export function createInitialState() {
  return {
    status: 'IDLE',
    correlationKey: null,
    mesa: null,
    round: null,
    currentStep: 0,
    maxSteps: 6,
    vector: [],
    prediction: null,
    history: [],
    result: null,
    startedAt: null,
  };
}

/**
 * @param {ReturnType<typeof createInitialState>} state
 * @param {{ type: string, payload?: Record<string, unknown> }} event
 */
export function reduce(state, event) {
  switch (event.type) {
    case 'NEW_SIGNAL': {
      const p = event.payload ?? {};
      const ck = p.correlationKey != null && String(p.correlationKey).trim() !== '' ? String(p.correlationKey).trim() : null;
      if (!ck) {
        warnEngineReject('MISSING_CORRELATION', event.payload, state);
        return state;
      }

      const rawVec = p.vector_forecast;
      if (!Array.isArray(rawVec) || rawVec.length < 1) {
        warnEngineReject('INVALID_VECTOR', event.payload, state);
        return state;
      }

      const vector = padForecastVector(rawVec);
      if (!vector || vector.length < 1) {
        warnEngineReject('INVALID_VECTOR', event.payload, state);
        return state;
      }

      const cm = effectiveContadorFromSignalPayload(p);
      const idx = forecastStepIndexFromContador(cm);
      const predCell = vector[idx];
      if (predCell == null || String(predCell).trim() === '') {
        warnEngineReject('INVALID_VECTOR', event.payload, state);
        return state;
      }

      return {
        ...createInitialState(),
        status: 'RUNNING',
        correlationKey: ck,
        mesa: p.mesa != null ? p.mesa : null,
        round: p.round != null ? String(p.round) : null,
        vector,
        currentStep: idx + 1,
        maxSteps: 6,
        prediction: predCell,
        history: [],
        result: null,
        startedAt: Date.now(),
      };
    }

    case 'NEW_RESULT': {
      if (state.status !== 'RUNNING') {
        warnEngineReject('NOT_RUNNING', event.payload, state);
        return state;
      }

      if (state.currentStep > state.maxSteps) {
        warnEngineReject('OUT_OF_RANGE', event.payload, state);
        return state;
      }

      const ganadorRaw = event.payload?.ganador;
      const winFromVw = winStatusFromVectorWinLastArray(event.payload?.vector_win);

      let isWin;
      if (winFromVw !== null) {
        isWin = winFromVw;
      } else {
        const g = normalizeOutcome(ganadorRaw);
        if (g !== 'P' && g !== 'B' && g !== 'T') {
          warnEngineReject('INVALID_OUTCOME', event.payload, state);
          return state;
        }
        const pred = normalizeOutcome(state.prediction);
        isWin = pred !== '' && g !== '' && pred === g;
      }

      const newHistory = [
        ...state.history,
        {
          step: state.currentStep,
          prediction: state.prediction,
          result: ganadorRaw,
          status: isWin ? 'WIN' : 'LOSS',
        },
      ];

      if (isWin) {
        return {
          ...state,
          status: 'SUCCESS',
          history: newHistory,
          result: ganadorRaw,
        };
      }

      if (state.currentStep >= state.maxSteps) {
        return {
          ...state,
          status: 'FAILED',
          history: newHistory,
          result: ganadorRaw,
        };
      }

      const rawCm = event.payload?.contador_martingala;
      const idx =
        rawCm != null && String(rawCm).trim() !== ''
          ? forecastStepIndexFromContador(rawCm)
          : Math.min(state.currentStep, state.maxSteps - 1);
      const nextPrediction = state.vector[idx] ?? null;
      if (nextPrediction == null || String(nextPrediction).trim() === '') {
        warnEngineReject('INVALID_VECTOR', event.payload, state);
        return state;
      }

      return {
        ...state,
        currentStep: idx + 1,
        prediction: nextPrediction,
        history: newHistory,
      };
    }

    default:
      return state;
  }
}
