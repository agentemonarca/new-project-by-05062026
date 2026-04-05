let ioRef = null;

export function setSocketHub(io) {
  ioRef = io;
}

export function getSocketHub() {
  return ioRef;
}

export function emitTxUpdate(payload) {
  ioRef?.emit('tx:update', { ...payload, t: Date.now() });
}

export function emitBalanceUpdate(payload) {
  ioRef?.emit('balance:update', { ...payload, t: Date.now() });
}

export function emitSystemHealth(payload) {
  ioRef?.emit('system:health', { ...payload, t: Date.now() });
}

/** @param {{ waiting: number, active: number, scaleSignal?: string }} payload */
export function emitQueueStats(payload) {
  const waiting = Math.max(0, Number(payload?.waiting) || 0);
  const active = Math.max(0, Number(payload?.active) || 0);
  const scaleSignal = String(payload?.scaleSignal || 'hold');
  ioRef?.emit('queue:stats', { waiting, active, scaleSignal });
}
