/**
 * Normaliza vista operativa desde runtime (rawEvents) o sesiones forenses (inicio / final).
 * Solo lectura — no transforma el motor ni el ingest.
 */

function empty() {
  return {
    mesa: '—',
    roundSignal: '—',
    roundResult: '—',
    side: '—',
    algorithm: '—',
    forecast: [],
    playerCards: [],
    bankerCards: [],
    playerScore: 0,
    bankerScore: 0,
    winner: null,
    history: [],
    martingale: { active: false, level: 0 },
  };
}

/** Cuerpo útil: evento socket o fila `{ type, payload }` de sesión completada. */
function envelopeBody(ev) {
  if (ev == null || typeof ev !== 'object' || Array.isArray(ev)) return ev;
  if (ev.payload != null && typeof ev.payload === 'object' && !Array.isArray(ev.payload)) {
    return ev.payload;
  }
  return ev;
}

/** Prioridad proveedor (resultado): ronda_objetivo (cierra la señal) → data_evento → ronda_actual último. */
function roundFromMesaInfoForensic(mi) {
  if (mi == null || typeof mi !== 'object' || Array.isArray(mi)) return null;
  const de = mi.data_evento ?? mi.data_event;
  const rondaEvt =
    de != null && typeof de === 'object' && !Array.isArray(de)
      ? de.Ronda ?? de.ronda ?? de.round
      : null;
  const v = mi.ronda_objetivo ?? rondaEvt ?? mi.Ronda ?? mi.round ?? mi.ronda_actual;
  if (v == null || String(v).trim() === '') return null;
  return v;
}

/**
 * @param {unknown} cycle
 */
export function normalizeCycle(cycle) {
  if (!cycle) return empty();

  let signalPayload = null;
  let resultPayload = null;

  // CASO 1: runtime (engine real)
  if (Array.isArray(cycle.rawEvents)) {
    for (const ev of cycle.rawEvents) {
      const type = String(ev?.type ?? ev?.data?.type ?? '').trim().toUpperCase();
      if (type === 'NEW_SIGNAL') signalPayload = ev;
      if (type === 'NEW_RESULT') resultPayload = ev;
    }
  }

  // CASO 2: sesiones (capturas)
  if (!signalPayload) signalPayload = cycle?.inicio?.payload;
  if (!resultPayload) resultPayload = cycle?.final?.payload;

  const sp = envelopeBody(signalPayload);
  const rp = envelopeBody(resultPayload);

  const signal =
    (sp?.data?.data?.signal && typeof sp.data.data.signal === 'object' ? sp.data.data.signal : null) ||
    (sp?.data?.signal && typeof sp.data.signal === 'object' ? sp.data.signal : null) ||
    {};

  const mesaInfoRaw =
    rp?.data?.data?.results?.mesa_info ??
    rp?.data?.results?.mesa_info ??
    rp?.results?.mesa_info;
  let mesaInfo =
    mesaInfoRaw != null && typeof mesaInfoRaw === 'object' && !Array.isArray(mesaInfoRaw) ? mesaInfoRaw : {};
  if (!Object.keys(mesaInfo).length && rp?.data?.scoreDetail && typeof rp.data.scoreDetail === 'object') {
    mesaInfo = rp.data.scoreDetail;
  }

  const apuesta = mesaInfo?.data_evento?.Apuesta;
  let side = '—';
  if (apuesta != null && String(apuesta).trim() !== '') {
    const a = String(apuesta).toUpperCase();
    if (a.includes('BANK')) side = 'BANKER';
    else if (a.includes('PLAY')) side = 'PLAYER';
    else side = String(apuesta);
  } else {
    side =
      signal?.vector_forecast?.[0] === 'P' || String(signal?.vector_forecast?.[0]).toUpperCase() === 'P'
        ? 'PLAYER'
        : 'BANKER';
  }

  let winner = mesaInfo?.ganador != null ? String(mesaInfo.ganador) : null;
  if (winner) {
    const u = winner.toUpperCase();
    if (u.includes('BANK')) winner = 'BANKER';
    else if (u.includes('PLAY')) winner = 'PLAYER';
    else if (u.includes('TIE') || u.includes('EMPATE')) winner = 'TIE';
  }

  const vf =
    signal?.vector_forecast ??
    (Array.isArray(cycle.signalPayload?.vector_forecast) ? cycle.signalPayload.vector_forecast : null) ??
    (Array.isArray(cycle.signalPayload?.forecast) ? cycle.signalPayload.forecast : null);
  const forecast = Array.isArray(vf) ? vf.map((x) => String(x)) : [];

  return {
    mesa: signal?.nombre_mesa || mesaInfo?.data_evento?.mesa || cycle.mesa || cycle.signalPayload?.mesa || '—',

    roundSignal:
      signal?.ronda_actual ??
      sp?.data?.data?.ronda ??
      sp?.data?.ronda ??
      cycle.signalPayload?.round ??
      cycle.signalPayload?.roundId ??
      cycle.round ??
      '—',

    roundResult: roundFromMesaInfoForensic(mesaInfo) ?? '—',

    side,

    algorithm:
      signal?.nombre_algoritmo || mesaInfo?.martingala?.nombre_patron || cycle.signalPayload?.algorithm || '—',

    forecast,

    playerCards: (mesaInfo?.cartas_player || []).slice(0, 3),
    bankerCards: (mesaInfo?.cartas_banker || []).slice(0, 3),

    playerScore: Number(mesaInfo?.puntaje_player) || 0,
    bankerScore: Number(mesaInfo?.puntaje_banker) || 0,

    winner,

    history: (mesaInfo?.tablero || []).slice(-10),

    martingale: {
      active: Boolean(mesaInfo?.martingala?.active),
      level: Number(mesaInfo?.martingala?.contador_martingala) || 0,
    },
  };
}
