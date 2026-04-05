import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { Logger } from 'pino';

export type GpulseWsBroadcast = (message: Record<string, unknown>) => void;

/**
 * WebSocket server on `path` (e.g. /ws), attached to the same HTTP server as Express.
 * New clients receive a snapshot from gpulse-api GET /execution/snapshot.
 */
export function attachGpulseWebSocket(
  server: Server,
  opts: { logger: Logger; path: string; gpulseApiUrl: string },
): { broadcast: GpulseWsBroadcast; getClientCount: () => number } {
  const clients = new Set<WebSocket>();
  const wss = new WebSocketServer({ server, path: opts.path });

  async function sendSnapshot(ws: WebSocket) {
    try {
      const base = opts.gpulseApiUrl.replace(/\/$/, '');
      const r = await fetch(`${base}/execution/snapshot`);
      if (!r.ok) {
        opts.logger.warn({ status: r.status }, 'ws snapshot fetch failed');
        return;
      }
      const body = (await r.json()) as Record<string, unknown>;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'gpulse:snapshot', payload: body }));
      }
    } catch (err) {
      opts.logger.warn({ err }, 'ws snapshot error');
    }
  }

  wss.on('connection', (ws) => {
    clients.add(ws);
    opts.logger.info({ clients: clients.size }, 'ws.client_connected');
    void sendSnapshot(ws);
    ws.on('close', () => {
      clients.delete(ws);
      opts.logger.info({ clients: clients.size }, 'ws.client_disconnected');
    });
    ws.on('error', (err) => opts.logger.warn({ err }, 'ws.client_error'));
  });

  function broadcast(message: Record<string, unknown>) {
    const raw = JSON.stringify(message);
    for (const c of clients) {
      if (c.readyState === WebSocket.OPEN) c.send(raw);
    }
  }

  return {
    broadcast,
    getClientCount: () => clients.size,
  };
}
