/**
 * Observabilidad Genesis: logs estructurados, métricas agregadas, señales de alerta.
 * Sin dependencias externas; compatible con agregadores (JSON lines) y scraping Prometheus opcional.
 */

/** @type {{ info: Function, warn: Function, error: Function, metric: Function }} */
let loggerRef = {
  info: () => {},
  warn: () => {},
  error: () => {},
  metric: () => {},
};

/** @type {{ at: number, driftCount: number, ok: boolean, scanned: number } | null} */
let lastAuditSummary = null;

const state = {
  startedAtMs: Date.now(),
  p2p: { tradesSettled: 0, volumeAigSum: 0, volumeUsdNotionalSum: 0 },
  rewards: { bonusCreated: 0, walletClaims: 0, claimedUsdSum: 0 },
  wallet: { legacyClaims: 0, legacyClaimUsdSum: 0 },
  errors: { total: 0, byCode: /** @type {Record<string, number>} */ ({}) },
  alerts: { ledgerDrift: 0, critical: 0 },
  /** @type {Array<Record<string, unknown>>} */
  recentStructured: [],
};

const RECENT_MAX = 80;

function pushRecent(entry) {
  state.recentStructured.unshift(entry);
  state.recentStructured = state.recentStructured.slice(0, RECENT_MAX);
}

function round8(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 1e8) / 1e8;
}

/**
 * @param {{ info?: Function, warn?: Function, error?: Function, metric?: Function }} logger
 */
export function initGenesisObservability(logger) {
  if (logger && typeof logger.info === 'function') {
    loggerRef = {
      info: logger.info.bind(logger),
      warn: logger.warn?.bind(logger) || ((...a) => console.warn(...a)),
      error: logger.error?.bind(logger) || ((...a) => console.error(...a)),
      metric: logger.metric?.bind(logger) || ((...a) => console.log(...a)),
    };
  }
}

/**
 * Log JSON estable: buscar por msg=genesis_structured y domain/event.
 * @param {'claim' | 'trade' | 'reward' | 'audit' | 'error' | 'system'} domain
 * @param {string} event
 * @param {Record<string, unknown>} [fields]
 */
export function logGenesisStructured(domain, event, fields = {}) {
  const row = {
    msg: 'genesis_structured',
    domain,
    event,
    ...fields,
  };
  loggerRef.info('genesis_structured', row);
  pushRecent({ ts: Date.now(), ...row });
}

/**
 * @param {{ name: string, payload: Record<string, unknown>, ts: number }} ev
 */
export function ingestGenesisPlatformEvent(ev) {
  const name = String(ev?.name || '');
  const payload = ev?.payload && typeof ev.payload === 'object' ? ev.payload : {};

  if (name === 'reward_created') {
    state.rewards.bonusCreated += 1;
    const amount = round8(Number(payload.amount) || 0);
    loggerRef.metric('genesis_reward_bonus_created', {
      rewardType: payload.rewardType,
      amount,
      userId: payload.userId,
    });
    logGenesisStructured('reward', 'bonus_created', {
      userId: payload.userId,
      rewardType: payload.rewardType,
      amount,
      transactionId: payload.transactionId,
      idempotencyKey: payload.idempotencyKey ?? null,
    });
    return;
  }

  if (name === 'reward_claimed') {
    state.rewards.walletClaims += 1;
    const amount = round8(Number(payload.amount) || 0);
    state.rewards.claimedUsdSum = round8(state.rewards.claimedUsdSum + amount);
    loggerRef.metric('genesis_reward_wallet_claim', {
      amount,
      userId: payload.userId,
    });
    logGenesisStructured('claim', 'rewards_wallet_claimed', {
      userId: payload.userId,
      amount,
      idempotencyKey: payload.idempotencyKey ?? null,
      rewardsPendingUsd: payload.rewardsPendingUsd,
      rewardsClaimedUsd: payload.rewardsClaimedUsd,
    });
  }
}

/**
 * @param {{ buyer: string, seller: string, qtyAig: number, notionalUsd: number, execPrice: number, projectId?: string }} p
 */
export function recordP2pTradeSettled(p) {
  const qtyAig = round8(p.qtyAig);
  const notionalUsd = round8(p.notionalUsd);
  state.p2p.tradesSettled += 1;
  state.p2p.volumeAigSum = round8(state.p2p.volumeAigSum + qtyAig);
  state.p2p.volumeUsdNotionalSum = round8(state.p2p.volumeUsdNotionalSum + notionalUsd);
  loggerRef.metric('genesis_p2p_trade_settled', {
    qtyAig,
    notionalUsd,
    execPrice: round8(p.execPrice),
    projectId: p.projectId || 'genesis',
  });
  logGenesisStructured('trade', 'p2p_settled', {
    buyer: p.buyer,
    seller: p.seller,
    qtyAig,
    notionalUsd,
    execPrice: round8(p.execPrice),
    projectId: p.projectId || 'genesis',
  });
}

/**
 * @param {{ kind: 'direct' | 'binary' | 'mining', userId: string, amount: number }} p
 */
export function recordLegacyWalletClaim(p) {
  const amount = round8(p.amount);
  if (amount <= 0) return;
  state.wallet.legacyClaims += 1;
  state.wallet.legacyClaimUsdSum = round8(state.wallet.legacyClaimUsdSum + amount);
  loggerRef.metric('genesis_claim_legacy_settled', { kind: p.kind, amount });
  logGenesisStructured('claim', 'legacy_wallet_settled', {
    kind: p.kind,
    userId: p.userId,
    amount,
  });
}

/**
 * Errores de dominio Genesis (handlers HTTP, códigos conocidos).
 * @param {{ code?: string, message: string, status: number, path?: string }} p
 */
export function recordGenesisDomainError(p) {
  const code = String(p.code || 'unknown');
  state.errors.total += 1;
  state.errors.byCode[code] = (state.errors.byCode[code] || 0) + 1;
  const level = p.status >= 500 ? 'error' : 'warn';
  const payload = {
    domain: 'error',
    event: 'api_domain_error',
    code,
    message: p.message,
    status: p.status,
    path: p.path || null,
  };
  if (level === 'error') {
    loggerRef.error('genesis_structured', payload);
    if (p.status >= 500) {
      state.alerts.critical += 1;
      loggerRef.error('GENESIS_CRITICAL_FAILURE', {
        source: 'http',
        code,
        message: p.message,
        path: p.path,
      });
    }
  } else {
    loggerRef.warn('genesis_structured', payload);
  }
  loggerRef.metric('genesis_error', { code, status: p.status });
  pushRecent({ ts: Date.now(), msg: 'genesis_structured', ...payload });
}

/**
 * Drift contable > 0 (alerta financiera).
 * @param {Record<string, unknown>} detail
 */
export function recordLedgerDriftDetected(detail) {
  state.alerts.ledgerDrift += 1;
  loggerRef.error('AUDIT_DRIFT_CRITICAL', detail);
  loggerRef.metric('genesis_ledger_drift', {
    userId: detail.userId,
    usdDrift: detail.usdDrift,
    aigDrift: detail.aigDrift,
  });
  logGenesisStructured('audit', 'ledger_drift_detected', detail);
}

/**
 * Otros fallos críticos (jobs, integraciones).
 */
export function recordCriticalFailure(source, message, extra = {}) {
  state.alerts.critical += 1;
  loggerRef.error('GENESIS_CRITICAL_FAILURE', { source, message, ...extra });
  loggerRef.metric('genesis_critical', { source });
  logGenesisStructured('system', 'critical_failure', { source, message, ...extra });
}

/**
 * Tras ejecutar auditoría manual o programada.
 */
export function recordAuditRunSummary(result) {
  lastAuditSummary = {
    at: Date.now(),
    driftCount: result.driftCount,
    ok: result.ok,
    scanned: result.scanned,
    capped: result.capped,
  };
  logGenesisStructured('audit', 'run_completed', {
    driftCount: result.driftCount,
    ok: result.ok,
    scanned: result.scanned,
    capped: result.capped,
  });
}

export function getGenesisObservabilitySnapshot() {
  return {
    service: 'genesis',
    uptimeSec: Math.round(process.uptime()),
    startedAtMs: state.startedAtMs,
    lastAudit: lastAuditSummary,
    metrics: {
      p2p: { ...state.p2p },
      rewards: { ...state.rewards },
      walletLegacy: { ...state.wallet },
      errors: { total: state.errors.total, byCode: { ...state.errors.byCode } },
      alerts: { ...state.alerts },
    },
    recentEventsSample: state.recentStructured.slice(0, 25),
  };
}

/**
 * Expone contadores para Prometheus (text/plain).
 */
export function renderGenesisPrometheusMetrics() {
  const m = state;
  const lines = [
    '# HELP genesis_p2p_trades_settled_total P2P trades settled (counter).',
    '# TYPE genesis_p2p_trades_settled_total counter',
    `genesis_p2p_trades_settled_total ${m.p2p.tradesSettled}`,
    '# HELP genesis_p2p_volume_aig_sum Sum of AIG notional settled.',
    '# TYPE genesis_p2p_volume_aig_sum counter',
    `genesis_p2p_volume_aig_sum ${m.p2p.volumeAigSum}`,
    '# HELP genesis_p2p_volume_usd_notional_sum Sum of USD notional in P2P settlements.',
    '# TYPE genesis_p2p_volume_usd_notional_sum counter',
    `genesis_p2p_volume_usd_notional_sum ${m.p2p.volumeUsdNotionalSum}`,
    '# HELP genesis_rewards_bonus_created_total Bonus grant events.',
    '# TYPE genesis_rewards_bonus_created_total counter',
    `genesis_rewards_bonus_created_total ${m.rewards.bonusCreated}`,
    '# HELP genesis_rewards_wallet_claims_total Unified wallet claim count.',
    '# TYPE genesis_rewards_wallet_claims_total counter',
    `genesis_rewards_wallet_claims_total ${m.rewards.walletClaims}`,
    '# HELP genesis_rewards_claimed_usd_sum Total USD claimed to wallet (unified flow).',
    '# TYPE genesis_rewards_claimed_usd_sum counter',
    `genesis_rewards_claimed_usd_sum ${m.rewards.claimedUsdSum}`,
    '# HELP genesis_legacy_claims_total Legacy /claim direct|binary|mining.',
    '# TYPE genesis_legacy_claims_total counter',
    `genesis_legacy_claims_total ${m.wallet.legacyClaims}`,
    '# HELP genesis_errors_total Domain errors recorded.',
    '# TYPE genesis_errors_total counter',
    `genesis_errors_total ${m.errors.total}`,
    '# HELP genesis_ledger_drift_alerts_total Ledger vs wallet drift detections.',
    '# TYPE genesis_ledger_drift_alerts_total counter',
    `genesis_ledger_drift_alerts_total ${m.alerts.ledgerDrift}`,
    '# HELP genesis_critical_alerts_total Critical failures (5xx, explicit).',
    '# TYPE genesis_critical_alerts_total counter',
    `genesis_critical_alerts_total ${m.alerts.critical}`,
  ];
  return `${lines.join('\n')}\n`;
}
