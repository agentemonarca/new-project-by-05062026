/**
 * Interpretación en capas del stream en tiempo real (proveedor + relay normalizado).
 * Solo usa claves presentes en el payload; donde no hay dato → null (sin inventar).
 */
import {
  normalizeNewResultPayload,
  normalizeNewSignalPayload,
} from './signalNormalize.js';

const MAX_RECENT = 200;

/** @typedef {'DIRECT_ENTRY'|'RECOVERY'|'HIGH_RISK'|null} SignalTipo */
/** @typedef {'PENDING'|'ACTIVE'|'WON'|'LOST'|'TIE'|null} VigilanciaEstado */
/** @typedef {'OBSERVE'|'PREPARE'|'EXECUTE'|'RECOVER'|'STABILIZE'|'ALERT'} FaseNombre */

/** @type {import('socket.io').Server | null} */
let ioRef = null;

/** @param {import('socket.io').Server | null} io */
export function setSignalStreamInterpreterIo(io) {
  ioRef = io;
}

/** @param {unknown} v */
function safeRawClone(v) {
  if (v == null) return v;
  if (typeof v !== 'object') return v;
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return { _unserializable: String(v) };
  }
}

/**
 * @param {unknown} x
 * @returns {'PLAYER'|'BANKER'|'TIE'|null}
 */
export function normalizeResultadoSide(x) {
  if (x == null) return null;
  const s = String(x).trim().toUpperCase();
  if (!s) return null;
  if (s === 'TIE' || s === 'T' || s.includes('TIE')) return 'TIE';
  if (s === 'PLAYER' || s === 'P' || s.startsWith('PLAY')) return 'PLAYER';
  if (s === 'BANKER' || s === 'B' || s.startsWith('BANK')) return 'BANKER';
  return null;
}

/**
 * @param {unknown} payload
 */
function coerceObject(payload) {
  return payload != null && typeof payload === 'object' && !Array.isArray(payload)
    ? /** @type {Record<string, unknown>} */ (payload)
    : {};
}

/**
 * Relay `NEW_SIGNAL`: `{ supplier, canonical }` → una fila para normalizar (canonical encima del proveedor).
 * @param {unknown} forClient
 */
function mergeRelayNewSignalForInterpreter(forClient) {
  const b = coerceObject(forClient);
  const sup = b.supplier;
  const can = b.canonical;
  if (can != null && typeof can === 'object' && !Array.isArray(can)) {
    const canObj = /** @type {Record<string, unknown>} */ (can);
    if (sup != null && typeof sup === 'object' && !Array.isArray(sup)) {
      return { ...coerceObject(sup), ...canObj };
    }
    return { ...canObj };
  }
  return b;
}

/**
 * @param {Record<string, unknown>} r
 * @returns {unknown[]|null}
 */
function extractHistory(r) {
  const h = r.history ?? r.historial ?? r.History;
  if (Array.isArray(h)) return h;
  return null;
}

/**
 * @param {Record<string, unknown>} r
 */
function extractContext(r) {
  const mesa = String(r.mesa ?? r.table ?? r.desk ?? r.tableName ?? r.tableId ?? r.mesaName ?? '').trim() || null;
  const roundRaw = r.round ?? r.gameRound ?? r.gameId ?? r.shoe ?? r.hand ?? r.roundId;
  const round = roundRaw != null && String(roundRaw).trim() !== '' ? String(roundRaw) : null;
  const history = extractHistory(r);
  return { mesa, round, history };
}

/**
 * @param {string} eventName
 * @param {unknown} payload
 */
function extractNestedDataObject(eventName, payload) {
  const r = coerceObject(payload);
  if (eventName === 'dashboardUpdate' && r.data != null && typeof r.data === 'object' && !Array.isArray(r.data)) {
    return /** @type {Record<string, unknown>} */ (r.data);
  }
  return r;
}

/**
 * @param {number} m
 * @returns {SignalTipo}
 */
export function martingaleToTipo(m) {
  const n = Number(m);
  if (!Number.isFinite(n)) return null;
  if (n === 0) return 'DIRECT_ENTRY';
  if (n >= 1 && n <= 2) return 'RECOVERY';
  if (n >= 3) return 'HIGH_RISK';
  return null;
}

/**
 * @param {'PLAYER'|'BANKER'|null} prediction
 * @param {'PLAYER'|'BANKER'|'TIE'|null} resultado
 * @returns {VigilanciaEstado}
 */
export function matchVerdict(prediction, resultado) {
  if (resultado === 'TIE') return 'TIE';
  if (prediction == null || resultado == null) return null;
  if (prediction === resultado) return 'WON';
  return 'LOST';
}

/**
 * @param {{
 *   eventName: string,
 *   payload: unknown,
 *   origin: 'provider' | 'relay',
 *   vigilancia: VigilanciaEstado,
 *   fase: FaseNombre,
 *   signalTipo: SignalTipo,
 *   direccion: 'PLAYER'|'BANKER'|'UNKNOWN'|null,
 *   martingale: number | null,
 *   resultado: 'PLAYER'|'BANKER'|'TIE'|null,
 *   contexto: { mesa: string | null, round: string | null, history: unknown[] | null },
 * }} p
 */
export function buildFullSignalState(p) {
  const {
    eventName,
    payload,
    origin,
    vigilancia,
    fase,
    signalTipo,
    direccion,
    martingale,
    resultado,
    contexto,
  } = p;

  const mesaLabel = contexto.mesa ?? 'mesa desconocida';
  const roundLabel = contexto.round != null ? contexto.round : 'ronda desconocida';
  const tipoStr = signalTipo || 'sin clasificación de señal';
  const dirStr = direccion && direccion !== 'UNKNOWN' ? direccion : 'dirección no determinada';
  const vigStr = vigilancia ?? 'N/A';
  const resStr = resultado ?? 'no informado';

  const resumenParts = [
    `Evento «${eventName}» (${origin}).`,
    signalTipo
      ? `Señal tipo ${tipoStr} en ${mesaLabel}, ronda ${roundLabel}, dirección ${dirStr}.`
      : `Contexto mesa=${mesaLabel}, ronda=${roundLabel} (sin bloque de señal explícito en este payload).`,
  ];
  if (resultado) resumenParts.push(`Resultado del juego: ${resStr}.`);
  resumenParts.push(`Vigilancia: ${vigStr}. Fase GPulse: ${fase}.`);

  const detalleParts = [];
  if (martingale != null && Number.isFinite(Number(martingale))) {
    detalleParts.push(
      `Martingala reportada=${martingale} → tipo ${tipoStr} (0=directo, 1–2=recuperación, ≥3=alto riesgo).`,
    );
  }
  if (vigilancia === 'WON' || vigilancia === 'LOST' || vigilancia === 'TIE') {
    detalleParts.push(
      `Estado ${vigStr} según comparación recomendación↔resultado (${resStr}), o banderas del proveedor.`,
    );
  } else if (vigilancia === 'PENDING') {
    detalleParts.push('Estado PENDING: evento NEW_SIGNAL (proveedor), antes del resultado.');
  } else if (vigilancia === 'ACTIVE') {
    detalleParts.push('Estado ACTIVE: señal abierta en el relay (esperando resultado).');
  }
  detalleParts.push(
    `Fase «${fase}» aplicando prioridad: ALERT > STABILIZE > RECOVER > EXECUTE > PREPARE > OBSERVE.`,
  );

  return {
    raw: safeRawClone(payload),
    contexto: {
      mesa: contexto.mesa,
      round: contexto.round,
      history: contexto.history,
    },
    evento: {
      resultado,
    },
    señal: {
      tipo: signalTipo,
      direccion,
      martingale,
    },
    vigilancia: {
      estado: vigilancia,
    },
    fase: {
      nombre: fase,
    },
    explicacion: {
      resumen: resumenParts.join(' '),
      detalle: detalleParts.join(' '),
    },
  };
}

function emptyCounters() {
  return {
    eventos: /** @type {Record<string, number>} */ ({}),
    signalTipos: { DIRECT_ENTRY: 0, RECOVERY: 0, HIGH_RISK: 0, sin_señal: 0 },
    vigilancia: { PENDING: 0, ACTIVE: 0, WON: 0, LOST: 0, TIE: 0, N_A: 0 },
    fases: {
      OBSERVE: 0,
      PREPARE: 0,
      EXECUTE: 0,
      RECOVER: 0,
      STABILIZE: 0,
      ALERT: 0,
    },
  };
}

/**
 * @param {Record<string, unknown>} frame
 */
function emitFrame(frame) {
  const off = String(process.env.ADMIN_SIGNALS_STREAM_FRAMES_OFF || '').toLowerCase();
  if (off === '1' || off === 'true' || off === 'yes') return;
  try {
    ioRef?.of('/admin-signals')?.emit('signal_stream_frame', frame);
  } catch {
    /* ignore */
  }
}

function createEngine() {
  const counters = emptyCounters();
  /** @type {Array<Record<string, unknown>>} */
  const recent = [];
  const openByMesa = new Map();
  const lossStreak = new Map();
  const lastWinSignal = new Map();

  function snapshotCounters() {
    return {
      eventos: { ...counters.eventos },
      signalTipos: { ...counters.signalTipos },
      vigilancia: { ...counters.vigilancia },
      fases: { ...counters.fases },
    };
  }

  function bumpEvent(name) {
    const k = String(name || '(anonymous)');
    counters.eventos[k] = (counters.eventos[k] || 0) + 1;
  }

  /** @param {SignalTipo} t */
  function bumpTipo(t) {
    if (t == null) counters.signalTipos.sin_señal += 1;
    else counters.signalTipos[t] = (counters.signalTipos[t] || 0) + 1;
  }

  /** @param {VigilanciaEstado} v */
  function bumpVig(v) {
    if (v == null) counters.vigilancia.N_A += 1;
    else counters.vigilancia[v] = (counters.vigilancia[v] || 0) + 1;
  }

  /** @param {FaseNombre} f */
  function bumpFase(f) {
    counters.fases[f] = (counters.fases[f] || 0) + 1;
  }

  /**
   * @param {string} mesaKey
   * @param {number} m
   * @param {boolean} isSignalEvent
   */
  function resolveFase(mesaKey, m, isSignalEvent) {
    const streak = lossStreak.get(mesaKey) || 0;
    if (streak >= 2) return /** @type {FaseNombre} */ ('ALERT');
    if (lastWinSignal.get(mesaKey) === true) return /** @type {FaseNombre} */ ('STABILIZE');
    if (isSignalEvent && Number.isFinite(m) && m >= 1) return /** @type {FaseNombre} */ ('RECOVER');
    if (isSignalEvent && Number.isFinite(m) && m === 0) return /** @type {FaseNombre} */ ('EXECUTE');
    if (isSignalEvent) return /** @type {FaseNombre} */ ('PREPARE');
    return /** @type {FaseNombre} */ ('OBSERVE');
  }

  function pushRecent(entry) {
    recent.unshift(entry);
    if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;
  }

  /**
   * @param {string} eventName
   * @param {unknown} payload
   */
  function ingestProviderOnAny(eventName, payload) {
    bumpEvent(eventName);

    const base = extractNestedDataObject(eventName, payload);
    const ctxDims = extractContext(base);

    let resultado = null;
    const rawRes = base.ganador ?? base.resultado ?? base.result ?? base.outcome ?? base.winner;
    resultado = normalizeResultadoSide(rawRes);

    let direccion = null;
    let martingale = null;
    let signalTipo = null;

    if (eventName === 'NEW_SIGNAL') {
      const norm = normalizeNewSignalPayload(payload);
      direccion = norm.prediction === 'UNKNOWN' ? null : norm.prediction;
      martingale = Number.isFinite(norm.martingale) ? norm.martingale : null;
      signalTipo = martingaleToTipo(martingale ?? 0);
    } else if (base.forecast != null || base.prediction != null) {
      const norm = normalizeNewSignalPayload(payload);
      direccion = norm.prediction === 'UNKNOWN' ? null : norm.prediction;
      martingale = Number.isFinite(norm.martingale) ? norm.martingale : null;
      signalTipo = martingaleToTipo(martingale ?? 0);
    }

    /** Vigilancia solo desde payload (sin estado interno). */
    let vigilancia = null;
    if (eventName === 'NEW_SIGNAL') vigilancia = 'PENDING';
    else if (eventName === 'NEW_RESULT') {
      const n = normalizeNewResultPayload(payload);
      if (n.winStatus === true) vigilancia = 'WON';
      else if (n.winStatus === false) vigilancia = resultado === 'TIE' ? 'TIE' : 'LOST';
      else if (resultado === 'TIE') vigilancia = 'TIE';
      else vigilancia = null;
    }

    const mesaKey = ctxDims.mesa || '—';
    const mForFase = martingale ?? 0;
    const fase = resolveFase(mesaKey, mForFase, eventName === 'NEW_SIGNAL');

    const layers = buildFullSignalState({
      eventName,
      payload,
      origin: 'provider',
      vigilancia,
      fase,
      signalTipo,
      direccion,
      martingale,
      resultado: eventName === 'NEW_RESULT' || resultado != null ? resultado : null,
      contexto: ctxDims,
    });

    const frame = {
      v: 1,
      ts: Date.now(),
      origin: 'provider',
      eventName,
      counters: snapshotCounters(),
      layers,
    };
    pushRecent(frame);
    emitFrame(frame);
  }

  /**
   * @param {'NEW_SIGNAL'|'NEW_RESULT'} type
   * @param {unknown} forClient
   * @param {{ source?: string }} meta
   */
  /**
   * @param {'NEW_SIGNAL'|'NEW_RESULT'} type
   * @param {unknown} forClient
   * @param {{ source?: string, fromUpstream?: boolean }} meta
   */
  function ingestRelay(type, forClient, meta = {}) {
    const source = meta.source || 'relay';
    if (!meta.fromUpstream) bumpEvent(type);
    const mergedSignal = type === 'NEW_SIGNAL' ? mergeRelayNewSignalForInterpreter(forClient) : null;
    const base = type === 'NEW_SIGNAL' ? coerceObject(mergedSignal) : coerceObject(forClient);
    const ctxDims = extractContext(base);

    if (type === 'NEW_SIGNAL') {
      const norm = normalizeNewSignalPayload(mergedSignal);
      const mesaKey = norm.mesa || '—';
      const direccion = norm.prediction === 'UNKNOWN' ? null : norm.prediction;
      const martingale = Number.isFinite(norm.martingale) ? norm.martingale : null;
      const signalTipo = martingaleToTipo(martingale ?? 0);
      bumpTipo(signalTipo);

      openByMesa.set(mesaKey, {
        prediction: direccion,
        martingale,
        correlationKey: norm.correlationKey,
        round: norm.round,
      });

      const vigilancia = /** @type {VigilanciaEstado} */ ('ACTIVE');
      bumpVig(vigilancia);
      const fase = resolveFase(mesaKey, martingale ?? 0, true);
      bumpFase(fase);

      const layers = buildFullSignalState({
        eventName: type,
        payload: forClient,
        origin: 'relay',
        vigilancia,
        fase,
        signalTipo,
        direccion,
        martingale,
        resultado: null,
        contexto: ctxDims,
      });

      const fr = {
        v: 1,
        ts: Date.now(),
        origin: 'relay',
        eventName: type,
        source,
        counters: snapshotCounters(),
        layers,
      };
      pushRecent(fr);
      emitFrame(fr);
      return;
    }

    if (type === 'NEW_RESULT') {
      const norm = normalizeNewResultPayload(forClient);
      const mesaKey = norm.mesa || '—';
      let resultado = normalizeResultadoSide(
        base.ganador ?? base.resultado ?? base.result ?? base.outcome,
      );
      if (resultado == null && norm.raw && typeof norm.raw === 'object') {
        const rr = /** @type {Record<string, unknown>} */ (norm.raw);
        resultado = normalizeResultadoSide(rr.ganador ?? rr.resultado ?? rr.result);
      }

      const open = openByMesa.get(mesaKey);
      const rec = open?.prediction === 'BANKER' || open?.prediction === 'PLAYER' ? open.prediction : null;
      let vigilancia = matchVerdict(rec, resultado);
      if (norm.winStatus === true && vigilancia == null) vigilancia = 'WON';
      if (norm.winStatus === false && vigilancia == null && resultado !== 'TIE') vigilancia = 'LOST';
      if (vigilancia == null && resultado === 'TIE') vigilancia = 'TIE';

      if (vigilancia === 'WON') {
        lossStreak.set(mesaKey, 0);
        lastWinSignal.set(mesaKey, true);
      } else if (vigilancia === 'LOST') {
        lastWinSignal.set(mesaKey, false);
        lossStreak.set(mesaKey, (lossStreak.get(mesaKey) || 0) + 1);
      } else if (vigilancia === 'TIE') {
        lastWinSignal.delete(mesaKey);
      }
      openByMesa.delete(mesaKey);

      bumpVig(vigilancia);
      const fase = resolveFase(mesaKey, 0, false);
      bumpFase(fase);

      const layers = buildFullSignalState({
        eventName: type,
        payload: forClient,
        origin: 'relay',
        vigilancia,
        fase,
        signalTipo: null,
        direccion: null,
        martingale: null,
        resultado,
        contexto: ctxDims,
      });

      const fr = {
        v: 1,
        ts: Date.now(),
        origin: 'relay',
        eventName: type,
        source,
        counters: snapshotCounters(),
        layers,
      };
      pushRecent(fr);
      emitFrame(fr);
    }
  }

  return {
    ingestProviderOnAny,
    ingestRelay,
    getCounters: snapshotCounters,
    getRecent: (n = MAX_RECENT) => recent.slice(0, n),
  };
}

let engine = createEngine();

export function resetSignalStreamInterpreterForTests() {
  engine = createEngine();
}

/** @returns {ReturnType<typeof createEngine>} */
export function getSignalStreamInterpreter() {
  return engine;
}

/**
 * API pública stateless (p. ej. tests): clasifica un par evento+payload sin tocar motor.
 * @param {string} eventName
 * @param {unknown} payload
 */
export function buildFullSignalStateFromEvent(eventName, payload) {
  const base = extractNestedDataObject(eventName, payload);
  const ctxDims = extractContext(base);
  let resultado = normalizeResultadoSide(
    base.ganador ?? base.resultado ?? base.result ?? base.outcome ?? base.winner,
  );
  let direccion = null;
  let martingale = null;
  let signalTipo = null;
  if (eventName === 'NEW_SIGNAL' || (Array.isArray(base.vector_forecast) && base.vector_forecast.length > 0)) {
    const norm = normalizeNewSignalPayload(payload);
    direccion = norm.prediction === 'UNKNOWN' ? null : norm.prediction;
    martingale = Number.isFinite(norm.martingale) ? norm.martingale : null;
    signalTipo = martingaleToTipo(martingale ?? 0);
  }
  let vigilancia = null;
  if (eventName === 'NEW_SIGNAL') vigilancia = 'PENDING';
  else if (eventName === 'NEW_RESULT') {
    const n = normalizeNewResultPayload(payload);
    if (n.winStatus === true) vigilancia = 'WON';
    else if (n.winStatus === false) vigilancia = resultado === 'TIE' ? 'TIE' : 'LOST';
    else if (resultado === 'TIE') vigilancia = 'TIE';
  }
  const mForFase = martingale ?? 0;
  let fase = /** @type {FaseNombre} */ ('OBSERVE');
  if (eventName === 'NEW_SIGNAL' && Number.isFinite(mForFase) && mForFase >= 1) fase = 'RECOVER';
  else if (eventName === 'NEW_SIGNAL' && mForFase === 0) fase = 'EXECUTE';
  else if (eventName === 'NEW_SIGNAL') fase = 'PREPARE';

  return buildFullSignalState({
    eventName,
    payload,
    origin: 'provider',
    vigilancia,
    fase,
    signalTipo,
    direccion,
    martingale,
    resultado: eventName === 'NEW_RESULT' || resultado != null ? resultado : null,
    contexto: ctxDims,
  });
}
