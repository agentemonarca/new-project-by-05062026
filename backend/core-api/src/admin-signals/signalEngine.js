import { relayAdminSignalsToClients } from './relayAdminSignalsToClients.js';

/**
 * Interception layer for the admin-signals pipeline (pass-through until extended).
 * Fail-safe: logging errors never block relay; relay errors propagate as before.
 */
export function createSignalEngine() {
  return {
    /**
     * @param {'NEW_SIGNAL' | 'NEW_RESULT'} type
     * @param {unknown} payload
     * @param {{ io: import('socket.io').Server, processor: object, logger: object }} ctx
     */
    onProviderEvent(type, payload, ctx) {
      try {
        console.log('[ENGINE] EVENTO →', type);
      } catch {
        /* ignore — never block pipeline on logging */
      }
      relayAdminSignalsToClients(ctx, type, payload, { source: 'engine_pass' });
      try {
        console.log('[FLOW] AFTER RELAY →', type);
      } catch {
        /* ignore */
      }
    },
  };
}
