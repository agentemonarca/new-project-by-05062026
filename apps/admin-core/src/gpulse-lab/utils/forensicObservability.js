import { ALERT_TYPES, pushAlert } from '../store/useAlertStore.js';
import { extractNestedMesaInfo } from './supplierIntelExtract.js';

const THROTTLE_MS = 3000;
const HEARING_TTL_MS = 3000;
const MAX_EVENTS_PER_CYCLE = 50;

/** @type {Map<string, number>} */
const lastAlertAtByMesa = new Map();

/** @type {Map<string, { startedAt: number, mesa: string, round: string | null, outside: any[], inside: any[], hearingTimers: Map<string, any> }>} */
const cycleByMesa = new Map();

function safeLen(v) {
  return Array.isArray(v) ? v.length : 0;
}

function norm(v) {
  return v == null ? '' : String(v).trim();
}

function has(v) {
  return norm(v) !== '';
}

function throttle(mesa) {
  const now = Date.now();
  const last = lastAlertAtByMesa.get(mesa);
  if (last != null && now - last < THROTTLE_MS) return true;
  lastAlertAtByMesa.set(mesa, now);
  return false;
}

function mesaKey(mesaId) {
  const m = mesaId != null ? String(mesaId).trim() : '';
  return m || null;
}

function cycleRowForMesa(mesa) {
  let row = cycleByMesa.get(mesa);
  if (!row) {
    row = {
      startedAt: Date.now(),
      mesa,
      round: null,
      outside: [],
      inside: [],
      hearingTimers: new Map(),
    };
    cycleByMesa.set(mesa, row);
  }
  return row;
}

/**
 * Read-only snapshot for other validators/controllers (pre-failure + auto-heal).
 * @param {string | null} mesaId
 */
export function getForensicCycleSnapshot(mesaId) {
  const mesa = mesaKey(mesaId);
  if (!mesa) return null;
  const row = cycleByMesa.get(mesa);
  if (!row) return null;
  return {
    mesa: row.mesa,
    round: row.round,
    startedAt: row.startedAt,
    outside: Array.isArray(row.outside) ? row.outside.slice(-MAX_EVENTS_PER_CYCLE) : [],
    inside: Array.isArray(row.inside) ? row.inside.slice(-MAX_EVENTS_PER_CYCLE) : [],
  };
}

function pushEvent(list, ev) {
  const next = Array.isArray(list) ? list : [];
  next.push(ev);
  if (next.length > MAX_EVENTS_PER_CYCLE) next.splice(0, next.length - MAX_EVENTS_PER_CYCLE);
  return next;
}

function cancelHearingTimers(row) {
  for (const t of row.hearingTimers.values()) {
    try {
      clearTimeout(t);
    } catch {
      /* ignore */
    }
  }
  row.hearingTimers.clear();
}

function providerTruthSnapshotFromRaw(rawResult) {
  const mi = extractNestedMesaInfo(rawResult);
  if (!mi) return null;
  const cartas_player = mi.cartas_player ?? [];
  const cartas_banker = mi.cartas_banker ?? [];
  const puntaje_player = mi.puntaje_player ?? null;
  const puntaje_banker = mi.puntaje_banker ?? null;
  const ganador = mi.ganador ?? null;
  const round = mi.Ronda ?? mi.ronda_actual ?? mi.round ?? null;
  const mesa = mi.mesa ?? mi.nombre_mesa ?? mi.nombreMesa ?? null;
  const hasTruth =
    safeLen(cartas_player) > 0 || safeLen(cartas_banker) > 0 || puntaje_player != null || puntaje_banker != null || ganador != null;
  if (!hasTruth) return null;
  return { mesa_info: mi, mesa, round, cartas_player, cartas_banker, puntaje_player, puntaje_banker, ganador };
}

function computeTrace({ providerTruth, outside, inside, storeMesaInfo, adapterData, uiData }) {
  const providerOk = providerTruth != null;
  const socketOk = outside.length > 0;
  const middlewareOk = inside.length > 0;
  const storeOk = storeMesaInfo != null && typeof storeMesaInfo === 'object';

  const adapterOk =
    adapterData != null &&
    typeof adapterData === 'object' &&
    ((Array.isArray(adapterData.playerCards) && adapterData.playerCards.length > 0) ||
      (Array.isArray(adapterData.bankerCards) && adapterData.bankerCards.length > 0) ||
      adapterData.playerScore != null ||
      adapterData.bankerScore != null);

  const uiOk =
    uiData != null &&
    typeof uiData === 'object' &&
    ((Array.isArray(uiData.playerCards) && uiData.playerCards.length > 0) ||
      (Array.isArray(uiData.bankerCards) && uiData.bankerCards.length > 0) ||
      has(uiData.winner) ||
      uiData.playerScore != null ||
      uiData.bankerScore != null);

  const chain = [
    { layer: 'PROVIDER', ok: providerOk },
    { layer: 'SOCKET', ok: socketOk },
    { layer: 'MIDDLEWARE', ok: middlewareOk },
    { layer: 'STORE', ok: storeOk },
    { layer: 'ADAPTER', ok: adapterOk },
    { layer: 'UI', ok: uiOk },
  ];

  const breakpoint = chain.find((x) => x.ok === false)?.layer ?? null;
  return { chain, breakpoint };
}

function diagnose(breakpoint, details) {
  if (!breakpoint) return 'DATA_NOT_PROPAGATED';
  switch (breakpoint) {
    case 'PROVIDER':
      return 'FORMAT_INVALID';
    case 'SOCKET':
      return 'FILTER_TOO_STRICT';
    case 'MIDDLEWARE':
      return 'EVENT_DROPPED_BY_MIDDLEWARE';
    case 'STORE':
      return 'STORE_NOT_UPDATED';
    case 'ADAPTER':
      return 'DATA_NOT_MAPPED';
    case 'UI':
      return 'RENDER_BLOCKED';
    default:
      return details?.keyMismatch ? 'KEY_MISMATCH' : 'DATA_NOT_PROPAGATED';
  }
}

function buildUnifiedAnalysis({ type, severityLabel, mesa, round, component, expectedFlow, actualFlow, providerTruth, outside, inside, uiData, trace, breakpoint, diagnostic }) {
  return {
    que: 'Observabilidad forense: se detectó una ruptura o desincronización entre capas del sistema.',
    donde: {
      mesa,
      round,
      summary: `${component} · Mesa ${mesa} · Round ${round ?? '—'}`,
    },
    cuando: new Date(Date.now()).toLocaleString(),
    porque: [
      { causa: 'DATA_NOT_MAPPED', explicacion: 'Adapter o mapping de mesa_info → supplierMesaInfoFull/props no coincide con la verdad del proveedor.' },
      { causa: 'STORE_NOT_UPDATED', explicacion: 'El store no recibió/persistió mesa_info o se reseteó antes de render.' },
      { causa: 'UI_NOT_SUBSCRIBED', explicacion: 'Selector equivocado o memoización bloquea re-render.' },
      { causa: 'RENDER_BLOCKED', explicacion: 'Gating por lifecycle/UI state impide mostrar resultado.' },
      { causa: 'EVENT_DROPPED_BY_MIDDLEWARE', explicacion: 'La capa de negocio ignoró o bloqueó un evento necesario.' },
    ],
    como: `PROVIDER → SOCKET → MIDDLEWARE → STORE → ADAPTER → UI`,
    data: {
      type,
      severityLabel,
      expectedFlow,
      actualFlow,
      providerTruth,
      outside,
      inside,
      uiData,
      trace,
      breakpoint,
      diagnostic,
    },
    dondeBuscar: [
      'apps/admin-core/src/gpulse-lab/hooks/useLabSocket.js',
      'apps/admin-core/src/gpulse-lab/middleware/useSignalMiddleware.js',
      'apps/admin-core/src/gpulse-lab/store/useLabStore.js',
      'apps/admin-core/src/gpulse-lab/utils/supplierIntelExtract.js',
      'apps/admin-core/src/gpulse-lab/components/CenterPanel.jsx',
      'apps/admin-core/src/gpulse-lab/components/BaccaratTableView.jsx',
    ],
    recomendacion: [
      'Comparar mesa_info (raw) vs supplierMesaInfoFull vs props UI.',
      'Revisar si el evento NEW_RESULT entra al middleware y se emite al store.',
      'Verificar condiciones de render (showTable/uiState).',
    ],
  };
}

/**
 * OUTSIDE capture: raw socket events (provider).
 * @param {{ mesaId: string | null, kind: 'NEW_SIGNAL'|'NEW_RESULT', raw: any, round?: any, syncSource?: 'bootstrap' | null }} e
 */
export function recordOutsideEvent(e) {
  if (e?.syncSource === 'bootstrap') return;
  const mesa = mesaKey(e?.mesaId);
  if (!mesa) return;
  const row = cycleRowForMesa(mesa);

  const kind = e.kind;
  const ts = Date.now();
  const round = e.round != null ? String(e.round) : null;
  if (round) row.round = round;

  if (kind === 'NEW_SIGNAL') {
    // Start a new cycle window
    cancelHearingTimers(row);
    row.startedAt = ts;
    row.outside = [];
    row.inside = [];
  }

  row.outside = pushEvent(row.outside, { ts, kind, round, raw: e.raw });

  // Hearing monitor: inside must confirm within 3s
  const token = `${kind}:${round ?? '—'}:${ts}`;
  const t = setTimeout(() => {
    row.hearingTimers.delete(token);
    const heard = row.inside.some((x) => x && x.kind === kind && (round == null || x.round === round));
    if (heard) return;
    if (throttle(mesa)) return;
    pushAlert({
      type: ALERT_TYPES.HEARING_DESYNC,
      severity: 'error',
      mesa,
      round: round ?? null,
      message: `HEARING_DESYNC · OUTSIDE ${kind} not heard INSIDE within ${HEARING_TTL_MS}ms`,
      rawPayload: {
        severityLabel: 'critical',
        mesa,
        round,
        outside: { kind, at: ts },
        inside: row.inside.slice(-8),
        analysis: buildUnifiedAnalysis({
          type: ALERT_TYPES.HEARING_DESYNC,
          severityLabel: 'critical',
          mesa,
          round,
          component: 'useLabSocket.js / useSignalMiddleware.js',
          expectedFlow: 'NEW_SIGNAL → (20–35s) → NEW_RESULT',
          actualFlow: `${row.outside.map((x) => x.kind).join(' → ') || '—'} / inside: ${row.inside.map((x) => x.kind).join(' → ') || '—'}`,
          providerTruth: null,
          outside: row.outside.slice(-8),
          inside: row.inside.slice(-8),
          uiData: null,
          trace: null,
          breakpoint: 'MIDDLEWARE',
          diagnostic: 'EVENT_DROPPED_BY_MIDDLEWARE',
        }),
      },
      context: { kind, ttlMs: HEARING_TTL_MS },
    });
  }, HEARING_TTL_MS);
  row.hearingTimers.set(token, t);
}

/**
 * INSIDE capture: middleware processed events.
 * @param {{ mesaId: string | null, kind: 'NEW_SIGNAL'|'NEW_RESULT', payload: any, round?: any }} e
 */
export function recordInsideEvent(e) {
  const mesa = mesaKey(e?.mesaId);
  if (!mesa) return;
  const row = cycleRowForMesa(mesa);
  const ts = Date.now();
  const round = e.round != null ? String(e.round) : null;
  if (round) row.round = round;
  row.inside = pushEvent(row.inside, { ts, kind: e.kind, round, payload: e.payload });
}

/**
 * Cycle-bounded bypass monitor + trace engine.
 * Call from UI render/update (throttled upstream) when you have:
 * rawResult (provider), store, adapter, ui snapshots.
 *
 * @param {{
 *  mesaId: string | null,
 *  lifecycleState: string,
 *  uiState: string,
 *  supplierLastRawResult: any,
 *  supplierMesaInfoFull: any,
 *  adapterData: any,
 *  uiData: any,
 * }} s
 */
export function computeAndAlertTrace(s) {
  const mesa = mesaKey(s?.mesaId);
  if (!mesa) return;
  const row = cycleRowForMesa(mesa);

  const providerTruth = providerTruthSnapshotFromRaw(s?.supplierLastRawResult);
  if (!providerTruth) return;

  // Only analyze within a cycle window.
  const inCycle = row.outside.some((x) => x.kind === 'NEW_SIGNAL') || row.inside.some((x) => x.kind === 'NEW_SIGNAL');
  if (!inCycle) return;

  // Bypass monitor: outside vs inside dropped events inside cycle window.
  const outsideKinds = row.outside.map((x) => x.kind);
  const insideKinds = row.inside.map((x) => x.kind);
  const dropped = outsideKinds.filter((k) => !insideKinds.includes(k));

  const { chain, breakpoint } = computeTrace({
    providerTruth,
    outside: row.outside,
    inside: row.inside,
    storeMesaInfo: s?.supplierMesaInfoFull,
    adapterData: s?.adapterData,
    uiData: s?.uiData,
  });
  const diagnostic = diagnose(breakpoint, {});

  if (dropped.length === 0 && !breakpoint) return;
  if (throttle(mesa)) return;

  const type = dropped.length > 0 ? ALERT_TYPES.PROVIDER_FLOW_DROPPED_IN_CYCLE : ALERT_TYPES.TRACE_BREAKPOINT;
  const severity = 'error';
  const severityLabel = dropped.length > 0 ? 'critical' : 'error';
  const round = row.round ?? providerTruth.round ?? null;

  pushAlert({
    type,
    severity,
    mesa,
    round,
    message:
      dropped.length > 0
        ? `PROVIDER_FLOW_DROPPED_IN_CYCLE · dropped: ${[...new Set(dropped)].join(', ')}`
        : `TRACE_BREAKPOINT · first FAIL at ${breakpoint}`,
    rawPayload: {
      severityLabel,
      mesa,
      round,
      lifecycleState: s?.lifecycleState ?? null,
      uiState: s?.uiState ?? null,
      providerTruth,
      outside: row.outside.slice(-MAX_EVENTS_PER_CYCLE),
      inside: row.inside.slice(-MAX_EVENTS_PER_CYCLE),
      trace: chain,
      breakpoint,
      diagnostic,
      diff: dropped.length > 0 ? dropped.map((k) => ({ rule: `NOT_HEARD_INSIDE:${k}` })) : [{ rule: `BREAKPOINT:${breakpoint}` }],
      analysis: buildUnifiedAnalysis({
        type,
        severityLabel,
        mesa,
        round,
        component: 'forensicObservability',
        expectedFlow: 'PROVIDER (mesa_info) → SOCKET → MIDDLEWARE → STORE → ADAPTER → UI',
        actualFlow: `outside: ${outsideKinds.join(' → ') || '—'} / inside: ${insideKinds.join(' → ') || '—'}`,
        providerTruth,
        outside: row.outside.slice(-8),
        inside: row.inside.slice(-8),
        uiData: s?.uiData ?? null,
        trace: chain,
        breakpoint,
        diagnostic,
      }),
    },
    context: { breakpoint, diagnostic, dropped },
  });
}

