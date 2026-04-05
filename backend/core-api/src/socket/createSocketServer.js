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
    },
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  io.on('connection', (socket) => {
    logger?.info?.('socket_connected', { id: socket.id });
    socket.on('disconnect', () => {
      logger?.info?.('socket_disconnected', { id: socket.id });
    });
  });

  return io;
}
