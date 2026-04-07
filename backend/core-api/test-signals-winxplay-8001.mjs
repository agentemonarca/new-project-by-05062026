/**
 * Prueba extendida winxplay :8001 — REST (axios) + WebSocket (socket.io-client).
 * Escucha mínima: 2 minutos. Contadores, heartbeat cada 10s, listeners nominales + onAny.
 *
 *   node test-signals-winxplay-8001.mjs
 */

import axios from 'axios';
import { io } from 'socket.io-client';

const API_KEY = 'EmpresaExterna123';
const HTTP_BASE_URL = 'https://appserver.winxplay.io:8001';
const WS_BASE_URL = 'wss://appserver.winxplay.io:8001/external-signals';
const LISTEN_MS = 120_000; // 2 minutos mínimo

let totalEvents = 0;
const eventTypes = new Set();
/** @type {{ event: string, data: unknown } | null} */
let firstPayload = null;

let wsConnected = false;
/** @type {string | null} */
let wsError = null;

function safeStringify(v) {
  try {
    return JSON.stringify(v, null, 2);
  } catch (e) {
    return `[non-serializable: ${e?.message || e}]`;
  }
}

function summarizeBody(body) {
  if (body == null) return '(vacío)';
  if (typeof body === 'string') {
    const s = body.length > 1200 ? `${body.slice(0, 1200)}… (len=${body.length})` : body;
    return s;
  }
  try {
    const keys = typeof body === 'object' && !Array.isArray(body) ? Object.keys(body).slice(0, 24) : [];
    const preview = JSON.stringify(body);
    const short = preview.length > 1500 ? `${preview.slice(0, 1500)}…` : preview;
    return keys.length ? `keys: [${keys.join(', ')}${keys.length >= 24 ? ', …' : ''}]\n${short}` : short;
  } catch {
    return String(body).slice(0, 800);
  }
}

function logConnectErrorDetail(err) {
  const msg = err?.message || String(err);
  wsError = msg;
  console.log('✖ connect_error:', msg);
  if (err?.description) console.log('   description:', err.description);
  const c = err?.cause ?? err;
  if (c && typeof c === 'object' && 'code' in c) console.log('   code:', c.code);
  const cause = err?.cause;
  if (cause instanceof Error) {
    console.log('   cause.message:', cause.message);
    if (cause.code) console.log('   cause.code:', cause.code);
  }
  const low = msg.toLowerCase();
  if (low.includes('econnrefused') || low.includes('refused')) {
    console.log('   → Típico: puerto cerrado o servicio caído en el host.');
  }
  if (low.includes('timeout')) {
    console.log('   → Típico: firewall, ruta bloqueada o servidor lento en handshake.');
  }
  if (low.includes('cert') || low.includes('tls') || low.includes('ssl')) {
    console.log('   → Típico: error TLS / certificado.');
  }
}

async function testRestAxios() {
  const url = `${HTTP_BASE_URL.replace(/\/$/, '')}/third-party/signals/receive`;
  console.log('\n=== REST (axios) ===');
  console.log('GET', url);
  try {
    const res = await axios.get(url, {
      headers: { 'x-api-key': API_KEY },
      timeout: 25_000,
      validateStatus: () => true,
    });
    const ok = res.status >= 200 && res.status < 300;
    console.log(ok ? '✔ response OK' : '✖ HTTP no exitoso');
    console.log('   status:', res.status, res.statusText || '');
    console.log('   body resumido:\n', summarizeBody(res.data));
    return { ok, status: res.status };
  } catch (err) {
    const ax = /** @type {import('axios').AxiosError} */ (err);
    console.log('✖ error axios / red');
    console.log('   message:', ax.message);
    if (ax.code) console.log('   code:', ax.code);
    if (ax.response) {
      console.log('   response status:', ax.response.status);
      console.log('   response data:', summarizeBody(ax.response.data));
    }
    let c = ax.cause;
    let depth = 0;
    while (c instanceof Error && depth < 5) {
      console.log(`   cause[${depth}]:`, c.message, c.code ? `(code=${c.code})` : '');
      c = c.cause;
      depth += 1;
    }
    return { ok: false, error: ax.message, code: ax.code };
  }
}

function runSocket() {
  return new Promise((resolve) => {
    console.log('\n=== WebSocket (Socket.IO) ===');
    console.log('URL:', WS_BASE_URL);
    console.log('auth: { apiKey: "***" }');
    console.log(`Escuchando ${LISTEN_MS / 1000}s (sin cerrar antes)…\n`);

    const socket = io(WS_BASE_URL, {
      transports: ['websocket'],
      auth: { apiKey: API_KEY },
      reconnection: false,
      timeout: 30_000,
    });

    const started = Date.now();
    const tick = setInterval(() => {
      const elapsedSec = Math.round((Date.now() - started) / 1000);
      console.log(`⏱ [${elapsedSec}s] eventos recibidos hasta ahora: ${totalEvents}`);
    }, 10_000);

    socket.on('connect', () => {
      wsConnected = true;
      console.log('✔ WebSocket: connect id=', socket.id);
    });

    socket.on('connect_error', (err) => {
      logConnectErrorDetail(err);
    });

    socket.on('disconnect', (reason) => {
      console.log('ℹ disconnect:', reason);
    });

    socket.on('dashboardUpdate', (data) => {
      console.log('🔥 dashboardUpdate:', JSON.stringify(data, null, 2));
    });

    socket.on('NEW_SIGNAL', (data) => {
      console.log('🟢 NEW_SIGNAL:', JSON.stringify(data, null, 2));
    });

    socket.on('NEW_RESULT', (data) => {
      console.log('🔵 NEW_RESULT:', JSON.stringify(data, null, 2));
    });

    socket.onAny((event, ...args) => {
      totalEvents += 1;
      eventTypes.add(event);
      const data = args.length <= 1 ? args[0] : args;
      if (!firstPayload) firstPayload = { event, data };
      console.log('EVENT:', event);
    });

    setTimeout(() => {
      clearInterval(tick);
      const elapsedSec = Math.round((Date.now() - started) / 1000);
      console.log(`\n⏱ Fin ventana: ${elapsedSec}s`);
      socket.removeAllListeners();
      socket.close();
      resolve();
    }, LISTEN_MS);
  });
}

function finalSummary(restResult) {
  const restOk = Boolean(restResult?.ok);
  const typesArr = [...eventTypes];

  console.log('\n========== RESUMEN FINAL ==========');
  console.log('conectado (WebSocket):', wsConnected);
  console.log('REST:', restOk ? 'OK' : 'FAIL');
  console.log('WebSocket:', wsConnected ? 'OK' : 'FAIL');
  if (!wsConnected && wsError) console.log('   causa WS:', wsError);
  console.log('total de eventos recibidos:', totalEvents);
  console.log('tipos de eventos:', typesArr.length ? typesArr.join(', ') : '(ninguno)');
  if (firstPayload) {
    console.log('primer payload recibido:');
    console.log(safeStringify(firstPayload));
  } else {
    console.log('primer payload: (ninguno)');
  }
  console.log('====================================\n');

  if (restOk && wsConnected && totalEvents === 0) {
    console.log(
      'INTERPRETACIÓN: El sistema está operativo (REST y WebSocket OK) pero no hubo emisión de señales en este periodo.',
    );
    console.log('(No se recibió tráfico de aplicación sobre el socket en los 2 minutos de escucha.)\n');
  }

  if (!restOk) {
    console.log('Diagnóstico REST: revisar clave, TLS, DNS o endpoint en :8001.');
  }
  if (!wsConnected) {
    console.log(
      'Diagnóstico WS: timeout → firewall/ruta; ECONNREFUSED → puerto cerrado; mensajes TLS → certificado/handshake.',
    );
  }
}

async function main() {
  console.log('Winxplay señales — puerto 8001 · ventana', LISTEN_MS / 1000, 's');
  const restResult = await testRestAxios();
  await runSocket();
  finalSummary(restResult);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exitCode = 1;
});
