import { getLastClientResultForTest, resolveTestEmitIntervalMs } from './relayAdminSignalsToClients.js';
import { relayNormalizedAdminSignals } from './normalizeSignal.js';

/**
 * GPULSE demo/emulator bridge.
 *
 * Strict rules:
 * - Do NOT invent new formats: we emit exactly through relayAdminSignalsToClients (same pipeline).
 * - Do NOT duplicate matcher/validator/formatter: those are downstream (admin-core) and already reused via relay.
 */

/**
 * @param {{ io: import('socket.io').Server, processor: object, logger: object }} relayCtx
 * @param {unknown} signalPayload
 */
export function emitDemoSignal(relayCtx, signalPayload) {
  return relayNormalizedAdminSignals(relayCtx, 'NEW_SIGNAL', signalPayload, { source: 'gpulse_demo' });
}

/**
 * @param {{ io: import('socket.io').Server, processor: object, logger: object }} relayCtx
 * @param {unknown} resultPayload
 */
export function emitDemoResult(relayCtx, resultPayload) {
  return relayNormalizedAdminSignals(relayCtx, 'NEW_RESULT', resultPayload, { source: 'gpulse_demo' });
}

/**
 * Start demo emitter (provider-like nested payload + normalized relay) using the existing test-emitter generator.
 *
 * This intentionally reuses the same payload shapes already supported by:
 * - backend transform + relayAdminSignalsToClients
 * - admin-core adminSignalsLiveStore (dashboardUpdate + NEW_SIGNAL/NEW_RESULT)
 *
 * @param {{
 *   io: import('socket.io').Server,
 *   processor: any,
 *   logger: any,
 * }} relayCtx
 * @returns {{ stop: () => void, isRunning: () => boolean }}
 */
export function startGpulseDemoMode(relayCtx) {
  const traceOn = String(process.env.ADMIN_SIGNALS_TRACE ?? '').trim() === '1';

  const testIntervalMs = resolveTestEmitIntervalMs(Boolean(process.env.EXTERNAL_SIGNALS_API_KEY));
  const testJitterMs = Math.max(0, Number(process.env.ADMIN_SIGNALS_TEST_EMIT_JITTER_MS || 0));
  const testResultDelayMs = Math.max(0, Number(process.env.ADMIN_SIGNALS_TEST_RESULT_DELAY_MS || 650));

  /** @type {ReturnType<typeof setInterval> | null} */
  let interval = null;
  let testRoundSeq = 50;

  if (testIntervalMs > 0) {
    console.log('[GPULSE_DEMO] demo mode ON · interval', testIntervalMs, 'ms');
    interval = setInterval(() => {
      const last = getLastClientResultForTest();
      const lastMesa = last?.mesa != null && String(last.mesa).trim() !== '' ? String(last.mesa).trim() : null;
      const lastRoundRaw = last?.round != null ? Number(last.round) : NaN;
      const lastRoundOk = Number.isFinite(lastRoundRaw) && lastRoundRaw > 0 && lastRoundRaw <= 1_000_000_000;

      const mesa = lastMesa ?? 'Baccarat 5';
      const round = lastRoundOk ? Math.trunc(lastRoundRaw) + 1 : (testRoundSeq += 1);
      const pairId = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const signalPayload = {
        id: pairId,
        data: {
          signal: {
            nombre_mesa: mesa,
            ronda_actual: round,
            vector_forecast: ['B', 'P', 'B', 'B', 'P', 'B'],
            nombre_algoritmo: 'SIMETRIA_DEMO',
          },
        },
      };

      if (traceOn) console.log('[GPULSE_DEMO] NEW_SIGNAL', { mesa, round, pairId });
      emitDemoSignal(relayCtx, signalPayload);

      const winner = Math.random() > 0.5 ? 'PLAYER' : 'BANKER';
      const scoreDetail =
        winner === 'PLAYER'
          ? { ganador: 'PLAYER', puntaje_player: '8', puntaje_banker: '6', cartas_player: ['K', '8'], cartas_banker: ['Q', '6'] }
          : { ganador: 'BANKER', puntaje_player: '5', puntaje_banker: '7', cartas_player: ['9', '6'], cartas_banker: ['K', '7'] };

      setTimeout(() => {
        const resultPayload = {
          mesa,
          round,
          signalId: pairId,
          winStatus: winner === 'PLAYER',
          scoreDetail,
          correlationKey: `${mesa}|${round}`,
        };
        if (traceOn) console.log('[GPULSE_DEMO] NEW_RESULT', { mesa, round, winner });
        emitDemoResult(relayCtx, resultPayload);
      }, testResultDelayMs);
    }, testIntervalMs + (testJitterMs > 0 ? Math.floor(Math.random() * (testJitterMs + 1)) : 0));
    interval.unref?.();
  }

  return {
    stop() {
      if (interval) clearInterval(interval);
      interval = null;
    },
    isRunning() {
      return interval != null;
    },
  };
}

