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
      const innerData = d.data != null && typeof d.data === 'object' && !Array.isArray(d.data) ? d.data : {};
      const resultsObj =
        innerData.results != null && typeof innerData.results === 'object' && !Array.isArray(innerData.results)
          ? innerData.results
          : {};
      const mesa_info =
        resultsObj.mesa_info != null && typeof resultsObj.mesa_info === 'object' && !Array.isArray(resultsObj.mesa_info)
          ? /** @type {Record<string, unknown>} */ (resultsObj.mesa_info)
          : null;

      /** @type {Record<string, unknown> | null} */
      let scoreDetail = null;
      if (mesa_info) {
        const cpp = mesa_info.cartas_player;
        const cbk = mesa_info.cartas_banker;
        const tab = mesa_info.tablero;
        const mg = mesa_info.martingala ?? mesa_info.martingale;
        const martingala =
          mg != null && mg !== '' && Number.isFinite(Number(mg))
            ? Math.trunc(Number(mg))
            : mg != null && mg !== '' && !Number.isNaN(Number(mg))
              ? Number(mg)
              : null;
        scoreDetail = {
          puntaje_player: mesa_info.puntaje_player != null ? String(mesa_info.puntaje_player) : null,
          puntaje_banker: mesa_info.puntaje_banker != null ? String(mesa_info.puntaje_banker) : null,
          cartas_player: Array.isArray(cpp) ? cpp.map((x) => String(x)) : null,
          cartas_banker: Array.isArray(cbk) ? cbk.map((x) => String(x)) : null,
          ganador: mesa_info.ganador != null ? String(mesa_info.ganador) : null,
          tablero: Array.isArray(tab) ? tab : null,
          martingala,
        };
      }

      const ganador = (mesa_info?.ganador != null ? String(mesa_info.ganador) : null) ?? d.result ?? p.result;

      return {
        type: 'NEW_RESULT',
        data: {
          mesa: d.mesa,
          ganador,
          winStatus: d.winStatus ?? p.winStatus,
          round: d.round ?? mesa_info?.ronda_actual ?? mesa_info?.ronda_objetivo,
          historial: Array.isArray(d.history) ? d.history : Array.isArray(mesa_info?.tablero) ? mesa_info.tablero : [],
          scoreDetail,
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
