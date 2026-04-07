/**
 * Prueba en vivo: REST + WebSocket (Socket.IO) contra el proveedor externo.
 *
 * Ejecutar desde este directorio:
 *   node test-signals-live.js
 *
 * Requisitos: Node >= 18 (fetch), dependencia socket.io-client (npm install en core-api).
 */

import { io } from 'socket.io-client';

const API_KEY = 'EmpresaExterna123';
const HTTP_BASE_URL = 'https://appserver.winxplay.io:3000';
const WS_BASE_URL = 'wss://appserver.winxplay.io:3000/external-signals';

const LISTEN_MS = 25_000;

/** @type {{ event: string, data: unknown }[]} */
const received = [];
let wsEverConnected = false;
/** @type {string | null} */
let connectErrorMsg = null;

function safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (e) {
    return `[non-serializable: ${e?.message || e}]`;
  }
}

async function testRest() {
  const url = `${HTTP_BASE_URL.replace(/\/$/, '')}/third-party/signals/receive`;
  console.log('\n--- REST GET ---');
  console.log('URL:', url);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'x-api-key': API_KEY },
    });
    const text = await res.text();
    let preview = text;
    if (preview.length > 2000) preview = `${preview.slice(0, 2000)}… (truncated)`;
    console.log(res.ok ? '✔ REST: OK' : '✖ REST: respuesta con error HTTP');
    console.log('   status:', res.status, res.statusText);
    console.log('   body preview:', preview || '(vacío)');
    return { ok: res.ok, status: res.status, preview };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log('✖ REST: fallo de red / TLS');
    console.log('   causa:', msg);
    let c = err instanceof Error ? err.cause : null;
    let depth = 0;
    while (c instanceof Error && depth < 5) {
      console.log(`   cause[${depth}]:`, c.message, c.code ? `(code=${c.code})` : '');
      c = c.cause;
      depth += 1;
    }
    return { ok: false, error: msg };
  }
}

function runWebSocketAndWait() {
  return new Promise((resolve) => {
    console.log('\n--- WebSocket (Socket.IO) ---');
    console.log('URL:', WS_BASE_URL);
    console.log('auth:', { apiKey: '***' });
    console.log(`Manteniendo sesión ~${LISTEN_MS / 1000}s…\n`);

    const socket = io(WS_BASE_URL, {
      transports: ['websocket'],
      auth: { apiKey: API_KEY },
      reconnection: false,
      timeout: 25_000,
    });

    socket.on('connect', () => {
      wsEverConnected = true;
      console.log('✔ WebSocket: connect (id=%s)', socket.id);
    });

    socket.on('connect_error', (err) => {
      connectErrorMsg = err?.message || String(err);
      console.log('✖ WebSocket: connect_error');
      console.log('   causa:', connectErrorMsg);
      if (err?.description) console.log('   description:', err.description);
      if (err?.context) console.log('   context:', safeStringify(err.context));
    });

    socket.on('disconnect', (reason) => {
      console.log('ℹ WebSocket: disconnect —', reason);
    });

    socket.onAny((event, ...args) => {
      const data = args.length <= 1 ? args[0] : args;
      received.push({ event, data });
      console.log('EVENT:', event);
      console.log('DATA:', safeStringify(data));
      console.log('---');
    });

    setTimeout(() => {
      const stillConnected = socket.connected;
      socket.removeAllListeners();
      socket.close();
      resolve({ stillConnected });
    }, LISTEN_MS);
  });
}

function printFinalSummary() {
  const types = [...new Set(received.map((r) => r.event))];
  const sample = received[0]
    ? { event: received[0].event, payload: received[0].data }
    : null;

  console.log('\n========== RESUMEN ==========');
  console.log('conectado (al menos una vez):', wsEverConnected);
  console.log('eventos recibidos:', received.length);
  console.log('tipos de eventos:', types.length ? types.join(', ') : '(ninguno)');

  if (connectErrorMsg && !wsEverConnected) {
    console.log('\n❌ error de conexión WebSocket');
    console.log('   Explicación típica: clave inválida (401), CORS/engine mal configurado,');
    console.log('   namespace o path incorrecto, firewall, o servidor caído.');
    console.log('   Detalle:', connectErrorMsg);
  } else if (wsEverConnected && received.length === 0) {
    console.log('\n❌ conectado pero sin eventos en la ventana de escucha');
  } else if (wsEverConnected && received.length > 0) {
    console.log('\n✔ conexión OK');
    console.log('✔ eventos recibidos:', received.length);
    console.log('✔ tipos:', types.join(', '));
    console.log('✔ ejemplo payload (primer evento):');
    console.log(safeStringify(sample));
  } else {
    console.log('\n⚠ Estado ambiguo: revisar logs anteriores.');
  }
  console.log('==============================\n');
}

async function main() {
  console.log('G-Pulse — test-signals-live (proveedor real, no localhost)');
  await testRest();
  await runWebSocketAndWait();
  printFinalSummary();
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exitCode = 1;
});
