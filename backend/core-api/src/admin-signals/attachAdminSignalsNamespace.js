/**
 * Namespace /admin-signals — autenticación por API key (auth o header) o sesión admin.
 * Futuro (JWT): añadir rama `socket.handshake.auth?.token` + verificación RS256 sin sustituir la clave estática hasta migración.
 *
 * @param {import('socket.io').Server} io
 * @param {{ sessionMiddleware: import('express').RequestHandler, logger?: object }} ctx
 */
import { getLastClientResultForReplay, getLastClientSignalForReplay } from './relayAdminSignalsToClients.js';

const MIN_API_KEY_LEN = 16;

export function attachAdminSignalsNamespace(io, { sessionMiddleware, logger }) {
  const nsp = io.of('/admin-signals');

  nsp.use((socket, next) => {
    const validKey = String(process.env.GENESIS_ADMIN_API_KEY || '').trim();
    const keyConfigured = validKey.length >= MIN_API_KEY_LEN;

    const hdr = socket.handshake.headers;
    const headerKey = hdr['x-admin-api-key'];
    const apiKey = String(
      socket.handshake.auth?.apiKey ?? socket.handshake.auth?.adminApiKey ?? headerKey ?? '',
    ).trim();

    if (apiKey.length > 0) {
      if (!keyConfigured || apiKey !== validKey) {
        console.warn('❌ Unauthorized socket:', socket.id);
        return next(new Error('unauthorized'));
      }
      return next();
    }

    const finishSession = () => {
      try {
        if (socket.request.session?.address) return next();
        if (socket.request.session?.genesisAdmin === true) return next();
      } catch {
        /* ignore */
      }
      logger?.warn?.('admin_signals_socket_reject', { reason: 'no_session_or_admin_key' });
      return next(new Error('unauthorized'));
    };

    if (typeof sessionMiddleware === 'function') {
      sessionMiddleware(socket.request, {}, finishSession);
    } else {
      finishSession();
    }
  });

  nsp.on('connection', (socket) => {
    console.log('🟢 ADMIN CONNECTED:', socket.id);
    logger?.info?.('admin_signals_client_connected', { id: socket.id });
    socket.emit('ready', { ns: '/admin-signals' });

    try {
      console.log('REPLAY TO NEW CLIENT');
      const lastSignal = getLastClientSignalForReplay();
      const lastResult = getLastClientResultForReplay();

      if (lastSignal) {
        socket.emit('admin_signal_frame', {
          type: 'NEW_SIGNAL',
          payload: lastSignal,
          replay: true,
          ts: Date.now(),
        });
      }

      if (lastResult) {
        socket.emit('dashboardUpdate', {
          type: 'NEW_RESULT',
          payload: lastResult,
          replay: true,
          ts: Date.now(),
        });
      }
    } catch {
      /* ignore */
    }

    socket.on('disconnect', () => {
      logger?.info?.('admin_signals_client_disconnected', { id: socket.id });
    });
  });

  return nsp;
}
