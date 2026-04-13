/**
 * Pure copy for IA Real provider shell — single line for systemNarrative (NeuralReveal box).
 * No side effects; safe for tests.
 */

import {
  extractMesaInfoFromResultRaw,
  extractVectorForecastFromActiveRow,
  resolveContadorMartingalaForUi,
} from './iaRealEngineUi.js';
import { formatPredictionSideLabel, predictionSideFromVectorAndContador } from './providerMartingaleRead.js';

/** @typedef {{ wins?: number, losses?: number, rewardsNet?: number }} SessionSnapshot */

/**
 * @param {{ status?: string, reconnectAttempt?: number, lastError?: string | null }} [connectionMeta]
 */
function relayLine(connectionMeta) {
  if (!connectionMeta || typeof connectionMeta !== 'object') return '';
  const s = String(connectionMeta.status || '');
  if (s === 'error') return 'Relay sin enlace estable · revisa red o credenciales.';
  if (s === 'reconnecting') {
    const n = Number(connectionMeta.reconnectAttempt);
    return `Relay reconectando${Number.isFinite(n) && n > 0 ? ` · intento ${n}` : ''}…`;
  }
  if (s === 'connecting') return 'Relay conectando al stream de señales…';
  return '';
}

/**
 * @param {{
 *   status?: string,
 *   activeRow?: object | null,
 *   outcomeRow?: object | null,
 *   visualStepIndex?: number,
 *   phaseVisual?: string | null,
 *   connectionMeta?: { status?: string, reconnectAttempt?: number, lastError?: string | null },
 *   sessionSnapshot?: SessionSnapshot,
 * }} input
 * @returns {string}
 */
export function buildIaRealNarrativeLine(input) {
  const status = String(input?.status ?? 'IDLE');
  const activeRow = input?.activeRow && typeof input.activeRow === 'object' ? input.activeRow : null;
  const outcomeRow = input?.outcomeRow && typeof input.outcomeRow === 'object' ? input.outcomeRow : null;
  const vIdx = Number(input?.visualStepIndex) || 0;
  const phaseVisual = input?.phaseVisual != null ? String(input.phaseVisual) : '';
  const conn = input?.connectionMeta;
  const snap = input?.sessionSnapshot && typeof input.sessionSnapshot === 'object' ? input.sessionSnapshot : {};
  const rewardsNet = Number(snap.rewardsNet ?? 0);
  const wins = Number(snap.wins ?? 0);
  const losses = Number(snap.losses ?? 0);

  const relay = relayLine(conn);
  if (status === 'IDLE') {
    if (relay) return relay;
    return 'Sistema listo · esperando la siguiente señal del proveedor en vivo.';
  }

  if (status === 'SYNC' && activeRow) {
    const mesa = String(activeRow.mesa ?? '—');
    const ronda = activeRow.round != null && activeRow.round !== '' ? String(activeRow.round) : '—';
    const vf = extractVectorForecastFromActiveRow(activeRow);
    const cm = resolveContadorMartingalaForUi(activeRow);
    const pred = predictionSideFromVectorAndContador(vf, cm);
    const label = formatPredictionSideLabel(pred);
    return `Sincronización pendiente · mesa ${mesa}, ronda ${ronda} · apuesta prevista ${label} · completa sync para continuar.`;
  }

  if (status === 'WAITING_RESULT' && activeRow) {
    const mesa = String(activeRow.mesa ?? '—');
    const ronda = activeRow.round != null && activeRow.round !== '' ? String(activeRow.round) : '—';
    const vf = extractVectorForecastFromActiveRow(activeRow);
    const vfLen = vf.length;
    const stepNum = vfLen > 0 ? Math.min(vfLen, vIdx + 1) : vIdx + 1;
    const cm = resolveContadorMartingalaForUi(activeRow);
    const pred = predictionSideFromVectorAndContador(vf, cm);
    const label = formatPredictionSideLabel(pred);
    const prefix = relay ? `${relay} ` : '';
    return `${prefix}Señal en mesa ${mesa}, ronda ${ronda} · paso T${stepNum}${vfLen > 0 ? `/${vfLen}` : ''} · jugando ${label} · esperando resultado del proveedor.`;
  }

  if ((status === 'RESULT' || status === 'RESULT_SEQUENCE') && outcomeRow) {
    const meta = extractMesaInfoFromResultRaw(outcomeRow.rawResult);
    const gan = meta.ganador ? String(meta.ganador) : '—';
    return `Resultado en secuencia · fase ${phaseVisual || '—'} · ganador mesa: ${gan}.`;
  }

  if (status === 'RESULT_ANIMATION' && outcomeRow) {
    return 'Resultado entrando · validando vector y mesa contra la jugada…';
  }

  if ((status === 'SUCCESS' || status === 'FAILED') && outcomeRow) {
    const meta = extractMesaInfoFromResultRaw(outcomeRow.rawResult);
    const gan = meta.ganador ? String(meta.ganador) : '—';
    const hit = outcomeRow.winStatus === true;
    const netStr = `${rewardsNet >= 0 ? '+' : ''}${rewardsNet.toFixed(2)}`;
    const sessionBit = `Sesión · aciertos ${wins}, fallos ${losses} · variación neta ${netStr} USDT.`;
    if (hit) {
      return `Señal acertada · ganador mesa: ${gan}. ${sessionBit}`;
    }
    return `Señal cerrada sin acierto · ganador mesa: ${gan}. ${sessionBit}`;
  }

  return 'Operación en curso · monitoreo activo.';
}
