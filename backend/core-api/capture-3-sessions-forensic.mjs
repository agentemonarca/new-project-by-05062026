/**
 * Captura forense: 3 ciclos completos (NEW_SIGNAL → … → NEW_RESULT) de UNA mesa por sesión,
 * sin transformar payloads del proveedor (clon profundo para no mutar referencias).
 *
 *   cd backend/core-api && node capture-3-sessions-forensic.mjs
 *   OUT_FILE=./forensic-out.json node capture-3-sessions-forensic.mjs
 *
 * Requiere: EXTERNAL_SIGNALS_API_KEY
 * URL: EXTERNAL_SIGNALS_WS | EXTERNAL_SIGNALS_URL (default Winxplay ejemplo en .env.example)
 *
 * Opcional:
 *   TOTAL_SESSIONS=3
 *   FORENSIC_MAX_MS=1800000
 *   FORENSIC_TARGET_MESA=TEST   — solo abre sesión si el NEW_SIGNAL es de esa mesa
 */

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { io as ioClient } from 'socket.io-client';
import { extractMesaFromPayload } from './src/admin-signals/signalNormalize.js';

const TOTAL_SESSIONS = Math.max(1, Math.min(20, Number(process.env.TOTAL_SESSIONS || 3)));
const MAX_WAIT_MS = Math.max(60_000, Number(process.env.FORENSIC_MAX_MS || 1_800_000));
const TARGET_MESA = String(process.env.FORENSIC_TARGET_MESA || '').trim();

const upstreamUrl =
  String(process.env.EXTERNAL_SIGNALS_WS || process.env.EXTERNAL_SIGNALS_URL || '').trim() ||
  'wss://appserver.winxplay.io:3000/external-signals';
const apiKey = String(process.env.EXTERNAL_SIGNALS_API_KEY || '').trim();
const OUT_FILE = String(process.env.OUT_FILE || 'capture-3-sessions-forensic-output.json').trim();

/** @param {unknown} p */
function asRecord(p) {
  return p != null && typeof p === 'object' && !Array.isArray(p)
    ? /** @type {Record<string, unknown>} */ (p)
    : {};
}

/**
 * payload?.type || payload?.data?.type (y un nivel más de anidación si existe)
 * @param {unknown} payload
 */
function payloadTypeFromBody(payload) {
  const r = asRecord(payload);
  const d = asRecord(r.data);
  const d2 = asRecord(d.data);
  const t = r.type ?? d.type ?? d2.type;
  return t != null ? String(t) : '';
}

/**
 * Mesa unificada (misma heurística que el core sobre objeto ya aplanado superficialmente).
 * @param {unknown} payload
 */
function mesaFromPayloadDeep(payload) {
  const r = asRecord(payload);
  const d = asRecord(r.data);
  const merged = { ...r, ...d };
  const d2 = asRecord(d.data);
  const merged2 = { ...merged, ...d2 };
  const m = extractMesaFromPayload(merged2);
  return m && String(m).trim() && m !== '—' ? String(m).trim() : '';
}

/**
 * Ronda para correlación humana (no altera payloads guardados).
 * @param {unknown} payload
 */
function roundFromPayloadDeep(payload) {
  const r = asRecord(payload);
  const d = asRecord(r.data);
  const d2 = asRecord(d.data);
  const x =
    r.round ??
    d.round ??
    d2.round ??
    r.gameRound ??
    d.gameRound ??
    r.roundId ??
    d.roundId;
  return x != null && String(x).trim() ? String(x) : '—';
}

/** @param {unknown} payload */
function cloneExact(payload) {
  if (payload === undefined) return undefined;
  try {
    if (typeof structuredClone === 'function') return structuredClone(payload);
  } catch {
    /* fall through */
  }
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return { _forensic_note: 'not_json_serializable', typeof: typeof payload, stringPreview: String(payload).slice(0, 4000) };
  }
}

/**
 * @param {unknown} val
 * @param {string} prefix
 * @param {Record<string, number>} acc
 */
function collectPaths(val, prefix, acc) {
  const key = prefix || '$root';
  acc[key] = (acc[key] || 0) + 1;
  if (val === null || typeof val !== 'object') return;
  if (Array.isArray(val)) {
    for (let i = 0; i < val.length; i++) {
      collectPaths(val[i], `${prefix}[${i}]`, acc);
    }
    return;
  }
  for (const k of Object.keys(val)) {
    const p = prefix ? `${prefix}.${k}` : k;
    collectPaths(/** @type {unknown} */ (val[k]), p, acc);
  }
}

/** @param {unknown} obj */
function allPaths(obj) {
  const acc = Object.create(null);
  collectPaths(obj, '', acc);
  return acc;
}

/** @param {Record<string, number>[]} pathMaps */
function pathsInAllSessions(pathMaps) {
  if (pathMaps.length === 0) return [];
  const first = new Set(Object.keys(pathMaps[0]));
  for (let i = 1; i < pathMaps.length; i++) {
    for (const k of [...first]) {
      if (!(k in pathMaps[i])) first.delete(k);
    }
  }
  return [...first].sort();
}

/** @param {Record<string, number>[]} pathMaps */
function diffPathsBetweenSessions(pathMaps) {
  const all = new Set();
  for (const m of pathMaps) {
    for (const k of Object.keys(m)) all.add(k);
  }
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const path of all) {
    const present = pathMaps.map((m, i) => (path in m ? `S${i + 1}` : null)).filter(Boolean);
    if (present.length > 0 && present.length < pathMaps.length) {
      out[path] = present;
    }
  }
  return out;
}

function main() {
  if (!apiKey) {
    const err = { error: 'EXTERNAL_SIGNALS_API_KEY ausente', totalSessions: TOTAL_SESSIONS, sessions: [] };
    writeFileSync(OUT_FILE, JSON.stringify(err, null, 2), 'utf8');
    console.error(err.error);
    process.exit(1);
  }

  /** @type {Array<Record<string, unknown>>} */
  const sessions = [];

  /** @type {null | {
   *   mesa: string,
   *   round: string,
   *   startTime: number,
   *   inicio: { eventName: string, payloadType: string, payload: unknown },
   *   eventos: Array<{
   *     timestamp: number,
   *     secondsFromStart: number,
   *     eventName: string,
   *     payloadType: string,
   *     payloadFull: unknown,
   *   }>,
   * }} */
  let current = null;

  const socket = ioClient(upstreamUrl, {
    transports: ['websocket'],
    auth: { apiKey },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    timeout: 25_000,
  });

  /** @param {number} code @param {Record<string, unknown>} obj */
  const finish = (code, obj) => {
    try {
      socket.removeAllListeners();
      socket.disconnect();
    } catch {
      /* ignore */
    }
    const text = JSON.stringify(obj, null, 2);
    writeFileSync(OUT_FILE, text, 'utf8');
    console.error(`[forensic] escrito: ${OUT_FILE} (${Buffer.byteLength(text, 'utf8')} bytes)`);
    process.exit(code);
  };

  const timer = setTimeout(() => {
    finish(2, {
      error: 'timeout',
      totalSessions: TOTAL_SESSIONS,
      captured: sessions.length,
      sessions,
      forensicAnalysis: buildAnalysis(sessions),
    });
  }, MAX_WAIT_MS);
  timer.unref?.();

  socket.on('connect_error', (err) => {
    clearTimeout(timer);
    finish(1, {
      error: String(err?.message || err),
      totalSessions: TOTAL_SESSIONS,
      sessions,
      forensicAnalysis: buildAnalysis(sessions),
    });
  });

  socket.on('connect', () => {
    console.error(
      `[forensic] conectado · ${upstreamUrl.replace(/:[^:@/]+@/, ':***@')} · objetivo ${TOTAL_SESSIONS} sesión(es) · max ${MAX_WAIT_MS}ms`,
    );
  });

  /**
   * @param {string} eventName
   * @param {unknown[]} args
   */
  function handleAny(eventName, args) {
    const payload = args.length ? args[0] : undefined;
    const payloadType = String(payloadTypeFromBody(payload) || '').trim();
    const typeUpper = payloadType.toUpperCase();
    const nameUpper = String(eventName).toUpperCase();

    const isNewSignal = nameUpper === 'NEW_SIGNAL' || typeUpper === 'NEW_SIGNAL';
    const isNewResult = nameUpper === 'NEW_RESULT' || typeUpper === 'NEW_RESULT';

    const mesaEvt = mesaFromPayloadDeep(payload);
    const roundEvt = roundFromPayloadDeep(payload);

    const payloadFull =
      args.length === 0
        ? null
        : args.length === 1
          ? cloneExact(args[0])
          : { _socketIoMultipleArgs: args.map((a) => cloneExact(a)) };

    const now = Date.now();

    if (!current) {
      if (sessions.length >= TOTAL_SESSIONS) return;
      if (!isNewSignal) return;
      if (!mesaEvt) return;
      if (TARGET_MESA && mesaEvt !== TARGET_MESA) return;

      current = {
        mesa: mesaEvt,
        round: roundEvt,
        startTime: now,
        inicio: {
          eventName: String(eventName),
          payloadType: payloadType || String(eventName),
          payload: cloneExact(payload),
        },
        eventos: [],
      };
      console.error(`[forensic] sesión ${sessions.length + 1}/${TOTAL_SESSIONS} · ABIERTA · mesa=${mesaEvt} · round=${roundEvt}`);
      return;
    }

    const sameMesa = !mesaEvt || mesaEvt === current.mesa;
    if (!sameMesa) return;

    const sec = (now - current.startTime) / 1000;
    current.eventos.push({
      timestamp: now,
      secondsFromStart: Math.round(sec * 1000) / 1000,
      eventName: String(eventName),
      payloadType: payloadType || '—',
      payloadFull,
    });

    if (isNewResult) {
      const durationMs = now - current.startTime;
      const closed = {
        mesa: current.mesa,
        round: current.round,
        durationMs,
        eventCount: current.eventos.length,
        inicio: current.inicio,
        eventos: current.eventos,
        final: {
          eventName: String(eventName),
          payloadType: payloadType || String(eventName),
          payload: cloneExact(payload),
        },
      };
      sessions.push(closed);
      console.error(
        `[forensic] sesión ${sessions.length}/${TOTAL_SESSIONS} · CERRADA · durationMs=${durationMs} · eventos=${closed.eventCount}`,
      );
      current = null;

      if (sessions.length >= TOTAL_SESSIONS) {
        clearTimeout(timer);
        const out = {
          totalSessions: TOTAL_SESSIONS,
          sessions,
          forensicAnalysis: buildAnalysis(sessions),
        };
        finish(0, out);
      }
    }
  }

  socket.onAny((eventName, ...args) => {
    try {
      handleAny(String(eventName), args);
    } catch (e) {
      console.error('[forensic] handleAny error:', e?.message || e);
    }
  });
}

/**
 * @param {Array<Record<string, unknown>>} closedSessions
 */
function buildAnalysis(closedSessions) {
  const pathMaps = closedSessions.map((s) => {
    const acc = Object.create(null);
    collectPaths(s.inicio.payload, 'inicio.payload', acc);
    collectPaths(s.final.payload, 'final.payload', acc);
    for (const ev of s.eventos) {
      collectPaths(ev.payloadFull, 'eventos.payloadFull', acc);
    }
    return acc;
  });

  const pathFrequencyGlobal = Object.create(null);
  for (const m of pathMaps) {
    for (const [k, v] of Object.entries(m)) {
      pathFrequencyGlobal[k] = (pathFrequencyGlobal[k] || 0) + v;
    }
  }

  const sortedByFreq = Object.entries(pathFrequencyGlobal)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 200)
    .map(([path, count]) => ({ path, count }));

  const inEverySession = pathsInAllSessions(pathMaps);
  const pathDiffBySession = diffPathsBetweenSessions(pathMaps);

  /** @type {Record<string, unknown>[]} */
  const sessionKeyFingerprints = closedSessions.map((s, i) => ({
    index: i + 1,
    mesa: s.mesa,
    round: s.round,
    topLevelKeysInicio:
      s.inicio.payload != null && typeof s.inicio.payload === 'object' && !Array.isArray(s.inicio.payload)
        ? Object.keys(/** @type {object} */ (s.inicio.payload)).sort()
        : [],
    topLevelKeysFinal:
      s.final.payload != null && typeof s.final.payload === 'object' && !Array.isArray(s.final.payload)
        ? Object.keys(/** @type {object} */ (s.final.payload)).sort()
        : [],
  }));

  return {
    note: 'Rutas = recorrido de claves en payloads clonados; frecuencia acumulada en las 3 sesiones.',
    pathsRepeatedAcrossAllSessions: inEverySession.slice(0, 500),
    topPathsByFrequency: sortedByFreq,
    pathsPresentOnlyInSomeSessions: pathDiffBySession,
    sessionPayloadShapeSummary: sessionKeyFingerprints,
  };
}

main();
