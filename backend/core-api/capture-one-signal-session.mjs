/**
 * Observación pasiva: una sola Signal Session (NEW_SIGNAL → NEW_RESULT) en una mesa.
 * No altera core-api ni el bridge; solo conecta al proveedor y escribe JSON por stdout.
 *
 *   cd backend/core-api && node capture-one-signal-session.mjs
 *
 * .env: EXTERNAL_SIGNALS_API_KEY, EXTERNAL_SIGNALS_WS (opcional)
 * Opcional: CAPTURE_ONE_SESSION_MAX_MS=600000  SINGLE_SESSION_MESA=Baccarat 5
 */

import 'dotenv/config';
import { io as ioClient } from 'socket.io-client';

const MAX_WAIT_MS = Math.max(30_000, Number(process.env.CAPTURE_ONE_SESSION_MAX_MS || 600_000));
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

async function main() {
  if (!apiKey) {
    console.log(
      JSON.stringify(
        {
          error: 'EXTERNAL_SIGNALS_API_KEY ausente',
          mesa: null,
          round: null,
          eventsCaptured: [],
          eventCount: 0,
          result: null,
          durationMs: null,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  /** @type {null | { mesa: string, round: string | null, startTime: number, events: unknown[], active: boolean }} */
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
    finish(2, {
      error: 'timeout_sin_sesion_completa',
      mesa: session?.mesa ?? null,
      round: session?.round ?? null,
      eventsCaptured: session?.events ?? [],
      eventCount: session?.events?.length ?? 0,
      result: null,
      durationMs: session ? Date.now() - session.startTime : null,
    });
  }, MAX_WAIT_MS);
  timer.unref?.();

  socket.on('connect_error', (err) => {
    clearTimeout(timer);
    finish(1, {
      error: String(err?.message || err),
      mesa: null,
      round: null,
      eventsCaptured: [],
      eventCount: 0,
      result: null,
      durationMs: null,
    });
  });

  socket.on('connect', () => {
    console.error(`[one-session] conectado · esperando NEW_SIGNAL… (max ${MAX_WAIT_MS}ms)`);
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

    if (!session || !session.active) {
      if (type === 'NEW_SIGNAL') {
        if (FILTER_MESA && mesa && mesa !== FILTER_MESA) return;
        if (!mesa) return;
        session = {
          mesa,
          round: round ?? null,
          startTime: Date.now(),
          events: [entry],
          active: true,
        };
      }
      return;
    }

    if (mesa && mesa !== session.mesa) return;
    if (!mesa) return;

    session.events.push(entry);

    if (type === 'NEW_RESULT') {
      const end = Date.now();
      session.active = false;
      clearTimeout(timer);
      const durationMs = end - session.startTime;
      const resultStr =
        resultado != null ? (typeof resultado === 'object' ? JSON.stringify(resultado) : String(resultado)) : null;
      finish(0, {
        mesa: session.mesa,
        round: session.round,
        eventsCaptured: session.events,
        eventCount: session.events.length,
        result: resultStr,
        durationMs,
      });
    }
  });
}

main();
