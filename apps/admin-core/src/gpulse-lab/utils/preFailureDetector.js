import { ALERT_TYPES, pushAlert } from '../store/useAlertStore.js';
import { extractNestedMesaInfo } from './supplierIntelExtract.js';
import { getForensicCycleSnapshot } from './forensicObservability.js';
import { useLabStore } from '../store/useLabStore.js';
import { useGpulseLabUiStore } from '../store/useGpulseLabUiStore.js';
import { handleResult } from '../engine/executionEngineDispatch.js';

const THROTTLE_MS = 3000;
/** @type {Map<string, number>} */
const lastByMesa = new Map();
/** @type {Map<string, number>} */
const attemptsByMesa = new Map();

function safeLen(v) {
  return Array.isArray(v) ? v.length : 0;
}

function has(v) {
  return v != null && String(v).trim() !== '';
}

function throttle(mesa) {
  const now = Date.now();
  const last = lastByMesa.get(mesa);
  if (last != null && now - last < THROTTLE_MS) return true;
  lastByMesa.set(mesa, now);
  return false;
}

function bumpAttempt(mesa) {
  const prev = attemptsByMesa.get(mesa) ?? 0;
  attemptsByMesa.set(mesa, prev + 1);
  return prev + 1;
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

/**
 * Predictive pre-failure detection + prevention.
 * Runs on UI update (throttled), predicts likely next failure, applies pre-heal action.
 *
 * @param {{
 *  mesaId: string | null,
 *  lifecycleState: string,
 *  uiState: string,
 *  supplierLastRawResult: any,
 *  supplierMesaInfoFull: any,
 *  adapterData: any,
 *  uiData: any,
 *  intelResultTs?: number | null,
 * }} s
 */
export function detectAndPreventPreFailure(s) {
  const mesa = s?.mesaId != null ? String(s.mesaId).trim() : '';
  if (!mesa) return;
  const now = Date.now();

  const providerMi = s?.supplierLastRawResult ? extractNestedMesaInfo(s.supplierLastRawResult) : null;
  const providerTruthExists = providerMi != null;

  const storeMi = s?.supplierMesaInfoFull;
  const storeUpdatedAt = typeof s?.intelResultTs === 'number' ? s.intelResultTs : null;

  const adapterOK =
    s?.adapterData != null &&
    (safeLen(s.adapterData?.playerCards) > 0 ||
      safeLen(s.adapterData?.bankerCards) > 0 ||
      s.adapterData?.playerScore != null ||
      s.adapterData?.bankerScore != null);

  const uiOK =
    s?.uiData != null &&
    (safeLen(s.uiData?.playerCards) > 0 ||
      safeLen(s.uiData?.bankerCards) > 0 ||
      has(s.uiData?.winner) ||
      s.uiData?.playerScore != null ||
      s.uiData?.bankerScore != null);

  const cycle = getForensicCycleSnapshot(mesa);
  const outsideHasResult = Array.isArray(cycle?.outside) ? cycle.outside.some((e) => e?.kind === 'NEW_RESULT') : false;
  const insideHasResult = Array.isArray(cycle?.inside) ? cycle.inside.some((e) => e?.kind === 'NEW_RESULT') : false;

  /** @type {string | null} */
  let predicted = null;
  /** @type {string | null} */
  let risk = null;

  // Condition 2: NEW_RESULT received outside but not processed inside yet (early warning)
  if (outsideHasResult && !insideHasResult) {
    predicted = 'EVENT_DROPPED_BY_MIDDLEWARE';
    risk = 'NEW_RESULT recibido (socket) pero middleware aún no lo procesó';
  }

  // Condition 1: provider truth exists but adapter/UI not updated after 200ms since store update
  if (predicted == null && providerTruthExists && storeUpdatedAt != null && now - storeUpdatedAt > 200 && (!adapterOK || !uiOK)) {
    predicted = !adapterOK ? 'DATA_NOT_MAPPED' : 'UI_NOT_SUBSCRIBED';
    risk = 'La verdad del proveedor ya existe, pero adapter/UI no se actualizó a tiempo';
  }

  // Condition 3: store updated but UI not re-rendered within 150ms
  if (predicted == null && storeUpdatedAt != null && now - storeUpdatedAt > 150 && !uiOK) {
    predicted = 'UI_NOT_SUBSCRIBED';
    risk = 'Store actualizado pero UI no re-renderiza';
  }

  // Condition 4: lifecycle mismatch (RESULT_RECEIVED but UI still betting/other state)
  if (predicted == null && String(s?.lifecycleState) === 'RESULT_RECEIVED' && String(s?.uiState) !== 'UI_DEALING_ANIMATION') {
    predicted = 'STATE_BLOCKED';
    risk = 'Lifecycle indica RESULT_RECEIVED pero UI no entró a dealing';
  }

  if (!predicted) return;
  if (throttle(mesa)) return;

  // Pre-heal safety: max 2 attempts per mesa per ~window
  const attempt = bumpAttempt(mesa);
  if (attempt > 2) return;

  let action = 'none';
  try {
    if (predicted === 'DATA_NOT_MAPPED') {
      // Force re-merge + remount to re-run mapping pipeline.
      if (s?.supplierLastRawResult) {
        useLabStore.getState().mergeSupplierIntelResult(s.supplierLastRawResult, { mesaId: mesa });
      }
      useGpulseLabUiStore.getState().bumpUiRefreshNonce();
      action = 're-merge supplier result + force UI remount';
    } else if (predicted === 'UI_NOT_SUBSCRIBED') {
      useGpulseLabUiStore.getState().bumpUiRefreshNonce();
      action = 'force UI remount (uiRefreshNonce bump)';
    } else if (predicted === 'EVENT_DROPPED_BY_MIDDLEWARE') {
      if (providerMi) {
        handleResult(normalizeResultFromMesaInfo(mesa, providerMi));
        action = 're-inject NEW_RESULT into middleware (handleResult)';
      } else if (s?.supplierLastRawResult) {
        // best effort: re-merge so at least store/UI can update while waiting
        useLabStore.getState().mergeSupplierIntelResult(s.supplierLastRawResult, { mesaId: mesa });
        action = 'best-effort re-merge supplier result into store';
      }
    } else if (predicted === 'STATE_BLOCKED') {
      useGpulseLabUiStore.getState().bumpUiRefreshNonce();
      action = 'force UI remount to unblock lifecycle render';
    }
  } catch (e) {
    action = `action_failed: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    useGpulseLabUiStore.getState().setHighlightMesa(mesa, 1200);
    useGpulseLabUiStore.getState().pushToast({
      level: 'warning',
      title: 'PRE-FAILURE',
      message: `Mesa ${mesa} · ${predicted}`,
      meta: { risk, action },
    });
  } catch {
    /* ignore */
  }

  pushAlert({
    type: ALERT_TYPES.PRE_FAILURE_DETECTED,
    severity: 'warning',
    mesa,
    round: storeMi?.ronda_actual ?? storeMi?.round ?? providerMi?.ronda_actual ?? providerMi?.round ?? null,
    message: `PRE_FAILURE_DETECTED · predicted ${predicted}`,
    rawPayload: {
      risk,
      predicted,
      action,
      trace: {
        PROVIDER: providerTruthExists ? 'OK' : 'FAIL',
        STORE: storeMi != null ? 'OK' : 'FAIL',
        ADAPTER: adapterOK ? 'OK' : 'FAIL',
        UI: uiOK ? 'OK' : 'NOT UPDATED',
        MIDDLEWARE: insideHasResult ? 'OK' : outsideHasResult ? 'NOT HEARD' : '—',
      },
      analysis: {
        que: 'Se detectó una condición que probablemente causará un error.',
        impacto: `Riesgo: ${risk ?? '—'}`,
        como: 'Predicción → prevención (pre-heal) → verificación en el próximo render',
        recomendacion: [
          'Si reaparece, revisar selector/UI gating y el mapping de mesa_info.',
          'Validar que NEW_RESULT entra en middleware y no se bloquea por estado.',
        ],
      },
    },
    context: { predicted, risk, action },
  });
}

