import { ALERT_TYPES, pushAlert } from '../store/useAlertStore.js';

const THROTTLE_MS = 3000;
/** @type {Map<string, number>} */
const lastByCorrelationKey = new Map();

function safeLen(v) {
  return Array.isArray(v) ? v.length : 0;
}

function getCorrelationKey(mesaId, mesaInfo) {
  const mesa = mesaId != null && String(mesaId).trim() !== '' ? String(mesaId).trim() : null;
  const round =
    mesaInfo?.ronda_actual != null && String(mesaInfo.ronda_actual).trim() !== ''
      ? String(mesaInfo.ronda_actual).trim()
      : mesaInfo?.round != null && String(mesaInfo.round).trim() !== ''
        ? String(mesaInfo.round).trim()
        : null;
  if (!mesa || !round) return null;
  return `${mesa}|${round}`;
}

/**
 * @param {{
 *  mesaId: string | null,
 *  mesaInfo: any,
 *  lifecycleState: string,
 *  renderedState: { cardsVisible: boolean, resultVisible: boolean, scoresVisible: boolean },
 * }} args
 */
export function validateUIUXState({ mesaId, mesaInfo, lifecycleState, renderedState }) {
  if (!mesaId) return;
  if (!mesaInfo || typeof mesaInfo !== 'object') return;

  const ck = getCorrelationKey(mesaId, mesaInfo) ?? `${String(mesaId)}|—`;
  const now = Date.now();
  const last = lastByCorrelationKey.get(ck);
  if (last != null && now - last < THROTTLE_MS) return;

  const hasCards = safeLen(mesaInfo.player_cards) > 0 || safeLen(mesaInfo.banker_cards) > 0;
  const hasScores = mesaInfo.player_score !== undefined || mesaInfo.banker_score !== undefined;
  const hasWinner = mesaInfo.ganador != null && String(mesaInfo.ganador).trim() !== '';

  const issues = [];
  if (hasCards && renderedState.cardsVisible === false) issues.push('cards_missing');
  if (hasWinner && renderedState.resultVisible === false) issues.push('winner_missing');
  if (hasScores && renderedState.scoresVisible === false) issues.push('scores_missing');
  if (lifecycleState === 'CYCLE_COMPLETE' && renderedState.resultVisible === false) issues.push('lifecycle_mismatch');

  if (issues.length === 0) return;
  lastByCorrelationKey.set(ck, now);

  const debug = import.meta.env.VITE_GPULSE_LAB_DEBUG === '1';
  const mesaInfoSnapshot = debug ? mesaInfo : { hasCards, hasScores, hasWinner };

  pushAlert({
    type: ALERT_TYPES.UI_UX_INCONSISTENCY,
    severity: 'warning',
    mesa: mesaId,
    round: mesaInfo?.ronda_actual ?? mesaInfo?.round ?? null,
    message: 'UI not reflecting supplier data correctly',
    rawPayload: {
      issues,
      analysis: {
        que: 'UI no refleja datos reales del proveedor',
        porQue: 'Desalineación entre estado visual y datos',
        donde: 'BaccaratTableView / CycleIntelCommandPanel',
        como: 'Datos presentes pero no renderizados',
        recomendacion: 'Verificar mapping de supplierMesaInfoFull y condiciones de renderizado',
      },
      mesaInfoSnapshot,
      renderedState,
      lifecycleState,
      correlationKey: ck,
    },
    context: {
      correlationKey: ck,
      lifecycleState,
      mesaInfoSnapshot,
      renderedState,
    },
  });
}

