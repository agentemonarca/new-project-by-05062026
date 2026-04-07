import { patchAdminSignalsRuntime, adminSignalsRuntime } from './runtimeConfig.js';
import { computeAdminSignalDailyAlerts } from './signalDailyAlertsService.js';

const ALERT_ORDER = ['WINRATE_CRITICAL', 'WINRATE_DROP', 'LATENCY_SPIKE', 'LOW_VOLUME'];

/** @type {Set<string>} */
const ACTION_IDS = new Set([
  'disable_signals',
  'cautela_delay',
  'increase_delay',
  'info_only',
  'none',
]);

const CAUTELA_DELAY_BUMP_MS = 1000;
const LATENCY_SPIKE_BUMP_MS = 800;
const MAX_DELAY_MS = 30_000;

export const DEFAULT_AUTO_RESPONSE_ACTIONS = {
  WINRATE_CRITICAL: 'disable_signals',
  WINRATE_DROP: 'cautela_delay',
  LATENCY_SPIKE: 'increase_delay',
  LOW_VOLUME: 'info_only',
};

/**
 * @type {{
 *   enabled: boolean,
 *   actions: Record<string, string>,
 *   cautelaMode: boolean,
 *   latencyWarning: boolean,
 *   lastAction: object | null,
 *   lastRunAt: string | null,
 * }}
 */
const state = {
  enabled: false,
  actions: { ...DEFAULT_AUTO_RESPONSE_ACTIONS },
  cautelaMode: false,
  latencyWarning: false,
  lastAction: null,
  lastRunAt: null,
};

/** @param {string | undefined} id */
function normalizeActionId(id) {
  const s = String(id || 'none').trim();
  return ACTION_IDS.has(s) ? s : 'none';
}

/** @param {import('mongoose').LeanDocument<any> | null | undefined} doc */
export function hydrateAutoResponseFromDbDoc(doc) {
  if (!doc) return;
  state.enabled = Boolean(doc.autoResponseEnabled);
  state.cautelaMode = Boolean(doc.autoResponseCautela);
  state.latencyWarning = Boolean(doc.autoResponseLatencyWarning);
  const raw =
    doc.autoResponseActions && typeof doc.autoResponseActions === 'object'
      ? doc.autoResponseActions
      : {};
  state.actions = { ...DEFAULT_AUTO_RESPONSE_ACTIONS };
  for (const k of ALERT_ORDER) {
    const v = raw[k];
    const id = normalizeActionId(v !== undefined ? v : DEFAULT_AUTO_RESPONSE_ACTIONS[k]);
    state.actions[k] = id;
  }
  state.lastAction = doc.autoResponseLastAction ?? null;
  state.lastRunAt = doc.autoResponseLastRunAt
    ? new Date(doc.autoResponseLastRunAt).toISOString()
    : null;
}

export function getAutoResponseMongoSlice() {
  return {
    autoResponseEnabled: state.enabled,
    autoResponseActions: { ...state.actions },
    autoResponseCautela: state.cautelaMode,
    autoResponseLatencyWarning: state.latencyWarning,
    autoResponseLastRunAt: state.lastRunAt ? new Date(state.lastRunAt) : null,
    autoResponseLastAction: state.lastAction,
  };
}

export function getAutoResponsePublicState() {
  return {
    ok: true,
    enabled: state.enabled,
    actions: { ...state.actions },
    cautelaMode: state.cautelaMode,
    latencyWarning: state.latencyWarning,
    lastAction: state.lastAction,
    lastRunAt: state.lastRunAt,
    defaultActions: { ...DEFAULT_AUTO_RESPONSE_ACTIONS },
    validActions: Array.from(ACTION_IDS).sort(),
  };
}

/**
 * @param {object} body
 */
export function applyAutoResponseConfigPatch(body) {
  if (!body || typeof body !== 'object') return getAutoResponsePublicState();
  if (body.enabled !== undefined) state.enabled = Boolean(body.enabled);
  if (body.actions && typeof body.actions === 'object') {
    for (const k of Object.keys(body.actions)) {
      if (!ALERT_ORDER.includes(k)) continue;
      const id = normalizeActionId(body.actions[k]);
      state.actions[k] = id;
    }
  }
  return getAutoResponsePublicState();
}

/** @param {number} bump */
function bumpArtificialDelay(bump, logger) {
  const cur = adminSignalsRuntime.delayMs;
  const next = Math.min(MAX_DELAY_MS, Math.max(0, cur + Math.max(0, bump)));
  if (next > cur) {
    patchAdminSignalsRuntime({ artificialDelayMs: next });
    logger?.info?.('signal_auto_response_delay_bumped', { fromMs: cur, toMs: next, bump });
    return true;
  }
  return false;
}

/**
 * @param {string} actionId
 * @param {{ alertType: string, alertsForType: object[], logger?: object }} ctx
 */
function executeAction(actionId, { alertType, alertsForType, logger }) {
  /** @type {{ action: string, alertType: string, detail?: object, mutatesRuntime?: boolean }} */
  const base = { action: actionId, alertType, mutatesRuntime: false };

  switch (actionId) {
    case 'disable_signals': {
      patchAdminSignalsRuntime({ showSignalsToUsers: false });
      logger?.error?.('signal_auto_response_critical', {
        alertType,
        message: 'Auto-response: señales ocultas a usuarios (WINRATE_CRITICAL)',
        sample: alertsForType[0] ?? null,
      });
      return { ...base, mutatesRuntime: true, detail: { showSignalsToUsers: false } };
    }
    case 'cautela_delay': {
      const bumped = bumpArtificialDelay(CAUTELA_DELAY_BUMP_MS, logger);
      logger?.warn?.('signal_auto_response_cautela', {
        alertType,
        message: 'Modo cautela: delay artificial incrementado',
        bumpMs: CAUTELA_DELAY_BUMP_MS,
        bumped,
      });
      return { ...base, mutatesRuntime: bumped, detail: { bumpMs: CAUTELA_DELAY_BUMP_MS } };
    }
    case 'increase_delay': {
      const bumped = bumpArtificialDelay(LATENCY_SPIKE_BUMP_MS, logger);
      logger?.warn?.('signal_auto_response_latency', {
        alertType,
        message: 'Latencia alta: delay artificial incrementado',
        bumpMs: LATENCY_SPIKE_BUMP_MS,
        bumped,
      });
      return { ...base, mutatesRuntime: bumped, detail: { bumpMs: LATENCY_SPIKE_BUMP_MS } };
    }
    case 'info_only': {
      logger?.info?.('signal_auto_response_info', {
        alertType,
        count: alertsForType.length,
        sample: alertsForType[0] ?? null,
      });
      return { ...base, mutatesRuntime: false, detail: { informational: true } };
    }
    default:
      return null;
  }
}

/** @param {Set<string>} typesPresent */
function syncModeFlagsFromAlerts(typesPresent) {
  state.cautelaMode = typesPresent.has('WINRATE_DROP');
  state.latencyWarning = typesPresent.has('LATENCY_SPIKE');
}

/**
 * Evalúa alertas diarias y aplica acciones configuradas.
 * @param {{ persistence?: { persistRuntimeConfigToDb?: Function, persistAutoResponseToDb?: Function }, logger?: object }} ctx
 */
export async function runSignalAutoResponse(ctx = {}) {
  const { persistence, logger } = ctx;

  if (!state.enabled) {
    return { ran: false, reason: 'disabled' };
  }

  const daily = await computeAdminSignalDailyAlerts(7);
  const list = Array.isArray(daily.alerts) ? daily.alerts : [];
  const typesPresent = new Set(list.map((a) => a.type));

  syncModeFlagsFromAlerts(typesPresent);

  if (!daily.mongoReady) {
    state.lastRunAt = new Date().toISOString();
    state.lastAction = {
      summary: 'mongo_unavailable',
      mongoReady: false,
    };
    await persistence?.persistAutoResponseToDb?.();
    return { ran: true, mongoReady: false, executed: [] };
  }

  if (!list.length) {
    state.lastRunAt = new Date().toISOString();
    state.lastAction = {
      summary: 'no_daily_alerts',
      fromDate: daily.fromDate,
      toDate: daily.toDate,
      executed: [],
    };
    await persistence?.persistAutoResponseToDb?.();
    return { ran: true, executed: [], alerts: [] };
  }

  /** @type {object[]} */
  const executed = [];
  let mutatesRuntime = false;

  for (const alertType of ALERT_ORDER) {
    if (!typesPresent.has(alertType)) continue;
    const actionId = normalizeActionId(
      state.actions[alertType] ?? DEFAULT_AUTO_RESPONSE_ACTIONS[alertType],
    );
    if (actionId === 'none') continue;
    const alertsForType = list.filter((a) => a.type === alertType);
    const row = executeAction(actionId, { alertType, alertsForType, logger });
    if (row) {
      executed.push(row);
      if (row.mutatesRuntime) mutatesRuntime = true;
    }
  }

  state.lastRunAt = new Date().toISOString();
  state.lastAction = {
    summary: 'run_complete',
    windowDays: daily.windowDays,
    fromDate: daily.fromDate,
    toDate: daily.toDate,
    alertCount: list.length,
    executed,
    cautelaMode: state.cautelaMode,
    latencyWarning: state.latencyWarning,
  };

  if (mutatesRuntime) {
    await persistence?.persistRuntimeConfigToDb?.();
  }
  await persistence?.persistAutoResponseToDb?.();

  return { ran: true, executed, alerts: list, cautelaMode: state.cautelaMode, latencyWarning: state.latencyWarning };
}

/** @param {{ persistence?: object, logger?: object, intervalMs?: number }} opts @returns {() => void} */
export function startSignalAutoResponseScheduler(opts) {
  const intervalMs = Math.max(0, Number(opts.intervalMs ?? 300_000));
  if (intervalMs <= 0) return () => {};

  const tick = () =>
    runSignalAutoResponse({ persistence: opts.persistence, logger: opts.logger }).catch((e) => {
      opts.logger?.warn?.('signal_auto_response_tick_failed', { message: e?.message });
    });

  const tBoot = setTimeout(tick, 20_000);
  const iv = setInterval(tick, intervalMs);
  return () => {
    clearTimeout(tBoot);
    clearInterval(iv);
  };
}
