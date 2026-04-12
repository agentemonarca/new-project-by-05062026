import { Manager } from 'socket.io-client';
import { redirectToAdminLogin } from '../lib/adminAuthRedirect.js';
import { getAdminSignalsIoOrigin } from './resolveAdminSignalsIoOrigin.js';
import { isResultFullTraceClient } from '../gpulse-lab/utils/resultFullTraceClient.js';

/** @type {import('socket.io-client').Manager | null} */
let _manager = null;
/** @type {import('socket.io-client').Socket | null} */
let _socket = null;
/** Evita registrar `onAny` de traza completa varias veces. */
let _fullResultTraceAttached = false;

const ADMIN_NAMESPACE = '/admin-signals';
const DISABLE_AUTH = import.meta.env.VITE_ADMIN_SIGNALS_DISABLE_AUTH === '1';

function attachSocketHandlers(socket) {
  socket.on('connect', () => {
    console.log('🟢 FRONT CONECTADO:', socket.id, 'NSP:', socket.nsp);
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 DISCONNECTED:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('❌ SOCKET ERROR:', err.message);
    const m = String(err?.message || '');
    if (m === 'unauthorized') {
      console.warn('🔐 sesión inválida');
      redirectToAdminLogin();
    }
  });

  if (isResultFullTraceClient()) {
    socket.onAny((event, ...args) => {
      const payload = args.length <= 1 ? args[0] : args;
      console.log('📡 SOCKET EVENT:', event, payload);
    });
  }

  if (import.meta.env.DEV || import.meta.env.VITE_ADMIN_SIGNALS_DEBUG === '1') {
    socket.onAny((event, ...args) => {
      const data = args.length <= 1 ? args[0] : args;
      console.log('🔥 EVENT:', event, data);
    });
  }
}

function createAdminSignalsSocket() {
  // Namespace must match backend: io.of('/admin-signals')
  const origin = getAdminSignalsIoOrigin();
  const apiKeyRaw = import.meta.env.VITE_GENESIS_ADMIN_API_KEY;

  // In dev, persist singletons across Vite HMR reloads (prevents connect/disconnect flapping).
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const w = /** @type {any} */ (window);
    if (w.__adminSignalsManager) _manager = w.__adminSignalsManager;
    if (w.__adminSignalsSocket) _socket = w.__adminSignalsSocket;
  }

  if (!_manager) {
    _manager = new Manager(origin, {
      path: '/socket.io',
      transports: ['websocket'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
      timeout: 20_000,
    });
  }

  if (!_socket) {
    _socket = _manager.socket(ADMIN_NAMESPACE, {
      auth: DISABLE_AUTH
        ? undefined
        : {
            apiKey: typeof apiKeyRaw === 'string' && apiKeyRaw.trim() !== '' ? apiKeyRaw.trim() : undefined,
          },
    });
    attachSocketHandlers(_socket);
  }

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const w = /** @type {any} */ (window);
    w.__adminSignalsManager = _manager;
    w.__adminSignalsSocket = _socket;
  }

  if (import.meta.env.VITE_FULL_RESULT_TRACE === '1' && !_fullResultTraceAttached) {
    _fullResultTraceAttached = true;
    _socket.onAny((event, ...args) => {
      const payload = args.length <= 1 ? args[0] : args;
      console.log('📡 SOCKET EVENT:', event, payload);
    });
  }

  if (!_socket.connected) {
    _socket.connect();
  }

  if (import.meta.env.DEV) {
    console.log(
      '[admin-signals] origin:',
      origin,
      '| namespace:',
      ADMIN_NAMESPACE,
      '| auth:',
      DISABLE_AUTH ? 'disabled' : 'enabled',
      '| connecting…',
    );
  }

  return _socket;
}

/** Singleton: un Manager y un Socket para `/admin-signals`. */
export default function getAdminSignalsSocket() {
  if (!_socket) {
    createAdminSignalsSocket();
  }
  return /** @type {import('socket.io-client').Socket} */ (_socket);
}
