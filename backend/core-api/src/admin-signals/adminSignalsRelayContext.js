/**
 * Contexto `{ io, processor, logger }` registrado al arrancar `attachAdminSignalsIo`.
 * Permite que rutas HTTP (p.ej. simulación dev) emitan al mismo pipeline que el proveedor.
 */

/** @type {null | { io: import('socket.io').Server, processor: object, logger: object }} */
let relayCtx = null;

/** @param {null | { io: import('socket.io').Server, processor: object, logger: object }} ctx */
export function setAdminSignalsRelayContext(ctx) {
  relayCtx = ctx;
}

export function getAdminSignalsRelayContext() {
  return relayCtx;
}
