import { ALERT_TYPES, pushAlert } from '../store/useAlertStore.js';
import { extractNestedMesaInfo } from './supplierIntelExtract.js';

const THROTTLE_MS = 3000;
/** @type {Map<string, number>} */
const lastByMesa = new Map();

function safeLen(v) {
  return Array.isArray(v) ? v.length : 0;
}

function norm(v) {
  return v == null ? '' : String(v).trim();
}

function has(v) {
  return norm(v) !== '';
}

function isValidScore(v) {
  if (v == null) return false;
  const s = norm(v);
  if (s === '') return false;
  // Allow "0" as valid
  return true;
}

function diagnose({ rawMesaInfo, storeMesaInfo, uiData, lifecycleState, missing }) {
  const rawHasMesaInfo = rawMesaInfo != null && typeof rawMesaInfo === 'object';
  const storeHasMesaInfo = storeMesaInfo != null && typeof storeMesaInfo === 'object';

  if (!rawHasMesaInfo) return 'FORMAT_INVALID';
  if (rawHasMesaInfo && !storeHasMesaInfo) return 'STORE_NOT_UPDATED';

  // If raw has fields but store mapping missed them.
  const rawHasCards = safeLen(rawMesaInfo?.cartas_player) > 0 || safeLen(rawMesaInfo?.cartas_banker) > 0;
  const storeHasCards = safeLen(storeMesaInfo?.player_cards) > 0 || safeLen(storeMesaInfo?.banker_cards) > 0;
  if (rawHasCards && !storeHasCards) return 'DATA_NOT_MAPPED';

  // If store has them but UI doesn't show them.
  const uiHasCards = safeLen(uiData?.playerCards) > 0 || safeLen(uiData?.bankerCards) > 0;
  const uiHasWinner = has(uiData?.winner);
  const uiHasScores = uiData?.playerScore != null || uiData?.bankerScore != null;
  if ((storeHasCards && !uiHasCards) || (has(storeMesaInfo?.ganador) && !uiHasWinner) || (storeMesaInfo?.player_score != null && !uiHasScores)) {
    if (String(lifecycleState) === 'RESULT_RECEIVED' || String(lifecycleState) === 'CYCLE_COMPLETE') return 'RENDER_BLOCKED';
    return 'UI_NOT_SUBSCRIBED';
  }

  return missing.includes('winner_missing') || missing.includes('cards_missing') || missing.includes('scores_missing')
    ? 'RENDER_BLOCKED'
    : 'STORE_NOT_UPDATED';
}

/**
 * Provider Truth Monitor: payload.data.data.results.mesa_info is the single source of truth.
 *
 * Triggers CRITICAL when provider mesa_info exists but UI doesn't render required contract:
 * cards (player/banker) + scores + winner.
 *
 * @param {{
 *   mesaId: string | null,
 *   supplierLastRawResult: any,
 *   supplierMesaInfoFull: any,
 *   uiData: { playerCards: any[], bankerCards: any[], winner: any, playerScore: any, bankerScore: any },
 *   lifecycleState: string,
 * }} args
 */
export function monitorProviderTruth({ mesaId, supplierLastRawResult, supplierMesaInfoFull, uiData, lifecycleState }) {
  const mesa = mesaId != null ? String(mesaId).trim() : '';
  if (!mesa) return;

  const now = Date.now();
  const last = lastByMesa.get(mesa);
  if (last != null && now - last < THROTTLE_MS) return;

  const rawMesaInfo = extractNestedMesaInfo(supplierLastRawResult);
  if (!rawMesaInfo) return; // if provider truth not present, nothing to assert

  // Provider mandatory truth (as described)
  const cartas_player = rawMesaInfo.cartas_player ?? [];
  const cartas_banker = rawMesaInfo.cartas_banker ?? [];
  const puntaje_player = rawMesaInfo.puntaje_player ?? null;
  const puntaje_banker = rawMesaInfo.puntaje_banker ?? null;
  const ganador = rawMesaInfo.ganador ?? null;
  const round = rawMesaInfo.Ronda ?? rawMesaInfo.ronda_actual ?? rawMesaInfo.round ?? null;

  const providerHasCards = safeLen(cartas_player) > 0 && safeLen(cartas_banker) > 0;
  const providerHasScores = isValidScore(puntaje_player) && isValidScore(puntaje_banker);
  const providerHasWinner = has(ganador);

  // Only enforce contract once provider delivered the full truth.
  if (!providerHasCards && !providerHasScores && !providerHasWinner) return;

  const uiPlayerCards = uiData?.playerCards ?? [];
  const uiBankerCards = uiData?.bankerCards ?? [];
  const uiWinner = uiData?.winner ?? null;
  const uiPlayerScore = uiData?.playerScore ?? null;
  const uiBankerScore = uiData?.bankerScore ?? null;

  const missing = [];
  if (providerHasCards && safeLen(uiPlayerCards) === 0 && safeLen(uiBankerCards) === 0) missing.push('cards_missing');
  if (providerHasScores && (uiPlayerScore == null || uiBankerScore == null)) missing.push('scores_missing');
  if (providerHasWinner && !has(uiWinner)) missing.push('winner_missing');

  if (missing.length === 0) return;

  lastByMesa.set(mesa, now);

  const debug = import.meta.env.VITE_GPULSE_LAB_DEBUG === '1';
  const storeMi = supplierMesaInfoFull;
  const diagnostic = diagnose({ rawMesaInfo, storeMesaInfo: storeMi, uiData, lifecycleState, missing });

  const realData = debug
    ? rawMesaInfo
    : {
        cartas_player,
        cartas_banker,
        puntaje_player,
        puntaje_banker,
        ganador,
        data_evento: rawMesaInfo.data_evento ?? null,
      };

  const uiSnap = debug
    ? { ...uiData, mesaId: mesa }
    : { uiPlayerCards, uiBankerCards, uiWinner, uiPlayerScore, uiBankerScore };

  pushAlert({
    type: ALERT_TYPES.PROVIDER_DATA_NOT_RENDERED,
    severity: 'error', // CRITICAL mapped to error (store supports info|warning|error)
    mesa,
    round,
    message: `PROVIDER_DATA_NOT_RENDERED · missing: ${missing.join(', ')}`,
    rawPayload: {
      severityLabel: 'critical',
      mesa,
      round,
      lifecycleState,
      missing,
      diagnostic,
      realData,
      uiData: uiSnap,
      diff: missing.map((k) => ({ rule: k })),
      analysis: {
        que: 'El proveedor envió datos reales de la partida, pero la UI no los está mostrando.',
        donde: { mesa, round, summary: 'BaccaratTableView.jsx / mapping de supplierMesaInfoFull' },
        como: 'socket → middleware → store → UI render',
        porque: [
          { causa: 'Adapter incorrecto', explicacion: 'Mapper de mesa_info → supplierMesaInfoFull no refleja cartas/puntajes/ganador.' },
          { causa: 'Store no actualizado', explicacion: 'mergeSupplierIntelResult no persiste mesa_info o se pisa/reset antes de render.' },
          { causa: 'UI no suscrita', explicacion: 'Selector equivocado o memoización bloquea re-render.' },
          { causa: 'Render condicionado', explicacion: 'Lifecycle gating (showTable/status) impide pintar resultado.' },
          { causa: 'Formato inválido', explicacion: 'cartas/puntajes vienen en formato inesperado y el adapter los descarta.' },
        ],
        data: {
          proveedor: realData,
          ui: uiSnap,
          diff: missing,
          diagnostic,
        },
        dondeBuscar: [
          'apps/admin-core/src/gpulse-lab/components/BaccaratTableView.jsx',
          'apps/admin-core/src/gpulse-lab/utils/supplierIntelExtract.js',
          'apps/admin-core/src/gpulse-lab/store/useLabStore.js (mergeSupplierIntelResult)',
          'apps/admin-core/src/gpulse-lab/components/CenterPanel.jsx (mapping + showTable)',
        ],
        recomendacion: [
          'console.log("PROVIDER", mesa_info) usando supplierLastRawResult + extractNestedMesaInfo',
          'console.log("STORE", supplierMesaInfoFull)',
          'console.log("UI", playerCards, bankerCards, winner, scores)',
          'Revisar mapping de cartas: player_cards/banker_cards vs cartas_player/cartas_banker',
          'Revisar gating: RESULT_RECEIVED/CYCLE_COMPLETE deben renderizar mesa_info completo',
        ],
      },
    },
    context: {
      lifecycleState,
      diagnostic,
      missing,
    },
  });
}

