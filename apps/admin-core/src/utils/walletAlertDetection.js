/** @typedef {'high' | 'medium' | 'low'} AlertSeverity */

/** Reglas por defecto si falta config o proyecto antiguo. */
export const DEFAULT_WALLET_MONITORING = {
  enabled: true,
  highAmountUsd: 5000,
  highAmountAig: 30000,
  rapidActivityHours: 24,
  rapidActivityMinMoves: 3,
  userRejectedWithdrawalsMin: 2,
};

const SEVERITY_RANK = /** @type {Record<AlertSeverity, number>} */ ({
  high: 3,
  medium: 2,
  low: 1,
});

const USD_LIKE = new Set(['USDT', 'USD', 'USDC', 'BUSD']);

/**
 * @param {object | null | undefined} projectConfig
 */
export function mergeWalletMonitoring(projectConfig) {
  const wm = projectConfig?.walletMonitoring;
  if (!wm || typeof wm !== 'object') return { ...DEFAULT_WALLET_MONITORING };
  return { ...DEFAULT_WALLET_MONITORING, ...wm };
}

function rowTimeMs(row) {
  const t = new Date(row.createdAt || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * @param {Record<string, { severity: AlertSeverity, reasons: object[] }>} byRowId
 * @param {string} rowId
 * @param {{ type: string, severity: AlertSeverity, label: string }} alert
 */
function addAlert(byRowId, rowId, alert) {
  if (!byRowId[rowId]) {
    byRowId[rowId] = { severity: alert.severity, reasons: [alert] };
    return;
  }
  byRowId[rowId].reasons.push(alert);
  if (SEVERITY_RANK[alert.severity] > SEVERITY_RANK[byRowId[rowId].severity]) {
    byRowId[rowId].severity = alert.severity;
  }
}

/**
 * Motor puro: reglas exchange (monto, ráfaga, historial rechazos).
 * @param {object[]} ledger — ledger completo del proyecto
 * @param {object | null | undefined} projectConfig
 * @returns {{
 *   byRowId: Record<string, { severity: AlertSeverity, reasons: { type: string, severity: AlertSeverity, label: string }[] }>,
 *   summary: { totalFlagged: number, high: number, medium: number, low: number, byRule: Record<string, number> },
 * }}
 */
export function computeWalletAlerts(ledger, projectConfig) {
  const wm = mergeWalletMonitoring(projectConfig);
  const emptySummary = { totalFlagged: 0, high: 0, medium: 0, low: 0, byRule: {} };

  if (wm.enabled === false) {
    return { byRowId: {}, summary: emptySummary };
  }

  const list = Array.isArray(ledger) ? ledger : [];
  /** @type {Record<string, { severity: AlertSeverity, reasons: { type: string, severity: AlertSeverity, label: string }[] }>} */
  const byRowId = {};

  const highUsd = Number(wm.highAmountUsd) || DEFAULT_WALLET_MONITORING.highAmountUsd;
  const highAig = Number(wm.highAmountAig) || DEFAULT_WALLET_MONITORING.highAmountAig;
  const minRejects = Number(wm.userRejectedWithdrawalsMin) || DEFAULT_WALLET_MONITORING.userRejectedWithdrawalsMin;
  const winH = Number(wm.rapidActivityHours) || DEFAULT_WALLET_MONITORING.rapidActivityHours;
  const minMoves = Math.max(2, Number(wm.rapidActivityMinMoves) || DEFAULT_WALLET_MONITORING.rapidActivityMinMoves);
  const windowMs = Math.max(1, winH) * 3600000;

  const isUsdLike = (asset) => USD_LIKE.has(String(asset || '').toUpperCase());

  for (const row of list) {
    const amt = Number(row.amount);
    if (!Number.isFinite(amt)) continue;

    if (isUsdLike(row.asset) && amt >= highUsd) {
      const sev =
        row.type === 'withdrawal' && row.status === 'pending'
          ? 'high'
          : row.type === 'withdrawal'
            ? 'medium'
            : 'medium';
      addAlert(byRowId, row.id, {
        type: 'high_amount',
        severity: sev,
        label: `Monto elevado USDT/USD (≥ ${highUsd.toLocaleString()})`,
      });
    } else if (String(row.asset || '').toUpperCase() === 'AIG' && amt >= highAig) {
      const sev = row.type === 'withdrawal' && row.status === 'pending' ? 'high' : 'medium';
      addAlert(byRowId, row.id, {
        type: 'high_amount',
        severity: sev,
        label: `Monto elevado AIG (≥ ${highAig.toLocaleString()})`,
      });
    }
  }

  const rejectCountByUser = {};
  for (const row of list) {
    if (row.type === 'withdrawal' && row.status === 'rejected') {
      rejectCountByUser[row.userId] = (rejectCountByUser[row.userId] || 0) + 1;
    }
  }
  for (const row of list) {
    const uid = row.userId;
    const rc = rejectCountByUser[uid] || 0;
    if (rc < minRejects) continue;
    if (row.type === 'withdrawal' && row.status === 'pending') {
      addAlert(byRowId, row.id, {
        type: 'reject_history',
        severity: 'high',
        label: `Usuario con ${rc} retiro(s) rechazado(s) (umbral ${minRejects})`,
      });
    } else if (row.type === 'withdrawal' && row.status === 'rejected') {
      addAlert(byRowId, row.id, {
        type: 'reject_history',
        severity: 'medium',
        label: 'Retiro rechazado (patrón de rechazos)',
      });
    }
  }

  const byUser = new Map();
  for (const row of list) {
    if (!byUser.has(row.userId)) byUser.set(row.userId, []);
    byUser.get(row.userId).push(row);
  }

  for (const [, userRows] of byUser) {
    const sorted = [...userRows].sort((a, b) => rowTimeMs(a) - rowTimeMs(b));
    let start = 0;
    for (let i = 0; i < sorted.length; i++) {
      const tI = rowTimeMs(sorted[i]);
      while (start < i && tI - rowTimeMs(sorted[start]) > windowMs) {
        start++;
      }
      const count = i - start + 1;
      if (count >= minMoves) {
        for (let k = start; k <= i; k++) {
          addAlert(byRowId, sorted[k].id, {
            type: 'rapid_activity',
            severity: 'medium',
            label: `Actividad repetida: ${count} mov. en ${winH}h`,
          });
        }
      }
    }
  }

  let high = 0;
  let medium = 0;
  let low = 0;
  /** @type {Record<string, number>} */
  const byRule = {};

  const ids = Object.keys(byRowId);
  for (const id of ids) {
    const meta = byRowId[id];
    if (meta.severity === 'high') high++;
    else if (meta.severity === 'medium') medium++;
    else low++;
    for (const r of meta.reasons) {
      byRule[r.type] = (byRule[r.type] || 0) + 1;
    }
  }

  return {
    byRowId,
    summary: {
      totalFlagged: ids.length,
      high,
      medium,
      low,
      byRule,
    },
  };
}

/**
 * Cuenta alertas visibles tras filtros de tabla.
 * @param {object[]} filteredRows
 * @param {Record<string, unknown>} byRowId
 */
export function countAlertsInView(filteredRows, byRowId) {
  let n = 0;
  for (const r of filteredRows) {
    if (byRowId[r.id]) n++;
  }
  return n;
}
