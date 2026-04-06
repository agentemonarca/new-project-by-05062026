import { EventEmitter } from 'node:events';

/** Bus interno para observabilidad (logs, webhooks, workers). Sin mocks. */
const bus = new EventEmitter();
bus.setMaxListeners(50);

/**
 * @param {'reward_created' | 'reward_claimed'} eventName
 * @param {Record<string, unknown>} payload
 */
export function emitGenesisPlatformEvent(eventName, payload) {
  try {
    bus.emit(eventName, payload);
    bus.emit('genesis_platform', { name: eventName, payload, ts: Date.now() });
  } catch {
    /* no lanzar si un listener falla */
  }
}

/**
 * @param {(ev: { name: string, payload: Record<string, unknown>, ts: number }) => void} fn
 * @returns {() => void} unsubscribe
 */
export function onGenesisPlatformEvent(fn) {
  bus.on('genesis_platform', fn);
  return () => bus.off('genesis_platform', fn);
}
