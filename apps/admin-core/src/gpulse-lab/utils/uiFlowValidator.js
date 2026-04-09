import { ALERT_TYPES, pushAlert } from '../store/useAlertStore.js';

export const UI_FLOW_STATES = {
  UI_IDLE: 'UI_IDLE',
  UI_ANALYZING: 'UI_ANALYZING',
  UI_SIGNAL_VISIBLE: 'UI_SIGNAL_VISIBLE',
  UI_BETTING_OPEN: 'UI_BETTING_OPEN',
  UI_WAITING_RESULT: 'UI_WAITING_RESULT',
  UI_DEALING_ANIMATION: 'UI_DEALING_ANIMATION',
  UI_RESULT_DISPLAY: 'UI_RESULT_DISPLAY',
  UI_RESET: 'UI_RESET',
};

const THROTTLE_MS = 3000;
const STUCK_LIMITS_MS = {
  [UI_FLOW_STATES.UI_ANALYZING]: 5000,
  [UI_FLOW_STATES.UI_WAITING_RESULT]: 60000,
  [UI_FLOW_STATES.UI_DEALING_ANIMATION]: 5000,
};

/** @type {Map<string, number>} */
const lastAlertByMesa = new Map();
/** @type {Map<string, { uiState: string, enteredAt: number, lastUiFlow: string[] }>} */
const stateByMesa = new Map();

function safeLen(v) {
  return Array.isArray(v) ? v.length : 0;
}

function norm(v) {
  return v == null ? '' : String(v).trim();
}

function has(v) {
  return norm(v) !== '';
}

function pushFlow(mesa, uiState) {
  const prev = stateByMesa.get(mesa);
  const last = prev?.lastUiFlow ?? [];
  const next = [...last];
  if (uiState && (next.length === 0 || next[next.length - 1] !== uiState)) next.push(uiState);
  return next.slice(-12);
}

function shouldThrottle(mesa) {
  const now = Date.now();
  const last = lastAlertByMesa.get(mesa);
  if (last != null && now - last < THROTTLE_MS) return true;
  lastAlertByMesa.set(mesa, now);
  return false;
}

function classifyDiagnostic({ issues, supplier, uiData, lifecycleState, uiState }) {
  if (issues.includes('UI_DISCONNECTED_FROM_STORE')) return 'UI_DISCONNECTED_FROM_STORE';
  if (issues.includes('DATA_NOT_PROPAGATED')) return 'DATA_NOT_PROPAGATED';
  if (issues.includes('RENDER_BLOCKED')) return 'RENDER_BLOCKED';
  if (issues.includes('STATE_DESYNC') || String(lifecycleState) === 'RESULT_RECEIVED') return 'STATE_DESYNC';

  const realHasCards = safeLen(supplier?.player_cards) > 0 || safeLen(supplier?.banker_cards) > 0;
  const uiHasCards = safeLen(uiData?.playerCards) > 0 || safeLen(uiData?.bankerCards) > 0;
  const realHasWinner = has(supplier?.ganador);
  const uiHasWinner = has(uiData?.winner);
  if ((uiHasCards && !realHasCards) || (uiHasWinner && !realHasWinner)) return 'FAKE_UI_RENDER';

  if (uiState === UI_FLOW_STATES.UI_RESULT_DISPLAY && !realHasWinner && !realHasCards) return 'RENDER_BLOCKED';
  return 'STATE_DESYNC';
}

function buildForensicAnalysis({
  type,
  severityLabel,
  mesa,
  round,
  lifecycleState,
  expectedFlow,
  actualFlow,
  supplierSnapshot,
  uiSnapshot,
  issues,
  diagnostic,
}) {
  return {
    que:
      type === ALERT_TYPES.UI_FLOW_BREAK
        ? 'El flujo visual (UI lifecycle) se rompió o quedó desincronizado.'
        : 'La UI está renderizando un estado que no coincide con la data real del proveedor.',
    cuando: new Date(Date.now()).toLocaleString(),
    donde: {
      mesa,
      round,
      summary: `Mesa ${mesa} · Round ${round ?? '—'} · lifecycle ${lifecycleState}`,
    },
    porque: [
      { causa: 'UI not subscribed to store', explicacion: 'Selector equivocado o el componente no está re-renderizando.' },
      { causa: 'Lifecycle mismatch', explicacion: 'Condición de render en UI no sigue lifecycleState.' },
      { causa: 'Render condition incorrect', explicacion: 'showTable/status gating bloquea RESULT/DEALING.' },
      { causa: 'Stale state / race', explicacion: 'Orden de eventos o timers provoca estado visual viejo.' },
    ],
    como: `socket → middleware → store → UI render\n\nFLUJO ESPERADO:\n${expectedFlow}\n\nFLUJO REAL:\n${actualFlow}`,
    data: {
      severity: severityLabel,
      issues,
      diagnostic,
      realData: supplierSnapshot,
      uiData: uiSnapshot,
      diff: issues.map((k) => ({ rule: k })),
    },
    rutaTecnica: [
      'useLabSocket.js',
      'useSignalMiddleware.js',
      'useLabStore.js',
      'CenterPanel.jsx',
      'BaccaratTableView.jsx',
      'CycleIntelCommandPanel.jsx',
    ],
    dondeBuscar: [
      'apps/admin-core/src/gpulse-lab/hooks/useLabSocket.js',
      'apps/admin-core/src/gpulse-lab/middleware/useSignalMiddleware.js',
      'apps/admin-core/src/gpulse-lab/store/useLabStore.js',
      'apps/admin-core/src/gpulse-lab/components/CenterPanel.jsx',
      'apps/admin-core/src/gpulse-lab/components/BaccaratTableView.jsx',
      'apps/admin-core/src/gpulse-lab/components/cycle-intel/CycleIntelCommandPanel.jsx',
    ],
    recomendacion: [
      'Confirmar raw payload del proveedor (cartas/ganador/puntajes).',
      'Confirmar que `supplierMesaInfoFull` tiene esos campos en el store.',
      'Loggear props de `BaccaratTableView` (playerCards/bankerCards/winner).',
      'Revisar gating: `showTable`, `status` y `lifecycleState`.',
    ],
  };
}

/**
 * @param {{
 *  mesaId: string | null,
 *  lifecycleState: string,
 *  uiState: string,
 *  supplierMesaInfoFull: any,
 *  uiData: {
 *    playerCards: any[],
 *    bankerCards: any[],
 *    playerScore: any,
 *    bankerScore: any,
 *    winner: any,
 *    resultVisible: boolean,
 *  },
 *  timestamps?: { cycleStartedAt?: number | null, intelResultTs?: number | null },
 * }} args
 */
export function validateUIFlow({ mesaId, lifecycleState, uiState, supplierMesaInfoFull, uiData, timestamps }) {
  const mesa = mesaId != null ? String(mesaId).trim() : '';
  if (!mesa) return;
  const supplier = supplierMesaInfoFull;
  if (!supplier || typeof supplier !== 'object') return;

  const now = Date.now();
  const prev = stateByMesa.get(mesa);
  const enteringNewState = prev?.uiState !== uiState;
  const enteredAt = enteringNewState ? now : prev?.enteredAt ?? now;
  const lastUiFlow = pushFlow(mesa, uiState);
  stateByMesa.set(mesa, { uiState, enteredAt, lastUiFlow });

  const expectedFlow =
    'UI_IDLE → UI_ANALYZING → UI_SIGNAL_VISIBLE → UI_BETTING_OPEN → UI_WAITING_RESULT → UI_DEALING_ANIMATION → UI_RESULT_DISPLAY → UI_RESET → UI_IDLE';
  const actualFlow = lastUiFlow.length > 0 ? lastUiFlow.join(' → ') : '—';

  const issues = [];

  // Rule 1: RESULT WITHOUT CARDS (reality mismatch)
  const realHasCards = safeLen(supplier?.player_cards) > 0 || safeLen(supplier?.banker_cards) > 0;
  const uiHasNoCards = safeLen(uiData?.playerCards) === 0 && safeLen(uiData?.bankerCards) === 0;
  if (realHasCards && uiHasNoCards) issues.push('UI_NO_RENDER_CARDS');

  // Rule 2: WINNER NOT RENDERED
  const realHasWinner = has(supplier?.ganador);
  if (realHasWinner && !has(uiData?.winner)) issues.push('UI_NO_RENDER_WINNER');

  // Rule 3: UI SHOWS FAKE DATA
  const uiShowsCards = safeLen(uiData?.playerCards) > 0 || safeLen(uiData?.bankerCards) > 0;
  const uiShowsScores = uiData?.playerScore != null || uiData?.bankerScore != null;
  const uiShowsWinner = has(uiData?.winner);
  const realHasScores = supplier?.player_score != null || supplier?.banker_score != null;
  if ((uiShowsCards && !realHasCards) || (uiShowsScores && !realHasScores) || (uiShowsWinner && !realHasWinner)) {
    issues.push('UI_FAKE_RENDER');
  }

  // Rule 4: STATE DESYNC
  if (String(lifecycleState) === 'RESULT_RECEIVED' && uiState !== UI_FLOW_STATES.UI_DEALING_ANIMATION) {
    issues.push('STATE_DESYNC');
  }

  // Rule 5: PREMATURE RENDER (result display but no real result evidence)
  const noNewResultEvidence = !realHasWinner && !realHasCards && !realHasScores;
  if (uiState === UI_FLOW_STATES.UI_RESULT_DISPLAY && noNewResultEvidence) {
    issues.push('PREMATURE_RENDER');
  }

  // Rule 6: STUCK STATE
  const stuckLimit = STUCK_LIMITS_MS[uiState] ?? null;
  if (stuckLimit != null && now - enteredAt > stuckLimit) {
    issues.push('UI_STATE_STUCK');
  }

  // Rule 7: SKIPPED PHASE (BETTING_OPEN → RESULT_DISPLAY skipping DEALING_ANIMATION)
  if (lastUiFlow.length >= 2) {
    const a = lastUiFlow[lastUiFlow.length - 2];
    const b = lastUiFlow[lastUiFlow.length - 1];
    if (a === UI_FLOW_STATES.UI_BETTING_OPEN && b === UI_FLOW_STATES.UI_RESULT_DISPLAY) {
      issues.push('UI_PHASE_SKIP');
    }
  }

  if (issues.length === 0) return;
  if (shouldThrottle(mesa)) return;

  // Severity mapping: critical/error/warning → error/warning/info (store constraints)
  let severity = 'warning';
  let severityLabel = 'warning';
  let type = ALERT_TYPES.UI_REALITY_MISMATCH;

  const flowBreak = issues.some((x) => x === 'STATE_DESYNC' || x === 'PREMATURE_RENDER' || x === 'UI_STATE_STUCK' || x === 'UI_PHASE_SKIP');
  const mismatch = issues.some((x) => x === 'UI_NO_RENDER_CARDS' || x === 'UI_NO_RENDER_WINNER' || x === 'UI_FAKE_RENDER');

  if (flowBreak) {
    type = ALERT_TYPES.UI_FLOW_BREAK;
    severity = 'error';
    severityLabel = 'critical';
  } else if (mismatch) {
    type = ALERT_TYPES.UI_REALITY_MISMATCH;
    severity = 'error';
    severityLabel = 'error';
  }

  // Delayed sync is warning: only UI_STATE_STUCK in WAITING_RESULT is warning-level.
  if (issues.length === 1 && issues[0] === 'UI_STATE_STUCK' && uiState === UI_FLOW_STATES.UI_WAITING_RESULT) {
    severity = 'warning';
    severityLabel = 'warning';
    type = ALERT_TYPES.UI_FLOW_BREAK;
  }

  const debug = import.meta.env.VITE_GPULSE_LAB_DEBUG === '1';
  const round = supplier?.ronda_actual ?? supplier?.round ?? null;

  const supplierSnapshot = debug
    ? supplier
    : {
        player_cards: supplier?.player_cards ?? [],
        banker_cards: supplier?.banker_cards ?? [],
        player_score: supplier?.player_score ?? null,
        banker_score: supplier?.banker_score ?? null,
        ganador: supplier?.ganador ?? null,
      };

  const uiSnapshot = debug
    ? uiData
    : {
        playerCards: uiData?.playerCards ?? [],
        bankerCards: uiData?.bankerCards ?? [],
        playerScore: uiData?.playerScore ?? null,
        bankerScore: uiData?.bankerScore ?? null,
        winner: uiData?.winner ?? null,
        uiState,
        resultVisible: Boolean(uiData?.resultVisible),
      };

  const diagnostic = classifyDiagnostic({ issues, supplier, uiData, lifecycleState, uiState });
  const analysis = buildForensicAnalysis({
    type,
    severityLabel,
    mesa,
    round,
    lifecycleState,
    expectedFlow,
    actualFlow,
    supplierSnapshot,
    uiSnapshot,
    issues,
    diagnostic,
  });

  pushAlert({
    type,
    severity,
    mesa,
    round,
    message: `${type} · ${issues.join(', ')}`,
    rawPayload: {
      severityLabel,
      mesa,
      round,
      lifecycleState,
      uiState,
      timestamps: timestamps ?? null,
      expectedFlow,
      actualFlow,
      realData: supplierSnapshot,
      uiData: uiSnapshot,
      diff: issues.map((k) => ({ rule: k })),
      issues,
      diagnostic,
      analysis,
    },
    context: {
      lifecycleState,
      uiState,
      issues,
      diagnostic,
    },
  });
}

