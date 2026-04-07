/**
 * Observación pasiva: N sesiones completas (NEW_SIGNAL → NEW_RESULT), una tras otra, sin solapar.
 * No modifica core-api. Un socket, estado secuencial; no abre nueva sesión hasta cerrar la anterior.
 *
 *   cd backend/core-api && node capture-sequential-signal-sessions.mjs
 *
 * .env: EXTERNAL_SIGNALS_API_KEY, EXTERNAL_SIGNALS_WS (opcional)
 * Opcional:
 *   TOTAL_SESSIONS=3
 *   CAPTURE_SEQUENTIAL_MAX_MS=1800000
 *   SINGLE_SESSION_MESA=Baccarat 5  (solo NEW_SIGNAL en esa mesa inicia captura)
 */

import 'dotenv/config';
import { io as ioClient } from 'socket.io-client';

const TOTAL_SESSIONS = Math.max(1, Math.min(50, Number(process.env.TOTAL_SESSIONS || 3)));
const MAX_WAIT_MS = Math.max(60_000, Number(process.env.CAPTURE_SEQUENTIAL_MAX_MS || 1_800_000));
const FILTER_MESA = String(process.env.SINGLE_SESSION_MESA || '').trim();

const upstreamUrl =
  String(process.env.EXTERNAL_SIGNALS_WS || process.env.EXTERNAL_SIGNALS_URL || '').trim() ||
  'wss://appserver.winxplay.io:3000/external-signals';
const apiKey = String(process.env.EXTERNAL_SIGNALS_API_KEY || '').trim();

/** @param {unknown} p */
function coerce(p) {
  return p != null && typeof p === 'object' && !Array.isArray(p)
    ? /** @type {Record<string, unknown>} */ (p)
    : {};
}

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

function extractRound(payload) {
  const r = coerce(payload);
  const d =
    r.data != null && typeof r.data === 'object' && !Array.isArray(r.data)
      ? /** @type {Record<string, unknown>} */ (r.data)
      : /** @type {Record<string, unknown>} */ ({});
  const x = r.round ?? d.round ?? r.gameRound ?? d.gameRound;
  return x != null && String(x).trim() ? String(x) : null;
}

function extractResultado(payload) {
  const r = coerce(payload);
  const d =
    r.data != null && typeof r.data === 'object' && !Array.isArray(r.data)
      ? /** @type {Record<string, unknown>} */ (r.data)
      : /** @type {Record<string, unknown>} */ ({});
  const x = d.result ?? r.result ?? d.ganador ?? r.ganador ?? d.resultado ?? r.resultado;
  return x != null ? x : null;
}

/** @param {unknown} payload */
function clonePayload(payload) {
  try {
    if (payload == null) return payload;
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return { _note: 'unserializable', preview: String(payload).slice(0, 2000) };
  }
}

function main() {
  if (!apiKey) {
    console.log(
      JSON.stringify(
        { error: 'EXTERNAL_SIGNALS_API_KEY ausente', totalSessions: TOTAL_SESSIONS, sessions: [] },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  /** @type {Array<{ mesa: string, round: string | null, eventsCaptured: unknown[], result: string | null, durationMs: number }>} */
  const sessions = [];

  /** @type {null | { mesa: string, round: string | null, startTime: number, events: unknown[], active: boolean }} */
  let current = null;

  const socket = ioClient(upstreamUrl, {
    transports: ['websocket'],
    auth: { apiKey },
    reconnection: false,
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
    console.log(JSON.stringify(obj, null, 2));
    process.exit(code);
  };

  const timer = setTimeout(() => {
    finish(2, {
      error: 'timeout',
      totalSessions: TOTAL_SESSIONS,
      sessions,
    });
  }, MAX_WAIT_MS);
  timer.unref?.();

  socket.on('connect_error', (err) => {
    clearTimeout(timer);
    finish(1, {
      error: String(err?.message || err),
      totalSessions: TOTAL_SESSIONS,
      sessions,
    });
  });

  socket.on('connect', () => {
    console.error(
      `[sequential] conectado · objetivo ${TOTAL_SESSIONS} sesión(es) · aislamiento por mesa · max ${MAX_WAIT_MS}ms`,
    );
  });

  socket.onAny((eventName, ...args) => {
    const payload = args.length ? args[0] : undefined;
    const type = logicalType(payload);
    const mesa = extractMesa(payload);
    const round = extractRound(payload);
    const resultado = extractResultado(payload);

    const entry = {
      timestamp: Date.now(),
      eventName: String(eventName),
      payload: clonePayload(payload),
      payloadType: type,
      round: round ?? null,
      resultado: resultado != null ? resultado : null,
    };

    if (!current || !current.active) {
      if (sessions.length >= TOTAL_SESSIONS) return;
      if (type === 'NEW_SIGNAL') {
        if (FILTER_MESA && mesa && mesa !== FILTER_MESA) return;
        if (!mesa) return;
        current = {
          mesa,
          round: round ?? null,
          startTime: Date.now(),
          events: [entry],
          active: true,
        };
        console.error(`[sequential] sesión ${sessions.length + 1}/${TOTAL_SESSIONS} · mesa=${mesa} · abierta`);
      }
      return;
    }

    if (mesa && mesa !== current.mesa) return;
    if (!mesa) return;

    current.events.push(entry);

    if (type === 'NEW_RESULT') {
      const end = Date.now();
      current.active = false;
      const durationMs = end - current.startTime;
      const resultStr =
        resultado != null ? (typeof resultado === 'object' ? JSON.stringify(resultado) : String(resultado)) : null;
      const closed = {
        mesa: current.mesa,
        round: current.round,
        eventsCaptured: current.events,
        result: resultStr,
        durationMs,
      };
      sessions.push(closed);
      current = null;
      console.error(`[sequential] sesión ${sessions.length}/${TOTAL_SESSIONS} · cerrada · durationMs=${durationMs}`);

      if (sessions.length >= TOTAL_SESSIONS) {
        clearTimeout(timer);
        finish(0, { totalSessions: TOTAL_SESSIONS, sessions });
      }
    }
  });
}

main();
