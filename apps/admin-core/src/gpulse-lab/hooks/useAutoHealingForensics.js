import { useEffect, useRef } from 'react';
import { ALERT_TYPES, pushAlert, useAlertStore } from '../store/useAlertStore.js';
import { useLabStore } from '../store/useLabStore.js';
import { useGpulseLabUiStore } from '../store/useGpulseLabUiStore.js';
import { extractNestedMesaInfo } from '../utils/supplierIntelExtract.js';
import { handleResult } from '../middleware/useSignalMiddleware.js';

const TRIGGER_TYPES = new Set([
  ALERT_TYPES.PROVIDER_DATA_NOT_RENDERED,
  ALERT_TYPES.HEARING_DESYNC,
  ALERT_TYPES.PROVIDER_FLOW_DROPPED_IN_CYCLE,
  ALERT_TYPES.UI_FLOW_BREAK,
]);

/** @type {Map<string, { attempts: number, lastAt: number }>} */
const attemptsByCycle = new Map();

function keyFor(mesa, round) {
  const m = mesa != null ? String(mesa).trim() : '';
  const r = round != null ? String(round).trim() : '';
  return `${m}|${r || '—'}`;
}

function safeLen(v) {
  return Array.isArray(v) ? v.length : 0;
}

function has(v) {
  return v != null && String(v).trim() !== '';
}

function buildAnswers({ providerTruth, outside, inside, storeMesaInfo, adapterData, uiData, lifecycleState }) {
  const providerOK = providerTruth != null;
  const socketOK = Array.isArray(outside) ? outside.length > 0 : false;
  const middlewareOK = Array.isArray(inside) ? inside.length > 0 : false;
  const storeOK = storeMesaInfo != null && typeof storeMesaInfo === 'object';
  const adapterOK =
    adapterData != null &&
    ((safeLen(adapterData?.playerCards) > 0 || safeLen(adapterData?.bankerCards) > 0) ||
      adapterData?.playerScore != null ||
      adapterData?.bankerScore != null);
  const uiOK =
    uiData != null &&
    ((safeLen(uiData?.playerCards) > 0 || safeLen(uiData?.bankerCards) > 0) ||
      has(uiData?.winner) ||
      uiData?.playerScore != null ||
      uiData?.bankerScore != null);
  const lifecycleOK =
    String(lifecycleState) === 'RESULT_RECEIVED' ||
    String(lifecycleState) === 'CYCLE_COMPLETE' ||
    String(lifecycleState) === 'WAITING_RESULT' ||
    String(lifecycleState) === 'BETTING_CLOSED';

  return { providerOK, socketOK, middlewareOK, storeOK, adapterOK, uiOK, lifecycleOK };
}

function diagnose(answers, priorDiagnostic) {
  if (typeof priorDiagnostic === 'string' && priorDiagnostic.trim() !== '') return priorDiagnostic;
  if (!answers.providerOK) return 'FORMAT_INVALID';
  if (!answers.socketOK) return 'FILTER_TOO_STRICT';
  if (!answers.middlewareOK) return 'EVENT_DROPPED_BY_MIDDLEWARE';
  if (!answers.storeOK) return 'STORE_NOT_UPDATED';
  if (!answers.adapterOK) return 'DATA_NOT_MAPPED';
  if (!answers.uiOK && answers.lifecycleOK) return 'RENDER_BLOCKED';
  if (!answers.uiOK && !answers.lifecycleOK) return 'STATE_BLOCKED';
  return 'DATA_NOT_PROPAGATED';
}

function normalizeResultFromMesaInfo(mesaId, mesaInfo) {
  const mesa = mesaId;
  const round =
    mesaInfo?.Ronda != null && String(mesaInfo.Ronda).trim() !== ''
      ? String(mesaInfo.Ronda).trim()
      : mesaInfo?.ronda_actual != null && String(mesaInfo.ronda_actual).trim() !== ''
        ? String(mesaInfo.ronda_actual).trim()
        : mesaInfo?.round != null && String(mesaInfo.round).trim() !== ''
          ? String(mesaInfo.round).trim()
          : '0';
  const ganador = mesaInfo?.ganador ?? null;
  return { mesa, round, ganador, correlationKey: `${String(mesa)}|${String(round)}` };
}

async function autoHealOne(alert) {
  const mesa = alert?.mesa != null ? String(alert.mesa).trim() : '';
  const round = alert?.round != null ? String(alert.round).trim() : '—';
  if (!mesa) return;

  const k = keyFor(mesa, round);
  const now = Date.now();
  const row = attemptsByCycle.get(k) ?? { attempts: 0, lastAt: 0 };
  if (row.attempts >= 2) return;
  if (now - row.lastAt < 800) return;
  attemptsByCycle.set(k, { attempts: row.attempts + 1, lastAt: now });

  const lab = useLabStore.getState();
  const mesaRow = lab.mesas?.[mesa] ?? null;
  const rawResult = mesaRow?.supplierLastRawResult ?? null;
  const providerTruth = rawResult ? extractNestedMesaInfo(rawResult) : null;

  const outside = alert?.rawPayload?.outside ?? alert?.rawPayload?.data?.outside ?? null;
  const inside = alert?.rawPayload?.inside ?? alert?.rawPayload?.data?.inside ?? null;
  const storeMesaInfo = mesaRow?.supplierMesaInfoFull ?? null;
  const adapterData = alert?.rawPayload?.adapterData ?? null;
  const uiData = alert?.rawPayload?.uiData ?? alert?.rawPayload?.data?.uiData ?? null;
  const lifecycleState = lab.lifecycleState;

  const answers = buildAnswers({
    providerTruth,
    outside,
    inside,
    storeMesaInfo,
    adapterData,
    uiData,
    lifecycleState,
  });
  const diagnostic = diagnose(answers, alert?.rawPayload?.diagnostic ?? null);

  // Action map (conservative)
  let action = 'none';
  try {
    if (diagnostic === 'STORE_NOT_UPDATED' && rawResult) {
      lab.mergeSupplierIntelResult(rawResult, { mesaId: mesa });
      action = 're-inject provider data into store (mergeSupplierIntelResult)';
    } else if (diagnostic === 'EVENT_DROPPED_BY_MIDDLEWARE' && providerTruth) {
      const normRes = normalizeResultFromMesaInfo(mesa, providerTruth);
      handleResult(normRes);
      action = 're-inject NEW_RESULT into middleware (handleResult)';
    } else if (diagnostic === 'RENDER_BLOCKED' || diagnostic === 'UI_NOT_SUBSCRIBED') {
      useGpulseLabUiStore.getState().bumpUiRefreshNonce();
      action = 'force UI remount (uiRefreshNonce bump)';
    } else if (diagnostic === 'STATE_BLOCKED') {
      lab.enterWaitingSignal(mesa);
      action = 'reset lifecycle to WAITING_SIGNAL (enterWaitingSignal)';
    } else if (diagnostic === 'DATA_NOT_MAPPED' && rawResult) {
      // Best-effort: force re-merge mesa_info and remount UI.
      lab.mergeSupplierIntelResult(rawResult, { mesaId: mesa });
      useGpulseLabUiStore.getState().bumpUiRefreshNonce();
      action = 'rebuild mapping (re-merge) + force UI remount';
    }
  } catch (e) {
    action = `action_failed: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Highlight + toast immediately
  try {
    useGpulseLabUiStore.getState().setHighlightMesa(mesa, 1600);
    useGpulseLabUiStore.getState().pushToast({
      level: 'critical',
      title: 'AUTO-HEAL',
      message: `Mesa ${mesa} · Round ${round} · ${diagnostic}`,
      meta: { action },
    });
  } catch {
    /* ignore */
  }

  // Verify after 300ms
  await new Promise((r) => setTimeout(r, 300));
  const mesaRow2 = useLabStore.getState().mesas?.[mesa] ?? null;
  const mi2 = mesaRow2?.supplierMesaInfoFull ?? null;
  const uiOk =
    safeLen(mi2?.player_cards) > 0 || safeLen(mi2?.banker_cards) > 0 || has(mi2?.ganador) || mi2?.player_score != null || mi2?.banker_score != null;

  pushAlert({
    type: 'AUTO_HEALING_TRIGGERED',
    severity: 'error',
    mesa,
    round,
    message: `AUTO_HEALING_TRIGGERED · ${uiOk ? 'HEALED ✅' : 'FAILED ❌'} · ${diagnostic}`,
    rawPayload: {
      severityLabel: 'critical',
      triggerType: alert?.type ?? null,
      mesa,
      round,
      preguntasMagicas: answers,
      diagnostic,
      accionAutomatica: action,
      verification: {
        healed: uiOk,
        storeSnapshot: mi2,
      },
      analysis: {
        que: 'Se detectó una inconsistencia y se ejecutó una corrección automática.',
        donde: { mesa, round, summary: 'Auto-healing controller' },
        porque: [{ causa: diagnostic, explicacion: 'Diagnóstico automático basado en “preguntas mágicas”.' }],
        como: 'Ask → Diagnose → Act → Verify → Explain',
        data: {
          preguntasMagicas: answers,
          diagnostic,
          accion: action,
          resultado: uiOk ? 'HEALED ✅' : 'FAILED ❌',
        },
        dondeBuscar: [
          'apps/admin-core/src/gpulse-lab/hooks/useLabSocket.js',
          'apps/admin-core/src/gpulse-lab/middleware/useSignalMiddleware.js',
          'apps/admin-core/src/gpulse-lab/store/useLabStore.js',
          'apps/admin-core/src/gpulse-lab/components/CenterPanel.jsx',
          'apps/admin-core/src/gpulse-lab/components/BaccaratTableView.jsx',
        ],
        recomendacion: uiOk
          ? ['Monitorear 1–2 ciclos para confirmar estabilidad.']
          : ['Revisar el breakpoint (trace) y validar payload raw vs store vs UI.'],
      },
    },
    context: { diagnostic, healed: uiOk, triggerType: alert?.type ?? null },
  });
}

export function useAutoHealingForensics() {
  const lastSeenIdRef = useRef(null);

  useEffect(() => {
    const unsub = useAlertStore.subscribe(
      (s) => s.alerts,
      (alerts) => {
        const first = Array.isArray(alerts) && alerts.length > 0 ? alerts[0] : null;
        if (!first || !first.id) return;
        if (lastSeenIdRef.current === first.id) return;
        lastSeenIdRef.current = first.id;
        if (!TRIGGER_TYPES.has(first.type)) return;
        void autoHealOne(first);
      },
      { equalityFn: (a, b) => a === b },
    );
    return () => {
      try {
        unsub();
      } catch {
        /* ignore */
      }
    };
  }, []);
}

