/**
 * Modelo canónico forense SignalSession (RAW + normalizado derivado).
 * Extracción principal: payload.data.data.results.mesa_info (Winxplay y análogos).
 * Contrato: nunca lanza; campos ausentes → null.
 */
import { normalizeNewSignalPayload } from './signalNormalize.js';

/** @param {unknown} v */
export function asRecord(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? /** @type {Record<string, unknown>} */ (v) : null;
}

/**
 * Localiza `results.mesa_info` en envelopes anidados.
 * @param {unknown} rawPayload
 * @returns {Record<string, unknown> | null}
 */
export function findMesaInfoInPayload(rawPayload) {
  const r = asRecord(rawPayload) ?? {};
  const d = asRecord(r.data) ?? {};
  const inner = asRecord(d.data) ?? {};
  const results =
    asRecord(inner.results) ??
    asRecord(r.results) ??
    asRecord(d.results) ??
    null;
  if (!results) return null;
  const mesa_info = asRecord(results.mesa_info);
  return mesa_info;
}

/**
 * @param {Record<string, unknown>} mesa_info
 */
export function normalizeMesaInfoFields(mesa_info) {
  const cpp = mesa_info.cartas_player;
  const cbk = mesa_info.cartas_banker;
  const tab = mesa_info.tablero;
  const mg = mesa_info.martingala ?? mesa_info.martingale;
  const n =
    mg != null && mg !== '' && typeof mg === 'object'
      ? null
      : mg != null && mg !== '' && Number.isFinite(Number(mg))
        ? Math.trunc(Number(mg))
        : mg != null && mg !== '' && !Number.isNaN(Number(mg))
          ? Number(mg)
          : null;
  return {
    puntaje_player: mesa_info.puntaje_player != null ? String(mesa_info.puntaje_player) : null,
    puntaje_banker: mesa_info.puntaje_banker != null ? String(mesa_info.puntaje_banker) : null,
    cartas_player: Array.isArray(cpp) ? cpp.map((x) => String(x)) : null,
    cartas_banker: Array.isArray(cbk) ? cbk.map((x) => String(x)) : null,
    ganador: mesa_info.ganador != null ? String(mesa_info.ganador) : null,
    tablero: Array.isArray(tab) ? tab : null,
    martingala: n,
    ronda_actual: mesa_info.ronda_actual != null ? String(mesa_info.ronda_actual) : null,
    ronda_objetivo: mesa_info.ronda_objetivo != null ? String(mesa_info.ronda_objetivo) : null,
  };
}

/**
 * @param {unknown} rawPayload
 * @returns {ReturnType<typeof normalizeMesaInfoFields> | null}
 */
export function extractMesaInfoFromPayload(rawPayload) {
  const mi = findMesaInfoInPayload(rawPayload);
  return mi ? normalizeMesaInfoFields(mi) : null;
}

/** @param {unknown} v */
function toFiniteNumberOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** @param {string | null | undefined} s */
function normWinnerSide(s) {
  const u = String(s ?? '')
    .trim()
    .toUpperCase();
  if (u === 'B' || u.startsWith('BANK')) return 'BANKER';
  if (u === 'P' || u.startsWith('PLAY')) return 'PLAYER';
  if (u === 'T' || u.startsWith('TIE') || u === 'E' || u.startsWith('EMP')) return 'TIE';
  if (!u) return null;
  return u;
}

/** @param {string | null | undefined} s */
function normSignalSide(s) {
  const u = String(s ?? '')
    .trim()
    .toUpperCase();
  if (u === 'B' || u.startsWith('BANK')) return 'BANKER';
  if (u === 'P' || u.startsWith('PLAY')) return 'PLAYER';
  if (u === 'T' || u.startsWith('TIE')) return 'TIE';
  if (!u || u === 'UNKNOWN') return null;
  return u;
}

/**
 * Veredicto operativo: coincide señal vs ganador (empate explícito).
 * @param {string | null | undefined} signalSideNorm PLAYER|BANKER|TIE|null
 * @param {string | null | undefined} winnerNorm PLAYER|BANKER|TIE|null
 * @returns {'WIN' | 'LOSS' | 'TIE' | null}
 */
function verdictStrict(signalSideNorm, winnerNorm) {
  if (!winnerNorm) return null;
  if (winnerNorm === 'TIE') return 'TIE';
  if (!signalSideNorm || (signalSideNorm !== 'PLAYER' && signalSideNorm !== 'BANKER')) return null;
  if (winnerNorm !== 'PLAYER' && winnerNorm !== 'BANKER') return null;
  return signalSideNorm === winnerNorm ? 'WIN' : 'LOSS';
}

/** @param {unknown} payload */
function envelopeTriplet(payload) {
  const r = asRecord(payload) ?? {};
  const d = asRecord(r.data) ?? {};
  const inner = asRecord(d.data) ?? {};
  return { r, d, inner };
}

/**
 * Clon forense del proveedor (sin truncar). structuredClone > JSON > referencia.
 * @param {unknown} payload
 */
export function forensicPreservePayload(payload) {
  try {
    if (payload == null || typeof payload !== 'object') return payload;
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(payload);
      } catch {
        /* fall through */
      }
    }
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return payload;
  }
}

/**
 * Modelo canónico único (contrato frontend + GPulse).
 *
 * @param {{
 *   signalEvent: Record<string, unknown> | null | undefined,
 *   resultEvent: Record<string, unknown> | null | undefined,
 *   sessionMeta: Record<string, unknown> | null | undefined,
 *   rawEvents: unknown[] | null | undefined
 * }} args
 */
export function buildCanonicalSignalSession({ signalEvent, resultEvent, sessionMeta, rawEvents }) {
  const empty = () => ({
    meta: {
      mesa: null,
      round_signal: null,
      round_result: null,
      timestampStart: null,
      timestampEnd: null,
      durationMs: null,
    },
    signal: {
      side: null,
      algorithm: null,
      forecast: null,
    },
    result: {
      winner: null,
      player: { score: null, cards: null },
      banker: { score: null, cards: null },
    },
    engine: {
      martingale: { active: null, level: null },
      verdict: null,
    },
    history: {
      road: null,
    },
    raw: {
      events: [],
    },
  });

  try {
    const sm = sessionMeta && typeof sessionMeta === 'object' ? sessionMeta : {};
    const sigEv = signalEvent && typeof signalEvent === 'object' ? signalEvent : null;
    const resEv = resultEvent && typeof resultEvent === 'object' ? resultEvent : null;

    const signalRaw = sigEv && 'raw' in sigEv ? sigEv.raw : null;
    const resultRaw = resEv && 'raw' in resEv ? resEv.raw : null;

    const normSig =
      signalRaw != null && typeof signalRaw === 'object'
        ? normalizeNewSignalPayload(signalRaw)
        : null;

    const { r: rr, d: rd, inner: ri } = envelopeTriplet(resultRaw);
    const mesa_info = findMesaInfoInPayload(resultRaw) ?? null;
    const mi = mesa_info ?? /** @type {Record<string, unknown>} */ ({});

    const data_ev = asRecord(mi.data_evento) ?? {};
    const mart_blk = asRecord(mi.martingala) ?? {};

    const round_signal =
      data_ev.Ronda != null
        ? String(data_ev.Ronda)
        : data_ev.ronda != null
          ? String(data_ev.ronda)
          : sigEv?.round != null
            ? String(sigEv.round)
            : sm.round != null
              ? String(sm.round)
              : normSig?.round != null
                ? String(normSig.round)
                : null;

    const round_result =
      mi.ronda_actual != null
        ? String(mi.ronda_actual)
        : mi.ronda_objetivo != null
          ? String(mi.ronda_objetivo)
          : null;

    const mesa_from_mi =
      mi.nombre_mesa != null
        ? String(mi.nombre_mesa).trim() || null
        : mi.nombreMesa != null
          ? String(mi.nombreMesa).trim() || null
          : null;
    const mi_data = asRecord(mi.data);
    const mesa_from_mi_data = mi_data?.mesa != null ? String(mi_data.mesa).trim() || null : null;
    const mesa =
      mesa_from_mi ??
      mesa_from_mi_data ??
      (rd.mesa != null ? String(rd.mesa).trim() || null : null) ??
      (rr.mesa != null ? String(rr.mesa).trim() || null : null) ??
      (sm.mesa != null ? String(sm.mesa).trim() || null : null) ??
      (normSig?.mesa ? String(normSig.mesa).trim() || null : null) ??
      null;

    const apuesta_raw = data_ev.Apuesta ?? data_ev.apuesta ?? null;
    const side_from_ev = normSignalSide(apuesta_raw != null ? String(apuesta_raw) : '');
    const side_from_norm = normSig?.recommendation
      ? normSignalSide(normSig.recommendation)
      : null;
    const side = side_from_ev ?? side_from_norm;

    const forecastVal =
      mart_blk.vector_forecast != null
        ? mart_blk.vector_forecast
        : mart_blk.vectorForecast != null
          ? mart_blk.vectorForecast
          : null;

    const algorithm =
      mart_blk.nombre_patron != null
        ? String(mart_blk.nombre_patron)
        : mart_blk.nombrePatron != null
          ? String(mart_blk.nombrePatron)
          : null;

    const puntaje_player_raw = mi.puntaje_player;
    const puntaje_banker_raw = mi.puntaje_banker;
    const cpp = mi.cartas_player;
    const cbk = mi.cartas_banker;
    const playerScore = toFiniteNumberOrNull(puntaje_player_raw);
    const bankerScore = toFiniteNumberOrNull(puntaje_banker_raw);
    const playerCards = Array.isArray(cpp) ? cpp.map((x) => String(x)) : null;
    const bankerCards = Array.isArray(cbk) ? cbk.map((x) => String(x)) : null;

    const ganador_raw =
      mi.ganador ?? (rd && 'result' in rd ? rd.result : null) ?? (rr && 'result' in rr ? rr.result : null) ?? (ri && 'result' in ri ? ri.result : null) ?? null;
    const winner = normWinnerSide(ganador_raw != null ? String(ganador_raw) : '');

    const tab = mi.tablero;
    const road = Array.isArray(tab) ? tab : null;

    let level =
      mart_blk.contador_martingala != null
        ? toFiniteNumberOrNull(mart_blk.contador_martingala)
        : mart_blk.contadorMartingala != null
          ? toFiniteNumberOrNull(mart_blk.contadorMartingala)
          : null;
    if (level == null && typeof mi.martingala === 'number') level = toFiniteNumberOrNull(mi.martingala);
    if (level == null && mi.martingala != null && typeof mi.martingala !== 'object')
      level = toFiniteNumberOrNull(mi.martingala);

    let active = null;
    if (mart_blk.active === true || mart_blk.active === false) active = mart_blk.active;
    else if (mart_blk.activa === true || mart_blk.activa === false) active = mart_blk.activa;
    else if (level != null && level > 0) active = true;
    else if (level != null && level === 0) active = false;

    const verdict = verdictStrict(side, winner);

    const tsStart = sm.openedAt != null ? Number(sm.openedAt) : null;
    const tsEnd = sm.closedAt != null ? Number(sm.closedAt) : null;
    const durationMs = sm.durationMs != null ? Number(sm.durationMs) : sm.duration != null ? Number(sm.duration) : null;

    const evList = Array.isArray(rawEvents) ? rawEvents : [];

    return {
      meta: {
        mesa,
        round_signal,
        round_result,
        timestampStart: tsStart != null && Number.isFinite(tsStart) ? tsStart : null,
        timestampEnd: tsEnd != null && Number.isFinite(tsEnd) ? tsEnd : null,
        durationMs: durationMs != null && Number.isFinite(durationMs) ? durationMs : null,
      },
      signal: {
        side,
        algorithm,
        forecast: forecastVal ?? null,
      },
      result: {
        winner,
        player: { score: playerScore, cards: playerCards },
        banker: { score: bankerScore, cards: bankerCards },
      },
      engine: {
        martingale: { active, level },
        verdict,
      },
      history: {
        road,
      },
      raw: {
        events: evList.slice(),
      },
    };
  } catch {
    return empty();
  }
}

/**
 * Adaptador tracker interno → parámetros de `buildCanonicalSignalSession`.
 * @param {Record<string, unknown>} internalSession
 */
export function buildCanonicalSignalSessionFromInternalSession(internalSession) {
  const events = Array.isArray(internalSession?.events) ? internalSession.events : [];
  const signalEvent =
    events.find(
      (ev) =>
        String(ev?.eventName || '') === 'NEW_SIGNAL' ||
        String(ev?.payloadType || '').toUpperCase() === 'NEW_SIGNAL',
    ) ?? null;
  const resultEvent =
    [...events].reverse().find(
      (ev) =>
        String(ev?.eventName || '') === 'NEW_RESULT' ||
        String(ev?.payloadType || '').toUpperCase() === 'NEW_RESULT',
    ) ?? null;

  const sessionMeta = {
    mesa: internalSession?.mesa ?? null,
    round: internalSession?.round ?? null,
    openedAt: internalSession?.openedAt ?? null,
    closedAt: internalSession?.closedAt ?? null,
    duration: internalSession?.duration ?? null,
    durationMs: internalSession?.duration ?? null,
    internalId: internalSession?.internalId ?? null,
    providerSignalId: internalSession?.id ?? null,
  };

  return buildCanonicalSignalSession({
    signalEvent,
    resultEvent,
    sessionMeta,
    rawEvents: events,
  });
}
