import { recordLabCycleEnd } from '../store/useValidationStore.js';
import { useLabStore } from '../store/useLabStore.js';
import { recordInsideEvent } from '../utils/forensicObservability.js';
import { buildLabCorrelationKey, normalizeCorrelationKey } from '../utils/labCorrelationKey.js';
import { normalizeVistaLabsPayload } from '../utils/vistaLabsMirror.js';

/** Señal activa por mesa (solo correlación / recordLabCycleEnd). */
const activeSignalsByMesa = new Map();
const lastRoundByMesa = new Map();
const lastResultRoundByMesa = new Map();
const lastLabSignalAcceptedAtByMesa = new Map();
const openSignalsByCorrelationKey = new Set();

/** Si es `false`, los eventos van directo al store sin reglas de cola. */
export let middlewareEnabled = true;

export function setMiddlewareEnabled(value) {
  middlewareEnabled = Boolean(value);
}

function correlationKeyFrom(mesa, round) {
  return normalizeCorrelationKey(null, mesa, round) ?? buildLabCorrelationKey(mesa, round);
}

function mesaKeyFromPayload(payload) {
  if (payload == null || typeof payload !== 'object') return '';
  const m = /** @type {Record<string, unknown>} */ (payload).mesa;
  return m == null || m === '' ? '' : String(m);
}

function removeOpenKeyForMesa(mesaKey) {
  const row = activeSignalsByMesa.get(mesaKey);
  if (row?.correlationKey != null && String(row.correlationKey).trim() !== '') {
    openSignalsByCorrelationKey.delete(String(row.correlationKey).trim());
  }
}

/**
 * @param {string | null | undefined} mesaId — si se omite, limpia todas las mesas
 */
export function resetMiddlewareProcessingState(mesaId) {
  if (mesaId != null && mesaId !== '') {
    const k = String(mesaId);
    removeOpenKeyForMesa(k);
    activeSignalsByMesa.delete(k);
    lastRoundByMesa.delete(k);
    lastResultRoundByMesa.delete(k);
    lastLabSignalAcceptedAtByMesa.delete(k);
    return;
  }
  for (const k of [...activeSignalsByMesa.keys()]) {
    removeOpenKeyForMesa(k);
  }
  activeSignalsByMesa.clear();
  lastRoundByMesa.clear();
  lastResultRoundByMesa.clear();
  lastLabSignalAcceptedAtByMesa.clear();
  openSignalsByCorrelationKey.clear();
}

/** Cancela estado middleware (p. ej. al desmontar el socket). */
export function disposeSignalMiddleware() {
  resetMiddlewareProcessingState();
}

/** Última ronda registrada para la mesa (señal/resultado); para normalizar RESULT incompleto. */
export function getLastLabRoundForMesa(mesaKey) {
  if (mesaKey == null || mesaKey === '') return null;
  const v = lastRoundByMesa.get(String(mesaKey));
  return v != null && String(v).trim() !== '' ? String(v) : null;
}

/** Ciclo abierto en middleware (para alinear RESULT stream si correlationKey no coincide). */
export function getActiveLabSignalPayloadForMesa(mesaKey) {
  if (mesaKey == null || mesaKey === '') return null;
  const a = activeSignalsByMesa.get(String(mesaKey));
  return a != null && typeof a === 'object' ? { ...a } : null;
}

export function getSignalMiddlewareSnapshot() {
  const open = [...activeSignalsByMesa.keys()];
  return {
    activeByMesa: Object.fromEntries(
      [...activeSignalsByMesa.entries()].map(([k, v]) => [k, v ? { ...v } : null]),
    ),
    pendingTimerForMesa: [],
    middlewareEnabled,
    mesaKeysWithOpenCycle: open,
    hasAnyOpenCycle: open.length > 0,
  };
}

/**
 * @param {string | null | undefined} correlationKey
 * @returns {boolean}
 */
export function hasSignal(correlationKey) {
  if (correlationKey == null || String(correlationKey).trim() === '') return false;
  return openSignalsByCorrelationKey.has(String(correlationKey).trim());
}

function extractProviderTimerFromRaw(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return { remainingSeconds: null, closeTs: null };
  const r = /** @type {any} */ (raw);
  const mi = r?.mesa_info ?? r?.data?.data?.results?.mesa_info ?? r?.data?.results?.mesa_info ?? r?.results?.mesa_info ?? null;
  const de = mi?.data_evento ?? mi?.data_event ?? r?.data_evento ?? null;
  const rem =
    de?.tiempo_restante ?? de?.remaining_time ?? de?.time_left ?? mi?.tiempo_restante ?? mi?.remaining_time ?? mi?.time_left ?? null;
  const remainingSeconds = rem != null && String(rem).trim() !== '' ? Number(rem) : null;
  const closeTsRaw = de?.betting_close_ts ?? de?.close_ts ?? de?.closing_ts ?? null;
  const closeTs = closeTsRaw != null && String(closeTsRaw).trim() !== '' ? Number(closeTsRaw) : null;
  return {
    remainingSeconds: Number.isFinite(remainingSeconds) ? remainingSeconds : null,
    closeTs: Number.isFinite(closeTs) ? closeTs : null,
  };
}

/** Aplicación única al lab; solo debe invocarse desde `dispatchToEngine` (motor + lab). */
export function labApplySignal(payload, rawPayload) {
  orchestrateNewSignal(payload, rawPayload);
}

/** Aplicación única al lab para resultado. */
export function labApplyResult(payload) {
  orchestrateNewResult(payload);
}

/**
 * @param {Record<string, unknown>} payload
 * @param {unknown} rawPayload
 */
function orchestrateNewSignal(payload, rawPayload) {
  if (payload == null || typeof payload !== 'object') return;

  const mesaKey = mesaKeyFromPayload(payload);
  if (!mesaKey) {
    console.warn('[GPulse Lab] señal sin mesa, ignorada');
    return;
  }

  const enriched = /** @type {Record<string, unknown>} */ ({
    ...normalizeVistaLabsPayload(payload, 'signal'),
    ...payload,
  });

  try {
    recordInsideEvent({ mesaId: mesaKey, kind: 'NEW_SIGNAL', payload: enriched, round: enriched?.round });
  } catch {
    /* ignore */
  }

  if (rawPayload != null) {
    const t = extractProviderTimerFromRaw(rawPayload);
    if (t.remainingSeconds != null || t.closeTs != null) {
      useLabStore.getState().setProviderTimer(t);
    }
  }

  if (!middlewareEnabled) {
    useLabStore.getState().setSignal(enriched);
    return;
  }

  if (activeSignalsByMesa.has(mesaKey)) {
    removeOpenKeyForMesa(mesaKey);
    activeSignalsByMesa.delete(mesaKey);
  }

  const ck =
    normalizeCorrelationKey(
      enriched.correlationKey != null && String(enriched.correlationKey).trim() !== ''
        ? String(enriched.correlationKey).trim()
        : null,
      enriched.mesa,
      enriched.round,
    ) ?? correlationKeyFrom(enriched.mesa, enriched.round);

  activeSignalsByMesa.set(mesaKey, { ...enriched, correlationKey: ck });
  lastRoundByMesa.set(mesaKey, enriched.round != null ? String(enriched.round) : null);
  lastLabSignalAcceptedAtByMesa.set(mesaKey, Date.now());
  openSignalsByCorrelationKey.add(ck);

  useLabStore.getState().setSignal(enriched);
}

/**
 * @param {Record<string, unknown>} payload
 */
function orchestrateNewResult(payload) {
  if (payload == null || typeof payload !== 'object') return;

  const mesaKey = mesaKeyFromPayload(payload);
  if (!mesaKey) {
    console.warn('[GPulse Lab] resultado sin mesa, ignorado');
    return;
  }

  const roundSeen = payload.round != null && String(payload.round).trim() !== '' ? String(payload.round).trim() : null;
  if (roundSeen != null) {
    const prev = lastResultRoundByMesa.get(mesaKey);
    if (prev != null && String(prev) === String(roundSeen)) {
      console.info('[gpulse-lab] duplicate result ignored', { mesa: mesaKey, round: roundSeen });
      return;
    }
  }

  const enriched = /** @type {Record<string, unknown>} */ ({
    ...normalizeVistaLabsPayload(payload, 'result'),
    ...payload,
  });

  try {
    recordInsideEvent({ mesaId: mesaKey, kind: 'NEW_RESULT', payload: enriched, round: enriched?.round });
  } catch {
    /* ignore */
  }

  if (!middlewareEnabled) {
    useLabStore.getState().setResult(enriched);
    return;
  }

  const activeNow = activeSignalsByMesa.get(mesaKey);

  let eff = enriched;
  const pr = enriched.round;
  if ((pr == null || String(pr).trim() === '') && activeNow?.round != null && String(activeNow.round).trim() !== '') {
    eff = { ...enriched, round: activeNow.round };
    console.warn('[middleware] round recovered from activeSignal');
  }

  let roundLocked =
    activeNow?.round != null && String(activeNow.round).trim() !== ''
      ? String(activeNow.round).trim()
      : eff.round != null && String(eff.round).trim() !== ''
        ? String(eff.round).trim()
        : '';
  if (roundLocked === '') {
    const lr = getLastLabRoundForMesa(mesaKey);
    if (lr) roundLocked = lr;
  }
  if (roundLocked === '') roundLocked = '0';

  const mesaLocked = activeNow?.mesa ?? eff.mesa;
  const recommendation = activeNow?.recommendation;
  const signalAcceptedAt = lastLabSignalAcceptedAtByMesa.get(mesaKey) ?? Date.now();
  const resultReceivedAt = Date.now();
  const streamRoundBeforeCorrection = eff.round != null ? String(eff.round) : null;
  const middlewareCorrectedRound =
    streamRoundBeforeCorrection != null && streamRoundBeforeCorrection !== String(roundLocked);

  const ckFromPayload =
    eff.correlationKey != null && String(eff.correlationKey).trim() !== ''
      ? String(eff.correlationKey).trim()
      : null;
  const correlationKey =
    normalizeCorrelationKey(ckFromPayload, mesaLocked, roundLocked) ??
    correlationKeyFrom(mesaLocked, roundLocked);

  const corrected = {
    ...eff,
    mesa: mesaLocked,
    round: roundLocked,
    correlationKey,
  };

  const labEmittedAt = Date.now();

  console.log('[GPulse Lab] resultado emitido', corrected);
  useLabStore.getState().setResult(corrected);

  recordLabCycleEnd({
    correlationKey: String(corrected.correlationKey),
    mesa: mesaLocked,
    mesaKey,
    round: String(roundLocked),
    recommendation,
    resultadoLab: corrected.ganador ?? null,
    signalAcceptedAt,
    resultReceivedAt,
    labEmittedAt,
    middlewareCorrectedRound,
    streamRoundBeforeCorrection,
    resyncApplied: false,
    resyncDebug: undefined,
    resyncQuality: undefined,
  });

  removeOpenKeyForMesa(mesaKey);
  if (correlationKey != null && String(correlationKey).trim() !== '') {
    openSignalsByCorrelationKey.delete(String(correlationKey).trim());
  }

  activeSignalsByMesa.delete(mesaKey);
  lastLabSignalAcceptedAtByMesa.delete(mesaKey);
  if (corrected.round != null) {
    lastRoundByMesa.set(mesaKey, String(corrected.round));
    lastResultRoundByMesa.set(mesaKey, String(corrected.round));
  }
}

/**
 * Sin timers: estado inicial pasivo (espejo VistaLabs).
 */
export function onLabSocketConnect() {
  useLabStore.getState().enterWaitingSignal();
}

