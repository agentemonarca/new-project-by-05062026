/**
 * Seguimiento de ciclo señal → resultado con correlación: signalId → round+mesa → FIFO por mesa.
 * Entrada principal: eventos crudos del proveedor (onAny). Relay test_emit para entorno sin upstream.
 */
import { extractMesaFromPayload, normalizeNewResultPayload } from './signalNormalize.js';
import {
  buildCanonicalSignalSessionFromInternalSession,
  forensicPreservePayload,
} from './signalSessionCanonical.js';

const MAX_COMPLETED = 100;

/** @type {import('socket.io').Server | null} */
let ioRef = null;

/** @param {import('socket.io').Server | null} io */
export function setSignalSessionTrackerIo(io) {
  ioRef = io;
}

/** @param {unknown} p */
function coerce(p) {
  return p != null && typeof p === 'object' && !Array.isArray(p)
    ? /** @type {Record<string, unknown>} */ (p)
    : {};
}

/** @param {unknown} payload */
function getEnvelope(payload) {
  const r = coerce(payload);
  const d =
    r.data != null && typeof r.data === 'object' && !Array.isArray(r.data)
      ? /** @type {Record<string, unknown>} */ (r.data)
      : /** @type {Record<string, unknown>} */ ({});
  const payloadType =
    r.type != null
      ? String(r.type)
      : r.eventName != null
        ? String(r.eventName)
        : d.type != null
          ? String(d.type)
          : d.eventName != null
            ? String(d.eventName)
            : null;
  return { r, d, payloadType };
}

/** @param {unknown} payload */
function extractMesaDeep(payload) {
  const m = extractMesaFromPayload(payload);
  if (m && String(m).trim() && m !== '—') return String(m).trim();
  const { r, d } = getEnvelope(payload);
  const x = r.mesa ?? d.mesa ?? r.table ?? d.table ?? r.tableId ?? d.tableId;
  return x != null && String(x).trim() ? String(x).trim() : null;
}

/** @param {unknown} payload */
function extractRoundDeep(payload) {
  const { r, d } = getEnvelope(payload);
  const x = r.round ?? d.round ?? r.gameRound ?? d.gameRound ?? r.gameId ?? d.gameId ?? r.shoe ?? d.shoe ?? r.hand ?? d.hand;
  return x != null && String(x).trim() ? String(x).trim() : null;
}

/** @param {unknown} payload */
function extractProviderSignalId(payload) {
  const { r, d } = getEnvelope(payload);
  const id = r.id ?? d.id ?? r.signalId ?? d.signalId;
  if (id == null) return null;
  const s = String(id).trim();
  return s === '' ? null : s;
}

/**
 * @param {string} eventName
 * @param {unknown} payload
 * @param {string | null} mesa
 * @param {string | null} payloadType
 */
function buildEventEntry(eventName, payload, mesa, payloadType) {
  const round = extractRoundDeep(payload);
  const signalId = extractProviderSignalId(payload);
  let raw;
  try {
    raw = payload != null && typeof payload === 'object' ? JSON.parse(JSON.stringify(payload)) : payload;
  } catch {
    raw = { note: 'unserializable', preview: String(payload).slice(0, 500) };
  }
  return {
    ts: Date.now(),
    eventName: String(eventName),
    payloadType,
    mesa,
    round,
    signalId,
    raw,
  };
}

/**
 * @param {unknown} payload
 * @param {{ r: Record<string, unknown>, d: Record<string, unknown> }} env
 */
function extractResultSnapshot(payload, env) {
  const { r, d } = env;
  const norm = normalizeNewResultPayload(payload);
  const raw = norm.raw && typeof norm.raw === 'object' ? /** @type {Record<string, unknown>} */ (norm.raw) : {};
  return {
    ganador: r.ganador ?? d.ganador ?? r.result ?? d.result ?? raw.result,
    winStatus: d.winStatus ?? r.winStatus ?? norm.winStatus,
    round: norm.round || extractRoundDeep(payload),
    mesa: norm.mesa || extractMesaDeep(payload),
    correlationKey: norm.correlationKey,
    providerSignalId: norm.providerSignalId,
  };
}

function createTracker() {
  /** @type {Map<string, Array<Record<string, unknown>>>} mesa → sesiones abiertas FIFO */
  const openByMesa = new Map();
  /** @type {Array<Record<string, unknown>>} */
  const completed = /** @type {any} */ ([]);
  let seq = 0;

  function mesaKey(m) {
    return m && String(m).trim() ? String(m).trim() : '_sin_mesa';
  }

  function removeSessionFromMesa(mesa, session) {
    const k = mesaKey(mesa);
    const q = openByMesa.get(k);
    if (!q) return;
    const i = q.indexOf(session);
    if (i >= 0) q.splice(i, 1);
    if (q.length === 0) openByMesa.delete(k);
  }

  /**
   * @param {unknown} payload
   * @param {string} mesa
   */
  function findSessionForResult(payload, mesa) {
    const k = mesaKey(mesa);
    const q = openByMesa.get(k);
    if (!q || q.length === 0) return null;

    const { r, d } = getEnvelope(payload);
    const rid = r.signalId ?? d.signalId ?? r.id ?? d.id;
    if (rid != null && String(rid).trim() !== '') {
      const want = String(rid).trim();
      const idx = q.findIndex(
        (s) => s.id != null && String(s.id).trim() === want,
      );
      if (idx >= 0) return { session: q[idx], idx };
    }

    const rr = extractRoundDeep(payload);
    if (rr != null && String(rr).trim() !== '') {
      const idx = q.findIndex((s) => s.round != null && String(s.round).trim() === String(rr).trim());
      if (idx >= 0) return { session: q[idx], idx };
    }

    return { session: q[0], idx: 0 };
  }

  function pushCompleted(session) {
    const publicSession = toSignalSession(session);
    completed.unshift(publicSession);
    if (completed.length > MAX_COMPLETED) completed.length = MAX_COMPLETED;
    try {
      ioRef?.of('/admin-signals')?.emit('signal_session_closed', publicSession);
    } catch {
      /* ignore */
    }
  }

  function appendToOpenMesa(mesa, entry) {
    const k = mesaKey(mesa);
    const q = openByMesa.get(k);
    if (!q || q.length === 0) return;
    for (const s of q) {
      if (!s.closedAt) s.events.push(entry);
    }
  }

  /**
   * Vista pública canónica (meta, signal, result, engine, history, raw).
   * @param {Record<string, unknown>} session
   */
  function toSignalSession(session) {
    return buildCanonicalSignalSessionFromInternalSession(session);
  }

  /**
   * @param {string} eventName
   * @param {unknown} payload
   */
  function ingestProviderEvent(eventName, payload) {
    const mesa = extractMesaDeep(payload);
    const { payloadType } = getEnvelope(payload);

    const isSignal =
      eventName === 'NEW_SIGNAL' || (eventName === 'dashboardUpdate' && payloadType === 'NEW_SIGNAL');
    const isResult =
      eventName === 'NEW_RESULT' || (eventName === 'dashboardUpdate' && payloadType === 'NEW_RESULT');

    if (isResult) {
      const m = mesa;
      if (!m) return;
      const entry = buildEventEntry(eventName, payload, m, payloadType);
      const found = findSessionForResult(payload, m);
      if (!found || !found.session) return;
      const { session: s } = found;
      const env = getEnvelope(payload);
      s.events.push(entry);
      s.result = extractResultSnapshot(payload, env);
      s.closedAt = Date.now();
      s.duration = s.closedAt - s.openedAt;
      removeSessionFromMesa(s.mesa, s);
      pushCompleted(s);
      return;
    }

    const appendMesa = mesa || null;
    if (appendMesa) {
      const entry = buildEventEntry(eventName, payload, appendMesa, payloadType);
      appendToOpenMesa(appendMesa, entry);
    }

    if (isSignal) {
      const m = mesa || '_sin_mesa';
      const entry = buildEventEntry(eventName, payload, m, payloadType);
      const id = extractProviderSignalId(payload);
      const round = extractRoundDeep(payload);
      seq += 1;
      const session = {
        internalId: `sig_${seq}_${Date.now()}`,
        id,
        mesa: m,
        round: round ?? null,
        openedAt: Date.now(),
        events: [entry],
        result: null,
        closedAt: null,
        duration: null,
      };
      const k = mesaKey(m);
      if (!openByMesa.has(k)) openByMesa.set(k, []);
      openByMesa.get(k).push(session);
    }
  }

  /**
   * @param {'NEW_SIGNAL' | 'NEW_RESULT'} type
   * @param {unknown} payload — normalizado (client payload)
   */
  function ingestNormalized(type, payload) {
    if (type === 'NEW_SIGNAL') {
      ingestProviderEvent('NEW_SIGNAL', payload);
      return;
    }
    if (type === 'NEW_RESULT') {
      ingestProviderEvent('NEW_RESULT', payload);
    }
  }

  return {
    ingestProviderEvent,
    ingestNormalized,
    getActive: () =>
      Array.from(openByMesa.entries()).flatMap(([mesa, q]) =>
        q.filter((s) => !s.closedAt).map((s) => toSignalSession(s)),
      ),
    getCompleted: (n = MAX_COMPLETED) => completed.slice(0, n),
  };
}

let singleton = createTracker();

export function getSignalSessionTracker() {
  return singleton;
}

export function resetSignalSessionTrackerForTests() {
  singleton = createTracker();
}
