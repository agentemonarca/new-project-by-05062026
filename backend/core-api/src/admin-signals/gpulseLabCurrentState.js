import { getLastClientResultForReplay, getLastClientSignalForReplay } from './relayAdminSignalsToClients.js';

/**
 * Snapshot for GPulse Lab HTTP bootstrap (`GET .../current-state`).
 * @param {{ getPendingSignals?: () => object[] }} processor
 */
export function buildGpulseLabCurrentStateResponse(processor) {
  const pending =
    processor && typeof processor.getPendingSignals === 'function' ? processor.getPendingSignals() : [];
  const lastSig = getLastClientSignalForReplay();
  const lastRes = getLastClientResultForReplay();

  if (pending.length > 0) {
    const p0 = pending[0];
    const mesa = p0.mesa != null ? String(p0.mesa) : null;
    const round = p0.round != null ? String(p0.round) : null;
    let currentSignal = lastSig;
    if (
      !currentSignal ||
      (mesa != null && String(/** @type {any} */ (currentSignal).mesa ?? '') !== String(mesa))
    ) {
      currentSignal = {
        mesa: p0.mesa,
        round: p0.round,
        recommendation: p0.recommendation,
        martingale: p0.martingale ?? 0,
        correlationKey: p0.correlationKey,
        signalId: p0.providerSignalId ?? p0.id,
      };
    }
    return {
      ok: true,
      mesa,
      round,
      currentSignal,
      currentResult: null,
    };
  }

  const currentResult = lastRes;
  const mesa = currentResult?.mesa != null ? String(currentResult.mesa) : null;
  const round = currentResult?.round != null ? String(currentResult.round) : null;
  return {
    ok: true,
    mesa,
    round,
    currentSignal: null,
    currentResult,
  };
}
