/**
 * Winxplay: dashboardUpdate → NEW_SIGNAL / NEW_RESULT normalizado (sin `raw`; tamaño acotado para admin-signals).
 *
 * @param {unknown} payload
 * @returns {{ type: 'NEW_SIGNAL' | 'NEW_RESULT', data: Record<string, unknown> } | null}
 */

/** @param {...unknown} vals */
function pickFirstDefined(...vals) {
  for (const v of vals) {
    if (v != null && String(v).trim() !== '') return v;
  }
  return null;
}

/**
 * Ronda de mesa en envelopes Winxplay (raíz, data, data.signal, data_evento).
 * @param {Record<string, unknown>} d — `payload.data`
 * @param {Record<string, unknown>} p — `payload` raíz
 */
function resolveWinxNewSignalRound(d, p) {
  const inner =
    d.data != null && typeof d.data === 'object' && !Array.isArray(d.data)
      ? /** @type {Record<string, unknown>} */ (d.data)
      : null;
  const sig =
    d.signal != null && typeof d.signal === 'object' && !Array.isArray(d.signal)
      ? /** @type {Record<string, unknown>} */ (d.signal)
      : inner?.signal != null && typeof inner.signal === 'object' && !Array.isArray(inner.signal)
        ? /** @type {Record<string, unknown>} */ (inner.signal)
        : null;
  const evRaw = sig?.data_evento ?? sig?.data_event ?? d.data_evento ?? d.data_event ?? p.data_evento ?? p.data_event;
  const ev =
    evRaw != null && typeof evRaw === 'object' && !Array.isArray(evRaw)
      ? /** @type {Record<string, unknown>} */ (evRaw)
      : null;

  return pickFirstDefined(
    d.round,
    p.round,
    d.ronda,
    p.ronda,
    d.ronda_actual,
    p.ronda_actual,
    d.Ronda,
    p.Ronda,
    inner?.ronda,
    inner?.ronda_actual,
    sig?.ronda_actual,
    sig?.gameRound,
    sig?.ronda,
    sig?.ronda_objetivo,
    ev?.Ronda,
    ev?.ronda,
    ev?.round,
  );
}

/**
 * @param {Record<string, unknown>} d
 * @param {Record<string, unknown>} p
 * @param {Record<string, unknown> | null} sig
 */
function resolveWinxNewSignalId(d, p, sig) {
  const id = pickFirstDefined(p.id, d.id, sig?.id, sig?.signalId);
  if (id != null) return id;
  return Date.now();
}

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
      const inner =
        d.data != null && typeof d.data === 'object' && !Array.isArray(d.data)
          ? /** @type {Record<string, unknown>} */ (d.data)
          : null;
      const sig =
        d.signal != null && typeof d.signal === 'object' && !Array.isArray(d.signal)
          ? /** @type {Record<string, unknown>} */ (d.signal)
          : inner?.signal != null && typeof inner.signal === 'object' && !Array.isArray(inner.signal)
            ? /** @type {Record<string, unknown>} */ (inner.signal)
            : null;

      const roundResolved = resolveWinxNewSignalRound(d, p);
      const idResolved = resolveWinxNewSignalId(d, p, sig);
      const rec = pickFirstDefined(
        d.forecast,
        d.recommendation,
        p.forecast,
        p.recommendation,
        sig?.recommendation,
        sig?.forecast,
        sig?.signal,
        sig?.side,
        sig?.prediction,
      );

      // Conservar anidamiento (`signal`, `data`, data_evento…) para normalizeNewSignalPayload;
      // además fijar `round` / `id` en raíz del relay para dedupe y cliente.
      return {
        type: 'NEW_SIGNAL',
        data: {
          ...d,
          id: idResolved,
          mesa: pickFirstDefined(d.mesa, p.mesa, sig?.nombre_mesa, sig?.tableName) ?? d.mesa ?? p.mesa,
          recommendation: rec ?? d.recommendation ?? p.recommendation,
          martingale: d.martingale ?? p.martingale ?? sig?.martingale,
          round: roundResolved ?? d.round ?? p.round ?? d.ronda ?? p.ronda,
        },
      };
    }

    if (t === 'NEW_RESULT') {
      try {
        console.log('🔥 RAW PROVIDER RESULT', JSON.stringify(payload));
      } catch {
        console.log('🔥 RAW PROVIDER RESULT', '(non-serializable)');
      }
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
          round: d.round ?? mesa_info?.ronda_objetivo ?? mesa_info?.ronda_actual,
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
