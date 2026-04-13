/**
 * Single source of truth for NEW_SIGNAL → dashboard strip (mesa, ronda, T1–T6, active step).
 * Used by IA Real (provider), Visor (relay watch), and simulation (TRIGGER_SEQUENCE → simulated row).
 */

import {
  extractVectorForecastFromActiveRow,
  forecastStepIndexFromProviderRow,
  normalizeForecastCellLetter,
  recommendationSide,
  resolveContadorMartingalaForUi,
} from './iaRealEngineUi.js';

/** @typedef {'IA' | 'VISOR' | 'SIM'} UnifiedSignalSource */

export const UNIFIED_SOURCE = {
  IA: 'IA',
  VISOR: 'VISOR',
  SIM: 'SIM',
};

const PRIORITY_RANK = { IA: 3, VISOR: 2, SIM: 1 };
/** Timestamps within this window compete by {@link PRIORITY_RANK} (IA > VISOR > SIM). */
export const UNIFIED_SIGNAL_NEAR_MS = 50;

function normalizeMesa(mesa, mesaFallback) {
  const s = String(mesa ?? '').trim();
  if (s) return s;
  return String(mesaFallback ?? '—');
}

function normalizeRonda(r) {
  if (r == null || r === '') return 1;
  const n = Number(r);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** @param {unknown} s */
function normalizeUnifiedSource(s) {
  if (s === UNIFIED_SOURCE.IA || s === UNIFIED_SOURCE.VISOR || s === UNIFIED_SOURCE.SIM) return s;
  return UNIFIED_SOURCE.IA;
}

/**
 * Ordering: strict ts first; same/near ts → priority IA > VISOR > SIM.
 * @param {{ source: UnifiedSignalSource, ts: number }} candidate
 * @param {React.MutableRefObject<{ source: UnifiedSignalSource, ts: number } | null> | { current: { source: UnifiedSignalSource, ts: number } | null }} lastAppliedSignalRef
 * @returns {{ ok: boolean, reason?: string }}
 */
export function admitUnifiedSignal(candidate, lastAppliedSignalRef) {
  if (!lastAppliedSignalRef) return { ok: true };
  const incoming = {
    source: normalizeUnifiedSource(candidate.source),
    ts: Number(candidate.ts),
  };
  if (!Number.isFinite(incoming.ts)) {
    console.warn('[unified-signal] discarded: invalid ts', { candidate: incoming });
    return { ok: false, reason: 'invalid_ts' };
  }
  const last = lastAppliedSignalRef.current;
  if (last == null) {
    lastAppliedSignalRef.current = incoming;
    return { ok: true };
  }
  if (incoming.ts < last.ts) {
    console.warn('[unified-signal] discarded: stale ts', { incoming, lastApplied: last });
    return { ok: false, reason: 'stale_ts' };
  }
  const dt = incoming.ts - last.ts;
  const ri = PRIORITY_RANK[incoming.source] ?? 0;
  const rl = PRIORITY_RANK[last.source] ?? 0;

  if (dt > UNIFIED_SIGNAL_NEAR_MS) {
    lastAppliedSignalRef.current = incoming;
    return { ok: true };
  }
  if (dt > 0 && dt <= UNIFIED_SIGNAL_NEAR_MS) {
    if (ri > rl) {
      lastAppliedSignalRef.current = incoming;
      return { ok: true };
    }
    if (ri < rl) {
      console.warn('[unified-signal] discarded: lower priority (near ts)', { incoming, lastApplied: last });
      return { ok: false, reason: 'priority' };
    }
    lastAppliedSignalRef.current = incoming;
    return { ok: true };
  }
  if (dt === 0) {
    if (ri > rl) {
      lastAppliedSignalRef.current = incoming;
      return { ok: true };
    }
    console.warn('[unified-signal] discarded: same ts, loses or ties priority', { incoming, lastApplied: last });
    return { ok: false, reason: 'same_ts' };
  }
  return { ok: false, reason: 'unknown' };
}

export function buildSimulatedSignalRowFromEnginePattern(pattern, mesa, ronda) {
  const ts = Date.now();
  const vf = Array.isArray(pattern)
    ? pattern.map((p) => {
        const s = String(p).toLowerCase();
        if (s === 'player' || s === 'p') return 'P';
        if (s === 'tie' || s === 't') return 'T';
        return 'B';
      })
    : [];
  return {
    id: `sim-${ts}`,
    mesa: mesa != null ? String(mesa) : '',
    round: ronda,
    martingale: 1,
    recommendation: 'UNKNOWN',
    status: 'pending',
    source: UNIFIED_SOURCE.SIM,
    ts,
    rawSignal: {
      vector_forecast: vf,
      contador_martingala: 1,
    },
  };
}

export function computeUnifiedSignalUiPatch(row, opts = {}) {
  const mesaFallback = opts.mesaFallback ?? '—';
  const mesa = normalizeMesa(row?.mesa, mesaFallback);
  const ronda = normalizeRonda(row?.round);

  const vf = extractVectorForecastFromActiveRow(row);
  const len = vf.length;
  const stepIdx0 = len ? forecastStepIndexFromProviderRow(row, len) : 0;
  const contador = resolveContadorMartingalaForUi(row);
  const activeShot = Math.max(1, Math.min(6, Math.floor(Number(contador)) || 1));

  let pattern = len
    ? vf.map((tok) => {
        const L = normalizeForecastCellLetter(tok);
        if (L === 'P') return 'player';
        if (L === 'T') return 'tie';
        return 'banker';
      })
    : [];

  if (pattern.length === 0) {
    const side = recommendationSide(row?.recommendation);
    if (side === 'PLAYER') pattern = ['player'];
    else if (side === 'BANKER') pattern = ['banker'];
    else if (side === 'TIE') pattern = ['tie'];
  }

  const source = normalizeUnifiedSource(opts.unifiedSource ?? row?.source);
  const tsRaw = opts.unifiedTs ?? row?.ts;
  const ts = Number.isFinite(Number(tsRaw)) ? Number(tsRaw) : Date.now();

  return {
    mesa,
    ronda,
    pattern,
    activeShot,
    visualStepIndex: stepIdx0,
    vectorForecast: vf,
    contador,
    source,
    ts,
  };
}

export function applySignalToUnifiedUI(row, actions) {
  const patch = computeUnifiedSignalUiPatch(row, {
    mesaFallback: actions.mesaFallback,
    unifiedSource: actions.unifiedSource,
    unifiedTs: actions.unifiedTs,
  });

  if (actions.lastAppliedSignalRef) {
    const admission = admitUnifiedSignal(
      { source: patch.source, ts: patch.ts },
      actions.lastAppliedSignalRef,
    );
    if (!admission.ok) {
      return { ...patch, discarded: true };
    }
  }

  if (actions.setCurrentMesa) actions.setCurrentMesa(patch.mesa);
  if (actions.setCurrentRonda) actions.setCurrentRonda(patch.ronda);
  if (actions.setPattern) actions.setPattern(patch.pattern);
  if (actions.setActiveShot) actions.setActiveShot(patch.activeShot);
  if (actions.setWinnerSide) actions.setWinnerSide(null);
  if (actions.setScores) {
    actions.setScores({ player: 0, banker: 0, rolling: false });
  }

  return patch;
}
