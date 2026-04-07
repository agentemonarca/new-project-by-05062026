/**
 * Radiografía de una sesión completa (NEW_SIGNAL → NEW_RESULT) en una mesa:
 * payload completo sin filtrar, timeline, claves aplanadas, diffs consecutivos, hallazgos.
 *
 *   cd backend/core-api && node mesa-session-radiograph.mjs
 *
 * .env: EXTERNAL_SIGNALS_API_KEY, EXTERNAL_SIGNALS_WS
 * Opcional: MESA_RADIOGRAPH_MAX_MS=1200000  SINGLE_SESSION_MESA=Baccarat 5
 */

import 'dotenv/config';
import { io as ioClient } from 'socket.io-client';

const MAX_WAIT_MS = Math.max(60_000, Number(process.env.MESA_RADIOGRAPH_MAX_MS || 1_200_000));
const FILTER_MESA = String(process.env.SINGLE_SESSION_MESA || '').trim();

const upstreamUrl =
  String(process.env.EXTERNAL_SIGNALS_WS || process.env.EXTERNAL_SIGNALS_URL || '').trim() ||
  'wss://appserver.winxplay.io:3000/external-signals';
const apiKey = String(process.env.EXTERNAL_SIGNALS_API_KEY || '').trim();

const SCORE_HINT_RE =
  /score|point|puntaje|player|banker|cartas?|card|vector|history|historial|result|ganador|tie|empate|tablero|ronda|mesa_info|victorias|values?/i;

/** @param {unknown} p */
function coerce(p) {
  return p != null && typeof p === 'object' && !Array.isArray(p)
    ? /** @type {Record<string, unknown>} */ (p)
    : {};
}

/** @param {unknown} payload */
function logicalType(payload) {
  const r = coerce(payload);
  const d =
    r.data != null && typeof r.data === 'object' && !Array.isArray(r.data)
      ? /** @type {Record<string, unknown>} */ (r.data)
      : /** @type {Record<string, unknown>} */ ({});
  const t = r.type ?? d.type;
  return t != null ? String(t) : null;
}

function extractMesa(payload) {
  const r = coerce(payload);
  const d =
    r.data != null && typeof r.data === 'object' && !Array.isArray(r.data)
      ? /** @type {Record<string, unknown>} */ (r.data)
      : /** @type {Record<string, unknown>} */ ({});
  const x = r.mesa ?? d.mesa ?? r.table ?? d.table ?? r.tableId ?? d.tableId;
  return x != null && String(x).trim() ? String(x).trim() : null;
}

/** @param {unknown} v */
function cloneFull(v) {
  try {
    if (v === undefined) return null;
    return JSON.parse(JSON.stringify(v));
  } catch {
    return { _raw: String(v).slice(0, 100_000) };
  }
}

/**
 * @param {unknown} obj
 * @param {string} prefix
 * @param {Set<string>} out
 */
function flattenKeys(obj, prefix, out) {
  if (obj === null || obj === undefined) {
    out.add(prefix || '(root)');
    return;
  }
  if (typeof obj !== 'object') {
    out.add(prefix || '(primitive)');
    return;
  }
  if (Array.isArray(obj)) {
    out.add(`${prefix}[]`);
    const cap = Math.min(obj.length, 50);
    for (let i = 0; i < cap; i++) {
      flattenKeys(obj[i], `${prefix}[${i}]`, out);
    }
    if (obj.length > cap) out.add(`${prefix}[…${obj.length - cap} more]`);
    return;
  }
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    out.add(prefix || '(empty)');
    return;
  }
  for (const k of keys) {
    const p = prefix ? `${prefix}.${k}` : k;
    flattenKeys(/** @type {Record<string, unknown>} */ (obj)[k], p, out);
  }
}

/**
 * @param {unknown} obj
 * @param {string} prefix
 * @param {Map<string, unknown>} out
 */
function flattenValues(obj, prefix, out) {
  if (obj === null || obj === undefined) {
    out.set(prefix || '(root)', obj);
    return;
  }
  if (typeof obj !== 'object') {
    out.set(prefix || 'value', obj);
    return;
  }
  if (Array.isArray(obj)) {
    out.set(`${prefix}[]`, obj);
    const cap = Math.min(obj.length, 50);
    for (let i = 0; i < cap; i++) {
      flattenValues(obj[i], `${prefix}[${i}]`, out);
    }
    return;
  }
  for (const k of Object.keys(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    flattenValues(/** @type {Record<string, unknown>} */ (obj)[k], p, out);
  }
}

/**
 * @param {Map<string, unknown>} prev
 * @param {Map<string, unknown>} curr
 */
function diffMaps(prev, curr) {
  /** @type {string[]} */
  const changed = [];
  /** @type {string[]} */
  const nuevos = [];
  const prevKeys = new Set(prev.keys());
  for (const [k, v] of curr) {
    if (!prev.has(k)) nuevos.push(k);
    else {
      const a = prev.get(k);
      try {
        if (JSON.stringify(a) !== JSON.stringify(v)) changed.push(k);
      } catch {
        if (a !== v) changed.push(k);
      }
    }
  }
  return { changed, nuevos };
}

/**
 * @param {Set<string>} allPaths
 */
function candidateScoreFields(allPaths) {
  return [...allPaths].filter((p) => SCORE_HINT_RE.test(p)).sort();
}

/**
 * @param {unknown} payload
 */
function findHallazgoScorePaths(payload) {
  const r = coerce(payload);
  const type = logicalType(payload);
  const hits = /** @type {string[]} */ ([]);
  const set = new Set();
  const walk = (obj, p) => {
    if (obj == null) return;
    if (typeof obj !== 'object') return;
    if (/mesa_info|puntaje|cartas|ganador|victorias|tablero|martingala|vector_resultado|vector_forecast/i.test(p)) {
      if (!set.has(p)) {
        set.add(p);
        hits.push(p);
      }
    }
    if (Array.isArray(obj)) {
      obj.slice(0, 30).forEach((x, i) => walk(x, `${p}[${i}]`));
      return;
    }
    for (const k of Object.keys(obj)) {
      walk(/** @type {Record<string, unknown>} */ (obj)[k], p ? `${p}.${k}` : k);
    }
  };
  walk(r, '');
  return { type, hits };
}

function main() {
  if (!apiKey) {
    console.log(JSON.stringify({ error: 'EXTERNAL_SIGNALS_API_KEY ausente' }, null, 2));
    process.exit(1);
  }

  /** @type {null | { mesa: string, startTime: number, events: unknown[], timeline: unknown[] }} */
  let session = null;

  const socket = ioClient(upstreamUrl, {
    transports: ['websocket'],
    auth: { apiKey },
    reconnection: false,
    timeout: 25_000,
  });

  const finish = (code, obj) => {
    try {
      socket.removeAllListeners();
      socket.disconnect();
    } catch {
      /* ignore */
    }
    console.log(JSON.stringify(obj, null, 2));
    process.exit(code);
  };

  const timer = setTimeout(() => {
    finish(2, { error: 'timeout', partial: buildPartialReport(session) });
  }, MAX_WAIT_MS);
  timer.unref?.();

  /** @param {typeof session} s */
  function buildPartialReport(s) {
    if (!s) return { mesa: null, events: [] };
    return {
      mesa: s.mesa,
      eventCount: s.events.length,
      events: s.events.map((e) => {
        const x = /** @type {any} */ (e);
        const { flatMap: _f, ...rest } = x;
        return rest;
      }),
    };
  }

  socket.on('connect_error', (err) => {
    clearTimeout(timer);
    finish(1, { error: String(err?.message || err) });
  });

  socket.on('connect', () => {
    console.error(`[radiograph] conectado · captura 1 sesión · max ${MAX_WAIT_MS}ms (stderr)`);
  });

  socket.onAny((eventName, ...args) => {
    const payload = args.length ? args[0] : undefined;
    const type = logicalType(payload);

    if (!session) {
      if (type === 'NEW_SIGNAL') {
        const mesa = extractMesa(payload);
        if (FILTER_MESA && mesa && mesa !== FILTER_MESA) return;
        if (!mesa) return;
        session = {
          mesa,
          startTime: Date.now(),
          events: /** @type {unknown[]} */ ([]),
          timeline: /** @type {unknown[]} */ ([]),
        };
      }
      return;
    }

    const mesa = extractMesa(payload);
    if (mesa && mesa !== session.mesa) return;
    if (!mesa) return;

    const now = Date.now();
    const secondsFromStart = (now - session.startTime) / 1000;
    const payloadFull = cloneFull(payload);
    /** @type {Set<string>} */
    const keySet = new Set();
    flattenKeys(payloadFull, '', keySet);
    const keys = [...keySet].sort();

    /** @type {Map<string, unknown>} */
    const flatCurr = new Map();
    flattenValues(payloadFull, '', flatCurr);

    const prevEntry = session.events.length ? session.events[session.events.length - 1] : null;
    /** @type {{ changed: string[], nuevos: string[] } | null} */
    let diffPrev = null;
    if (prevEntry && typeof prevEntry === 'object' && prevEntry !== null && 'flatMap' in prevEntry) {
      const pm = /** @type {Map<string, unknown>} */ (/** @type {any} */ (prevEntry).flatMap);
      diffPrev = diffMaps(pm, flatCurr);
    }

    const entry = {
      timestamp: now,
      secondsFromStart,
      eventName: String(eventName),
      payloadType: type,
      payloadFull,
      keys,
      flatMap: flatCurr,
      diffFromPrevious: diffPrev,
    };

    session.events.push(entry);
    session.timeline.push({
      timestamp: now,
      secondsFromStart,
      eventName: String(eventName),
      payloadType: type,
    });

    if (type === 'NEW_RESULT') {
      clearTimeout(timer);
      const end = Date.now();
      const durationSec = (end - session.startTime) / 1000;

      /** @type {Set<string>} */
      const allFields = new Set();
      for (const e of session.events) {
        if (e && typeof e === 'object' && 'keys' in e) {
          for (const k of /** @type {string[]} */ ((/** @type {any} */ (e).keys))) {
            allFields.add(k);
          }
        }
      }

      const camposDetectados = [...allFields].sort();
      const candidatosScore = candidateScoreFields(allFields);

      /** @type {number[]} */
      const gaps = [];
      for (let i = 1; i < session.events.length; i++) {
        const a = /** @type {any} */ (session.events[i - 1]).timestamp;
        const b = /** @type {any} */ (session.events[i]).timestamp;
        gaps.push((b - a) / 1000);
      }

      const hallazgosPartes = [];
      let idxSignal = -1;
      let idxResult = -1;
      for (let i = 0; i < session.events.length; i++) {
        const e = /** @type {any} */ (session.events[i]);
        if (e.payloadType === 'NEW_SIGNAL') idxSignal = i;
        if (e.payloadType === 'NEW_RESULT') idxResult = i;
      }
      if (idxResult >= 0) {
        const { hits } = findHallazgoScorePaths(/** @type {any} */ (session.events[idxResult]).payloadFull);
        hallazgosPartes.push(
          `En el evento de cierre (índice ${idxResult}, NEW_RESULT) aparecen rutas con score/resultado típicos: ${hits.slice(0, 25).join('; ') || '(ninguna heurística)'}${hits.length > 25 ? '…' : ''}`,
        );
      }
      if (idxSignal >= 0) {
        const { hits } = findHallazgoScorePaths(/** @type {any} */ (session.events[idxSignal]).payloadFull);
        hallazgosPartes.push(
          `En el evento de apertura (índice ${idxSignal}, NEW_SIGNAL) rutas destacadas: ${hits.slice(0, 25).join('; ') || '(ninguna heurística)'}${hits.length > 25 ? '…' : ''}`,
        );
      }
      hallazgosPartes.push(
        candidatosScore.length
          ? `Campos candidatos a score (${candidatosScore.length} rutas) incluyen desde la unión de todos los payloads: ejemplo ${candidatosScore.slice(0, 12).join(', ')}${candidatosScore.length > 12 ? '…' : ''}.`
          : 'No se detectaron rutas con heurística de score en la unión de paths.',
      );

      const report = {
        'SESION_COMPLETA': {
          mesa: session.mesa,
          durationSec,
          durationMs: end - session.startTime,
          eventCount: session.events.length,
        },
        CAMPOS_DETECTADOS: camposDetectados,
        CAMPOS_CANDIDATOS_A_SCORE: candidatosScore,
        metricas: {
          tiempoTotalSec: durationSec,
          tiempoEntreEventosSec: gaps,
          numeroEventos: session.events.length,
        },
        TIMELINE: session.timeline,
        eventosCompletos: session.events.map((e) => {
          const x = /** @type {any} */ (e);
          const { flatMap: _fm, ...rest } = x;
          return rest;
        }),
        HALLAZGOS: hallazgosPartes.join('\n'),
      };

      finish(0, report);
    }
  });
}

main();
