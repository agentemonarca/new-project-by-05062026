/**
 * Winxplay: dashboardUpdate → NEW_SIGNAL / NEW_RESULT normalizado (sin `raw`; tamaño acotado para admin-signals).
 *
 * @param {unknown} payload
 * @returns {{ type: 'NEW_SIGNAL' | 'NEW_RESULT', data: Record<string, unknown> } | null}
 */
export function tryWinxplayDashboardRelay(payload) {
  try {
    if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const p = /** @type {Record<string, unknown>} */ (payload);
    const d =
      p.data != null && typeof p.data === 'object' && !Array.isArray(p.data)
        ? /** @type {Record<string, unknown>} */ (p.data)
        : /** @type {Record<string, unknown>} */ ({});

    if (isWinxplayDebugStreamEnabled()) {
      try {
        console.log('[WINX RAW]', JSON.stringify(payload).slice(0, 500));
      } catch {
        console.log('[WINX RAW]', '(non-serializable)');
      }
    }

    const typeStr = String(p.type ?? d.type ?? '').trim();
    if (!typeStr) return null;

    const t = typeStr.toUpperCase();

    if (t === 'NEW_SIGNAL') {
      return {
        type: 'NEW_SIGNAL',
        data: {
          id: p.id ?? Date.now(),
          mesa: d.mesa ?? p.mesa,
          recommendation: d.forecast ?? p.forecast,
          martingale: d.martingale,
          round: d.round ?? p.round,
        },
      };
    }

    if (t === 'NEW_RESULT') {
      return {
        type: 'NEW_RESULT',
        data: {
          mesa: d.mesa,
          ganador: d.result,
          winStatus: d.winStatus,
          round: d.round,
          historial: Array.isArray(d.history) ? d.history : [],
        },
      };
    }

    return null;
  } catch {
    return null;
  }
}

export const isWinxplayDebugStreamEnabled = () => {
  return ['1', 'true'].includes(String(process.env.WINXPLAY_DEBUG_STREAM).toLowerCase());
};
