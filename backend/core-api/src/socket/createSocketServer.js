import { Server } from 'socket.io';

/**
 * @param {import('http').Server} httpServer
 * @param {{ logger?: object, corsOrigin?: string | string[] }} opts
 */
export function createSocketServer(httpServer, { logger, corsOrigin = '*' } = {}) {
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  // No `io.on('connection')` aquí: eso es el namespace por defecto `/` y confunde el debug
  // frente a `/admin-signals`. Los emits del hub (`socketHub.js`) siguen siendo `io.emit(...)`.

  return io;
}
