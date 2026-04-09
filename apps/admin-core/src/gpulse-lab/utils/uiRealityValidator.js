import { ALERT_TYPES, pushAlert } from '../store/useAlertStore.js';

const THROTTLE_MS = 3000;
/** @type {Map<string, number>} */
const lastByMesa = new Map();

function safeLen(v) {
  return Array.isArray(v) ? v.length : 0;
}

function asKey(mesaId) {
  const m = mesaId != null ? String(mesaId).trim() : '';
  return m || null;
}

function winnerIsSet(v) {
  return v != null && String(v).trim() !== '';
}

function computeDiff(storeData, uiData, lifecycleState) {
  const d = [];

  const storeWinner = storeData?.ganador ?? null;
  const storePlayerScore = storeData?.player_score ?? null;
  const storePlayerCards = storeData?.player_cards ?? [];
  const storeBankerCards = storeData?.banker_cards ?? [];

  // CASE 1 — Winner mismatch: UI shows winner but store doesn't have one.
  if (winnerIsSet(uiData?.winner) && !winnerIsSet(storeWinner)) {
    d.push({
      kind: 'WINNER_UI_WITHOUT_REAL',
      ui: { winner: uiData?.winner ?? null },
      real: { ganador: storeWinner },
    });
  }

  // CASE 2 — Score mismatch: UI shows a score but real data absent.
  if (uiData?.playerScore !== null && uiData?.playerScore !== undefined && storePlayerScore == null) {
    d.push({
      kind: 'SCORE_UI_WITHOUT_REAL',
      ui: { playerScore: uiData?.playerScore ?? null },
      real: { player_score: storePlayerScore },
    });
  }

  // CASE 3 — Cards mismatch: UI shows cards but real data empty.
  if (safeLen(uiData?.playerCards) > 0 && safeLen(storePlayerCards) === 0) {
    d.push({
      kind: 'CARDS_UI_WITHOUT_REAL',
      ui: { playerCards: uiData?.playerCards ?? [] },
      real: { player_cards: storePlayerCards },
    });
  }

  // UI-specific forensic: real cards exist but UI renders none.
  const realHasCards = safeLen(storePlayerCards) > 0 || safeLen(storeBankerCards) > 0;
  const uiHasNoCards = safeLen(uiData?.playerCards) === 0 && safeLen(uiData?.bankerCards) === 0;
  if (realHasCards && uiHasNoCards) {
    d.push({
      kind: 'CARDS_REAL_NOT_RENDERED',
      ui: { playerCards: uiData?.playerCards ?? [], bankerCards: uiData?.bankerCards ?? [] },
      real: { player_cards: storePlayerCards, banker_cards: storeBankerCards },
    });
  }

  // CASE 4 — Placeholder misuse: UI shows 0 when real score missing.
  if (uiData?.playerScore === 0 && storePlayerScore == null) {
    d.push({
      kind: 'PLACEHOLDER_ZERO_SCORE',
      ui: { playerScore: uiData?.playerScore ?? null },
      real: { player_score: storePlayerScore },
    });
  }

  // CASE 5 — Lifecycle mismatch: waiting for signal but UI shows a result.
  if (String(lifecycleState) === 'WAITING_SIGNAL' && uiData?.resultVisible === true) {
    d.push({
      kind: 'LIFECYCLE_WAITING_BUT_RESULT_VISIBLE',
      ui: { resultVisible: true },
      real: { lifecycleState },
    });
  }

  return d;
}

/**
 * @param {{
 *   mesaId: string | null,
 *   storeData: any,
 *   uiData: any,
 *   lifecycleState: string,
 * }} args
 */
export function validateUIReality({ mesaId, storeData, uiData, lifecycleState }) {
  const k = asKey(mesaId);
  if (!k) return;
  if (!storeData || typeof storeData !== 'object') return;

  const now = Date.now();
  const last = lastByMesa.get(k);
  if (last != null && now - last < THROTTLE_MS) return;

  const diff = computeDiff(storeData, uiData, lifecycleState);
  if (diff.length === 0) return;
  lastByMesa.set(k, now);

  const debug = import.meta.env.VITE_GPULSE_LAB_DEBUG === '1';
  const hasCardsMismatch = diff.some((x) => x && x.kind === 'CARDS_REAL_NOT_RENDERED');
  const realData = debug
    ? storeData
    : hasCardsMismatch
      ? {
          ganador: storeData?.ganador ?? null,
          player_score: storeData?.player_score ?? null,
          player_cards: storeData?.player_cards ?? [],
          banker_cards: storeData?.banker_cards ?? [],
        }
      : { ganador: storeData?.ganador ?? null, player_score: storeData?.player_score ?? null };
  const uiDataSnap = debug
    ? uiData
    : hasCardsMismatch
      ? {
          playerCards: uiData?.playerCards ?? [],
          bankerCards: uiData?.bankerCards ?? [],
          resultVisible: uiData?.resultVisible ?? null,
        }
      : { winner: uiData?.winner ?? null, playerScore: uiData?.playerScore ?? null, resultVisible: uiData?.resultVisible ?? null };

  pushAlert({
    type: ALERT_TYPES.UI_REALITY_MISMATCH,
    severity: 'warning',
    mesa: k,
    round: storeData?.ronda_actual ?? storeData?.round ?? null,
    message: hasCardsMismatch ? 'Cartas existen en proveedor pero UI no las renderiza' : 'UI muestra valores que no existen en la data real',
    rawPayload: {
      realData,
      uiData: uiDataSnap,
      diff,
      debug,
      lifecycleState,
      analysis: {
        que: hasCardsMismatch ? 'cartas no renderizadas' : 'UI Reality Mismatch',
        porQue: hasCardsMismatch
          ? 'mapping / lifecycle / selector'
          : 'La UI está renderizando fallback/stale values que no existen en el store del proveedor',
        donde: hasCardsMismatch ? 'BaccaratTableView.jsx' : 'BaccaratTableView / CycleIntelCommandPanel',
        como: hasCardsMismatch ? 'flujo socket → middleware → store → UI' : 'Comparación directa UI vs supplierMesaInfoFull',
        recomendacion: hasCardsMismatch
          ? 'Verificar mapping de player_cards/banker_cards → props; validar showTable y mesa seleccionada; confirmar resetMesaVisualState al entrar WAITING_SIGNAL'
          : 'Revisar mapeos de props y placeholders; validar resetMesaVisualState al entrar WAITING_SIGNAL',
      },
    },
    context: {
      lifecycleState,
      diff,
    },
  });
}

