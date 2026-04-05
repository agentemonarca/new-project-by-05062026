/**
 * Intelligent Notification Engine — contextual rules over Core, Ledger, Network, System.
 * Pure functions: safe for SSR/tests; push realtime payloads via {@link mergeRealtimeNotifications} when wiring websockets.
 */

/** @typedef {'go-staking' | 'go-network' | 'go-wallet' | 'go-marketplace'} NotificationActionId */

export const NotificationAction = /** @type {const} */ ({
  GO_STAKING: 'go-staking',
  GO_NETWORK: 'go-network',
  GO_WALLET: 'go-wallet',
  GO_MARKETPLACE: 'go-marketplace',
});

/** Genesis sidebar / shell routes (see genesisPaths.js). */
export const NAV_BY_NOTIFICATION_ACTION = /** @type {Record<NotificationActionId, string>} */ ({
  [NotificationAction.GO_STAKING]: 'staking',
  [NotificationAction.GO_NETWORK]: 'network',
  [NotificationAction.GO_WALLET]: 'wallet',
  [NotificationAction.GO_MARKETPLACE]: 'marketplace',
});

export const NotificationPriority = /** @type {const} */ ({
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
});

export const NotificationType = /** @type {const} */ ({
  ALERT: 'alert',
  REWARD: 'reward',
  SYSTEM: 'system',
  ACTIVITY: 'activity',
});

/**
 * @typedef {'rule' | 'ledger' | 'system' | 'realtime'} NotificationSource
 *
 * @typedef {{
 *   id: string,
 *   type: typeof NotificationType[keyof typeof NotificationType],
 *   priority: typeof NotificationPriority[keyof typeof NotificationPriority],
 *   title: string,
 *   description: string,
 *   action: NotificationActionId,
 *   actionLabel: string,
 *   timestamp: number,
 *   read?: boolean,
 *   mergeKey?: string,
 *   source?: NotificationSource,
 * }} IntelligentNotification
 */

/** Thresholds — tune without changing rule order. */
const BINARY_MATCH_PTS = 120;
const DIRECT_BONUS_MIN = 0.01;
const IMBALANCE_FLASH_PCT = 38;

/**
 * @param {NotificationActionId} action
 * @returns {string}
 */
export function resolveNavId(action) {
  return NAV_BY_NOTIFICATION_ACTION[action] || 'dashboard';
}

/**
 * @param {typeof NotificationType[keyof typeof NotificationType]} type
 * @param {typeof NotificationPriority[keyof typeof NotificationPriority]} priority
 * @returns {'critical' | 'warning' | 'info'}
 */
export function priorityToUiSeverity(type, priority) {
  if (priority === NotificationPriority.HIGH) return 'critical';
  if (priority === NotificationPriority.MEDIUM) {
    return type === NotificationType.REWARD ? 'info' : 'warning';
  }
  return 'info';
}

/**
 * @param {typeof NotificationType[keyof typeof NotificationType]} type
 * @returns {'alerts' | 'rewards' | 'system' | 'activity'}
 */
export function typeToUiCategory(type) {
  if (type === NotificationType.ALERT) return 'alerts';
  if (type === NotificationType.REWARD) return 'rewards';
  if (type === NotificationType.SYSTEM) return 'system';
  return 'activity';
}

/**
 * UI row shape consumed by GenesisNotificationCenter.
 * @param {IntelligentNotification} n
 * @param {Record<string, number>} [readAtById]
 */
export function intelligentNotificationToUiItem(n, readAtById) {
  return {
    id: n.id,
    category: typeToUiCategory(n.type),
    severity: priorityToUiSeverity(n.type, n.priority),
    title: n.title,
    description: n.description,
    ts: n.timestamp,
    actionLabel: n.actionLabel,
    navId: resolveNavId(n.action),
    priority: n.priority,
    engineAction: n.action,
    read: readAtById != null ? Boolean(readAtById[n.id]) : Boolean(n.read),
  };
}

/**
 * @param {{
 *   hasSession: boolean,
 *   userHasActiveStaking: boolean,
 *   holdingPctAig: number,
 *   minHoldingPct: number,
 *   accountFrozen: boolean,
 *   userEconomicallyActive: boolean,
 *   directClaimUsdt: number,
 *   totalYieldUsdtPerSecond?: number,
 * }} core
 */
function portfolioDenRelevant(holdingPctAig) {
  return holdingPctAig < 99.5;
}

/**
 * Evaluate rule-based + ledger + system notifications (unordered).
 * @param {{
 *   core: {
 *     hasSession: boolean,
 *     userHasActiveStaking: boolean,
 *     holdingPctAig: number,
 *     minHoldingPct: number,
 *     accountFrozen: boolean,
 *     userEconomicallyActive: boolean,
 *     directClaimUsdt: number,
 *     totalYieldUsdtPerSecond?: number,
 *   },
 *   ledger: { events: Array<{ id: string, ts: number, title?: string, summary?: string, category?: string, kind?: string }> },
 *   network: { leftPts: number, rightPts: number },
 *   system?: {
 *     updates?: Array<{ id: string, title: string, description: string, timestamp: number }>,
 *     status?: 'ok' | 'degraded',
 *   },
 *   realtime?: IntelligentNotification[],
 * }} sources
 * @returns {IntelligentNotification[]}
 */
export function evaluateNotificationRules(sources) {
  const { core, ledger, network, system, realtime } = sources;
  const out = /** @type {IntelligentNotification[]} */ ([]);

  const L = Number(network?.leftPts) || 0;
  const R = Number(network?.rightPts) || 0;
  const minLeg = Math.min(L, R);
  const total = L + R;
  const imbalancePct = total > 1e-9 ? Math.round((100 * Math.abs(L - R)) / total) : 0;

  if (core.hasSession && !core.userHasActiveStaking) {
    out.push({
      id: 'engine:staking-inactive',
      type: NotificationType.ALERT,
      priority: NotificationPriority.HIGH,
      title: 'Staking inactivo',
      description:
        'No hay participación de staking elegible. Activa staking para desbloquear el flujo económico completo del protocolo.',
      action: NotificationAction.GO_STAKING,
      actionLabel: 'Ir a staking',
      timestamp: Date.now(),
      mergeKey: 'alert:staking',
      source: 'rule',
    });
  }

  if (
    core.hasSession &&
    portfolioDenRelevant(core.holdingPctAig) &&
    core.holdingPctAig < core.minHoldingPct
  ) {
    out.push({
      id: 'engine:holding-below',
      type: NotificationType.ALERT,
      priority: NotificationPriority.HIGH,
      title: 'Holding AIG bajo el 7%',
      description: `Tu ratio AIG es ~${core.holdingPctAig.toFixed(1)}% (objetivo ~${core.minHoldingPct}%). Riesgo de límites en reclamos.`,
      action: NotificationAction.GO_WALLET,
      actionLabel: 'Abrir wallet',
      timestamp: Date.now(),
      mergeKey: 'alert:holding',
      source: 'rule',
    });
  }

  if (core.hasSession && core.userEconomicallyActive && total > 500 && imbalancePct >= IMBALANCE_FLASH_PCT) {
    out.push({
      id: 'engine:flash-risk',
      type: NotificationType.ALERT,
      priority: NotificationPriority.HIGH,
      title: 'Riesgo flash · desequilibrio binario',
      description:
        'Las piernas muestran fuerte asimetría. Revisa reglas de flash mensual y volumen antes del cierre de ciclo.',
      action: NotificationAction.GO_NETWORK,
      actionLabel: 'Abrir red',
      timestamp: Date.now(),
      mergeKey: 'alert:binary-imbalance',
      source: 'rule',
    });
  }

  if (core.hasSession && core.userEconomicallyActive && minLeg >= BINARY_MATCH_PTS) {
    out.push({
      id: 'engine:binary-match',
      type: NotificationType.REWARD,
      priority: NotificationPriority.MEDIUM,
      title: 'Match binario disponible',
      description: 'Volumen emparejable en ambas piernas · revisa emparejamiento y bonificación en red.',
      action: NotificationAction.GO_NETWORK,
      actionLabel: 'Ver red',
      timestamp: Date.now(),
      mergeKey: 'reward:binary-match',
      source: 'rule',
    });
  }

  if (core.hasSession && core.directClaimUsdt >= DIRECT_BONUS_MIN) {
    out.push({
      id: 'engine:direct-bonus',
      type: NotificationType.REWARD,
      priority: NotificationPriority.MEDIUM,
      title: 'Bono directo generado',
      description: `Saldo direct claim ~${core.directClaimUsdt.toFixed(4)} USDT · disponible para revisión/reclamo.`,
      action: NotificationAction.GO_WALLET,
      actionLabel: 'Reclamar',
      timestamp: Date.now(),
      mergeKey: 'reward:direct',
      source: 'rule',
    });
  }

  const sysUpdates = system?.updates?.length ? system.updates : null;
  if (sysUpdates) {
    for (const u of sysUpdates) {
      out.push({
        id: `system:${u.id}`,
        type: NotificationType.SYSTEM,
        priority: NotificationPriority.LOW,
        title: u.title,
        description: u.description,
        action: NotificationAction.GO_MARKETPLACE,
        actionLabel: 'Ir al marketplace',
        timestamp: u.timestamp,
        mergeKey: `system:${u.id}`,
        source: 'system',
      });
    }
  } else {
    out.push({
      id: 'engine:system-protocol',
      type: NotificationType.SYSTEM,
      priority: NotificationPriority.LOW,
      title: 'Actualización de protocolo',
      description:
        'Mantén tu sesión SIWE y revisa el marketplace para novedades del ecosistema. Estructura lista para avisos en tiempo real.',
      action: NotificationAction.GO_MARKETPLACE,
      actionLabel: 'Ir al marketplace',
      timestamp: Date.now() - 3_600_000,
      mergeKey: 'system:default',
      source: 'system',
    });
  }

  if (system?.status === 'degraded') {
    out.push({
      id: 'engine:system-degraded',
      type: NotificationType.SYSTEM,
      priority: NotificationPriority.MEDIUM,
      title: 'Estado del sistema',
      description: 'Algunos servicios pueden responder con mayor latencia. Vuelve a intentar en unos minutos.',
      action: NotificationAction.GO_MARKETPLACE,
      actionLabel: 'Ver estado',
      timestamp: Date.now(),
      mergeKey: 'system:status',
      source: 'system',
    });
  }

  const recent = (ledger?.events || []).slice(0, 12);
  for (const ev of recent) {
    if (!ev?.id) continue;
    out.push({
      id: `ledger:${ev.id}`,
      type: NotificationType.ACTIVITY,
      priority: NotificationPriority.LOW,
      title: ev.title || 'Actividad en libro',
      description: ev.summary || 'Movimiento registrado.',
      action: NotificationAction.GO_WALLET,
      actionLabel: 'Ver wallet',
      timestamp: ev.ts || Date.now(),
      mergeKey: 'batch-activity',
      source: 'ledger',
    });
  }

  if (realtime?.length) {
    for (const r of realtime) {
      out.push({ ...r, source: r.source || 'realtime' });
    }
  }

  return out;
}

/**
 * Merge notifications sharing the same mergeKey (e.g. batched ledger activity).
 * Keeps the highest priority in the group; combines counts in description.
 * @param {IntelligentNotification[]} items
 * @returns {IntelligentNotification[]}
 */
export function mergeSimilarNotifications(items) {
  /** @type {Map<string, IntelligentNotification[]>} */
  const buckets = new Map();

  for (const n of items) {
    const key = n.mergeKey || n.id;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(n);
  }

  const result = /** @type {IntelligentNotification[]} */ ([]);

  for (const [mergeBucket, group] of buckets) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }

    /** Batch only for low-priority activity stream */
    if (mergeBucket === 'batch-activity') {
      const sorted = [...group].sort((a, b) => b.timestamp - a.timestamp);
      const latest = sorted[0];
      const count = group.length;
      result.push({
        id: 'engine:group-activity',
        type: NotificationType.ACTIVITY,
        priority: NotificationPriority.LOW,
        title: count > 1 ? `${count} actividades recientes` : latest.title,
        description:
          count > 1
            ? `Incluye: ${sorted
                .slice(0, 3)
                .map((g) => g.title)
                .join(' · ')}${count > 3 ? '…' : ''}`
            : latest.description,
        action: NotificationAction.GO_WALLET,
        actionLabel: 'Ver wallet',
        timestamp: latest.timestamp,
        mergeKey: 'batch-activity',
        source: 'ledger',
      });
      continue;
    }

    /** Same mergeKey non-batch: keep strongest priority */
    const rank = (p) => (p === NotificationPriority.HIGH ? 3 : p === NotificationPriority.MEDIUM ? 2 : 1);
    const best = [...group].sort((a, b) => rank(b.priority) - rank(a.priority) || b.timestamp - a.timestamp)[0];
    result.push(best);
  }

  return result;
}

/**
 * Apply persisted read flags (Zustand / server mirror).
 * @param {IntelligentNotification[]} items
 * @param {Record<string, number>} readAtById
 * @returns {IntelligentNotification[]}
 */
export function applyReadState(items, readAtById) {
  return items.map((n) => ({
    ...n,
    read: Boolean(readAtById[n.id]),
  }));
}

/**
 * Future: merge websocket payloads without re-running full rule engine.
 * @param {IntelligentNotification[]} base
 * @param {IntelligentNotification[]} pushed
 */
export function mergeRealtimeNotifications(base, pushed) {
  const seen = new Set(base.map((n) => n.id));
  const extra = pushed.filter((p) => !seen.has(p.id));
  return [...extra, ...base].sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Full pipeline: sources → rules → merge → sort.
 * @param {Parameters<typeof evaluateNotificationRules>[0]} sources
 * @returns {IntelligentNotification[]}
 */
export function buildIntelligentNotificationFeed(sources) {
  const raw = evaluateNotificationRules(sources);
  const merged = mergeSimilarNotifications(raw);
  return merged.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Convenience: engine feed → UI list for GenesisNotificationCenter.
 * @param {Parameters<typeof evaluateNotificationRules>[0]} sources
 * @param {Record<string, number>} [readAtById]
 */
export function buildUiNotificationsFromEngine(sources, readAtById) {
  const feed = buildIntelligentNotificationFeed(sources);
  return feed.map((n) => intelligentNotificationToUiItem(n, readAtById));
}
