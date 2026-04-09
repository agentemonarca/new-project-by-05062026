import { ALERT_TYPES, pushAlert } from '../store/useAlertStore.js';

const THROTTLE_MS = 3000;
/** @type {Map<string, number>} */
const lastByMesa = new Map();

function safeLen(v) {
  return Array.isArray(v) ? v.length : 0;
}

function normStr(v) {
  return v == null ? '' : String(v).trim();
}

function hasWinner(v) {
  return normStr(v) !== '';
}

function flowTraceFromHistory(history, lifecycleState) {
  const h = Array.isArray(history) ? history : [];
  const parts = [];
  for (const e of h) {
    const t = e?.type != null ? String(e.type).trim().toUpperCase() : '';
    if (!t) continue;
    parts.push(t);
  }
  const uniq = parts.filter((x, i, a) => a.indexOf(x) === i);
  const trail = uniq.length > 0 ? uniq.join(' → ') : '—';
  return `${trail}${lifecycleState ? ` → ${String(lifecycleState)}` : ''}`;
}

/**
 * UI flow break / visual desync (forensic).
 * @param {{
 *  mesaId: string | null,
 *  mesaInfo: any, // supplierMesaInfoFull
 *  lifecycleState: string,
 *  ui: {
 *    playerCards: any[],
 *    bankerCards: any[],
 *    playerScore: any,
 *    bankerScore: any,
 *    winner: any,
 *    uiState: string,
 *    uiCards: boolean,
 *    uiScore: boolean,
 *    uiWinner: boolean,
 *    resultVisible: boolean,
 *  },
 *  cycleHistory?: any[],
 * }} args
 */
export function validateUIFlowBreak({ mesaId, mesaInfo, lifecycleState, ui, cycleHistory }) {
  const mesa = mesaId != null ? String(mesaId).trim() : '';
  if (!mesa) return;
  if (!mesaInfo || typeof mesaInfo !== 'object') return;

  const now = Date.now();
  const last = lastByMesa.get(mesa);
  if (last != null && now - last < THROTTLE_MS) return;

  const realPlayerCards = mesaInfo?.player_cards ?? [];
  const realBankerCards = mesaInfo?.banker_cards ?? [];
  const realHasCards = safeLen(realPlayerCards) > 0 || safeLen(realBankerCards) > 0;

  const realWinner = mesaInfo?.ganador ?? null;
  const realHasWinner = hasWinner(realWinner);

  const realPlayerScore = mesaInfo?.player_score ?? null;
  const realBankerScore = mesaInfo?.banker_score ?? null;
  const realHasScores =
    (realPlayerScore != null && normStr(realPlayerScore) !== '') || (realBankerScore != null && normStr(realBankerScore) !== '');

  const uiPlayerCards = ui?.playerCards ?? [];
  const uiBankerCards = ui?.bankerCards ?? [];
  const uiHasNoCards = safeLen(uiPlayerCards) === 0 && safeLen(uiBankerCards) === 0;

  const issues = [];

  // 1) UI_NO_RENDER_CARDS
  if (realHasCards && uiHasNoCards) issues.push('UI_NO_RENDER_CARDS');

  // 2) UI_NO_RENDER_WINNER
  if (realHasWinner && !hasWinner(ui?.winner)) issues.push('UI_NO_RENDER_WINNER');

  // 3) UI_STATE_STUCK
  if (String(lifecycleState) === 'RESULT_RECEIVED' && String(ui?.uiState) !== 'TABLE') issues.push('UI_STATE_STUCK');

  // 4) UI_FAKE_RENDER (UI shows data but provider doesn't)
  const uiShowsCards = safeLen(uiPlayerCards) > 0 || safeLen(uiBankerCards) > 0;
  const uiShowsWinner = hasWinner(ui?.winner);
  const uiShowsScores = ui?.playerScore != null || ui?.bankerScore != null;
  if ((uiShowsCards && !realHasCards) || (uiShowsWinner && !realHasWinner) || (uiShowsScores && !realHasScores)) {
    issues.push('UI_FAKE_RENDER');
  }

  if (issues.length === 0) return;
  lastByMesa.set(mesa, now);

  const debug = import.meta.env.VITE_GPULSE_LAB_DEBUG === '1';
  const trace_real_flow = flowTraceFromHistory(cycleHistory, lifecycleState);
  const round = mesaInfo?.ronda_actual ?? mesaInfo?.round ?? null;

  const realData = debug
    ? mesaInfo
    : {
        player_cards: realPlayerCards,
        banker_cards: realBankerCards,
        player_score: realPlayerScore,
        banker_score: realBankerScore,
        ganador: realWinner,
      };

  const uiData = debug
    ? ui
    : {
        playerCards: uiPlayerCards,
        bankerCards: uiBankerCards,
        playerScore: ui?.playerScore ?? null,
        bankerScore: ui?.bankerScore ?? null,
        winner: ui?.winner ?? null,
        uiState: ui?.uiState ?? null,
        uiCards: Boolean(ui?.uiCards),
        uiScore: Boolean(ui?.uiScore),
        uiWinner: Boolean(ui?.uiWinner),
      };

  pushAlert({
    type: ALERT_TYPES.UI_FLOW_BREAK,
    severity: 'error', // "critical" mapped to error in current alert system
    mesa,
    round,
    message: `UI_FLOW_BREAK / VISUAL_DESYNC · ${issues.join(', ')}`,
    rawPayload: {
      issues,
      mesaId: mesa,
      round,
      lifecycleState,
      trace_real_flow,
      realData,
      uiData,
      diff: issues.map((k) => ({ rule: k })),
      analysis: {
        que: 'El flujo visual (UI/UX) no refleja correctamente el estado real del sistema o del proveedor.',
        donde: { mesa, round, summary: `Mesa ${mesa} · Round ${round ?? '—'} · Lifecycle ${lifecycleState}` },
        porque: [
          { causa: 'Desync UI vs data', explicacion: 'Existe una discrepancia entre supplierMesaInfoFull, lifecycleState y el render visual.' },
        ],
        como: `FLUJO ESPERADO: WAITING_SIGNAL → BETTING → RESULT_RECEIVED → RENDER → COMPLETE\nFLUJO DETECTADO: ${trace_real_flow}`,
        data: {
          realData,
          uiData,
          diff: issues,
        },
        rutaTecnica: [
          'useLabSocket.js (NEW_RESULT)',
          'useSignalMiddleware.js (handleResult + mergeSupplierIntelResult)',
          'useLabStore.js (supplierMesaInfoFull)',
          'CenterPanel.jsx (table mapping + validators)',
          'BaccaratTableView.jsx (props + render)',
        ],
        dondeBuscar: [
          'apps/admin-core/src/gpulse-lab/hooks/useLabSocket.js',
          'apps/admin-core/src/gpulse-lab/middleware/useSignalMiddleware.js',
          'apps/admin-core/src/gpulse-lab/store/useLabStore.js',
          'apps/admin-core/src/gpulse-lab/components/CenterPanel.jsx',
          'apps/admin-core/src/gpulse-lab/components/BaccaratTableView.jsx',
        ],
        recomendacion: [
          'Verificar que el proveedor envió cartas/ganador (raw payload).',
          'Confirmar que supplierMesaInfoFull contiene esos datos (store).',
          'Confirmar que BaccaratTableView recibe props (log props).',
          'Revisar condiciones de render (showTable/status) y memoization/key.',
        ],
      },
    },
    context: {
      lifecycleState,
      issues,
      trace_real_flow,
    },
  });
}

