import { create } from 'zustand';
import { isGpulseLabWarmup } from '../utils/gpulseLabWarmup.js';
import { ensureUserGestureTrackingInstalled, hasUserInteracted } from '../utils/gpulseLabUserGesture.js';
import { useMetricsStore } from './useMetricsStore.js';

export const ALERT_TYPES = {
  RESULTADO_SIN_SEÑAL: 'RESULTADO SIN SEÑAL',
  SEÑAL_BLOQUEADA: 'SEÑAL BLOQUEADA',
  ROUND_CORREGIDO: 'ROUND CORREGIDO',
  DELAY_FUERA_DE_RANGO: 'DELAY FUERA DE RANGO',
  CICLO_INCOMPLETO: 'CICLO INCOMPLETO',
  /** Ciclo reconstruido por auto-resync (middleware). */
  CICLO_RECUPERADO: 'CICLO_RECUPERADO',
  STREAM_MISSING_RESULT: 'STREAM_MISSING_RESULT',
  DATA_INCONSISTENCY: 'DATA_INCONSISTENCY',
  /** Stream: sin NEW_RESULT dentro del plazo. */
  STREAM_TIMEOUT: 'STREAM_TIMEOUT',
  /** Misma condición técnica que timeout stream; UX resiliente (no “error”). */
  STREAM_INTERRUPTED: 'STREAM_INTERRUPTED',
  STREAM_DELAY_EXPECTED: 'STREAM_DELAY_EXPECTED',
  /** Legado; retardo real se usa con DELAY_FUERA_DE_RANGO. */
  LAB_TIMEOUT: 'LAB_TIMEOUT',
  UI_UX_INCONSISTENCY: 'UI_UX_INCONSISTENCY',
  UI_REALITY_MISMATCH: 'UI_REALITY_MISMATCH',
  UI_FLOW_BREAK: 'UI_FLOW_BREAK / VISUAL_DESYNC',
  UI_FAKE_RENDER: 'UI_FAKE_RENDER',
  UI_STATE_STUCK: 'UI_STATE_STUCK',
  UI_PHASE_SKIP: 'UI_PHASE_SKIP',
  PROVIDER_DATA_NOT_RENDERED: 'PROVIDER_DATA_NOT_RENDERED',
  HEARING_DESYNC: 'HEARING_DESYNC',
  PROVIDER_FLOW_DROPPED_IN_CYCLE: 'PROVIDER_FLOW_DROPPED_IN_CYCLE',
  TRACE_BREAKPOINT: 'TRACE_BREAKPOINT',
  PRE_FAILURE_DETECTED: 'PRE_FAILURE_DETECTED',
};

const MAX_ALERTS = 50;
/** Dedup window for same type + mesa + round (ms). */
const DEDUP_MS = 2800;

/** Burst guard: avoid UI freeze if many alerts arrive in a short window. */
const THROTTLE_WINDOW_MS = 8000;
const THROTTLE_MAX_IN_WINDOW = 20;
let throttleWindowStart = 0;
let throttleCountInWindow = 0;

function throttleAllowsBurst(now) {
  if (now - throttleWindowStart > THROTTLE_WINDOW_MS) {
    throttleWindowStart = now;
    throttleCountInWindow = 0;
  }
  throttleCountInWindow += 1;
  return throttleCountInWindow <= THROTTLE_MAX_IN_WINDOW;
}

/** @type {Map<string, number>} */
let dedupRecent = new Map();

function pruneDedup(now) {
  if (dedupRecent.size < 400) return;
  dedupRecent = new Map([...dedupRecent.entries()].filter(([, t]) => now - t < 60000));
}

/**
 * Duplicate guard: same type + mesa + round within DEDUP_MS.
 * @param {{ type?: unknown, mesa?: unknown, round?: unknown }} payload
 */
function dedupKey(payload) {
  return `${String(payload.type ?? '')}|${String(payload.mesa ?? '')}|${String(payload.round ?? '')}`;
}

function playErrorBeep() {
  if (typeof window === 'undefined') return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 660;
    g.gain.value = 0.07;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    window.setTimeout(() => {
      try {
        o.stop();
        ctx.close();
      } catch {
        /* ignore */
      }
    }, 140);
  } catch {
    /* ignore */
  }
}

function cloneJsonSafe(v) {
  if (v == null) return null;
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return v;
  }
}

/**
 * @param {{
 *   type: string,
 *   mesa?: unknown,
 *   round?: unknown,
 *   message: string,
 *   severity: 'info' | 'warning' | 'error',
 *   rawPayload?: unknown,
 *   context?: {
 *     signalExists?: boolean | null,
 *     resultExists?: boolean | null,
 *     correlationKey?: string | null,
 *     middlewareState?: unknown,
 *     validationState?: Record<string, unknown>,
 *   },
 * }} alert
 */
export function pushAlert(alert) {
  if (alert == null || typeof alert !== 'object') return;
  if (isGpulseLabWarmup()) return;
  const now = Date.now();
  if (!throttleAllowsBurst(now)) return;
  const key = dedupKey(alert);
  const prev = dedupRecent.get(key);
  if (prev != null && now - prev < DEDUP_MS) return;
  dedupRecent.set(key, now);
  pruneDedup(now);

  const id = `${now}-${Math.random().toString(36).slice(2, 9)}`;
  const ctxIn = alert.context && typeof alert.context === 'object' ? alert.context : {};
  const entry = {
    id,
    type: String(alert.type ?? ''),
    mesa: alert.mesa,
    round: alert.round,
    message: String(alert.message ?? ''),
    severity:
      alert.severity === 'error' || alert.severity === 'warning' || alert.severity === 'info'
        ? alert.severity
        : 'info',
    timestamp: now,
    rawPayload: cloneJsonSafe(alert.rawPayload),
    context: {
      ...ctxIn,
      signalExists: ctxIn.signalExists ?? null,
      resultExists: ctxIn.resultExists ?? null,
      correlationKey: ctxIn.correlationKey != null ? String(ctxIn.correlationKey) : null,
      middlewareState: ctxIn.middlewareState ?? null,
      validationState:
        ctxIn.validationState != null && typeof ctxIn.validationState === 'object' ? { ...ctxIn.validationState } : {},
    },
  };

  useAlertStore.getState()._append(entry);

  if (entry.severity === 'error') {
    useMetricsStore.getState().bumpError();
    try {
      ensureUserGestureTrackingInstalled();
      if (typeof document !== 'undefined' && document.hasFocus?.() && hasUserInteracted()) {
        playErrorBeep();
      }
    } catch {
      /* ignore */
    }
  }
}

export function clearAlerts() {
  dedupRecent.clear();
  useAlertStore.getState()._clear();
}

export const useAlertStore = create((set) => ({
  alerts: [],

  _append(entry) {
    set((s) => ({
      alerts: [entry, ...s.alerts].slice(0, MAX_ALERTS),
    }));
  },

  _clear() {
    set({ alerts: [] });
  },

  dismissAlert(id) {
    set((s) => ({
      alerts: s.alerts.filter((a) => a.id !== id),
    }));
  },
}));
