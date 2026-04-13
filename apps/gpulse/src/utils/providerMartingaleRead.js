/**
 * Read-only helpers for provider martingale / vector fields (aligned with core-api `signalNormalize.js`).
 */

/** @param {...unknown} vals */
function pickFirst(...vals) {
  for (const v of vals) {
    if (v != null && String(v).trim() !== '') return v;
  }
  return null;
}

/**
 * Index into `vector_forecast` for `contador_martingala` (6 steps → indices 0–5).
 * Mirror: backend `forecastStepIndexFromContador`.
 * @param {unknown} contador
 */
export function forecastStepIndexFromContador(contador) {
  if (contador == null || contador === '') return 0;
  const n = Number(contador);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n <= 1) return 0;
  return Math.max(0, Math.min(5, Math.floor(n) - 1));
}

/**
 * @param {unknown} cell
 * @returns {'PLAYER' | 'BANKER' | 'TIE' | null}
 */
export function forecastCellToSide(cell) {
  if (cell == null) return null;
  const s = String(cell).trim().toUpperCase();
  if (s === '') return null;
  if (s === 'P' || s.startsWith('PLAY')) return 'PLAYER';
  if (s === 'B' || s.startsWith('BANK')) return 'BANKER';
  if (s === 'E' || s === 'T' || s.startsWith('TIE')) return 'TIE';
  return null;
}

/**
 * Prediction = vector_forecast[ index(contador_martingala) ].
 * @param {unknown[]} vector
 * @param {unknown} contadorMartingala
 * @returns {'PLAYER' | 'BANKER' | 'TIE' | null}
 */
export function predictionSideFromVectorAndContador(vector, contadorMartingala) {
  if (!Array.isArray(vector) || vector.length === 0) return null;
  const idx = forecastStepIndexFromContador(contadorMartingala);
  const safeIdx = Math.min(idx, vector.length - 1);
  return forecastCellToSide(vector[safeIdx]);
}

/** Single place for UI: side from NEW_SIGNAL `rawSignal` only (no store `recommendation`). */
export function predictionSideFromRawSignal(rawSignal) {
  if (!rawSignal || typeof rawSignal !== 'object' || Array.isArray(rawSignal)) return null;
  const r = /** @type {Record<string, unknown>} */ (rawSignal);
  const vf = extractVectorForecastArrayFromSignalRaw(r);
  const cm = pickContadorMartingalaFromSignalRaw(r);
  const contador = cm != null && String(cm).trim() !== '' ? cm : vf.length > 0 ? 1 : null;
  if (contador == null) return null;
  return predictionSideFromVectorAndContador(vf, contador);
}

/** @param {'PLAYER' | 'BANKER' | 'TIE' | null | undefined} side */
export function formatPredictionSideLabel(side) {
  if (side === 'PLAYER' || side === 'BANKER' || side === 'TIE') return side;
  return '—';
}

/** @returns {boolean | null} */
export function parseVectorWinStep(token) {
  if (token === true) return true;
  if (token === false) return false;
  if (token == null) return null;
  const s = String(token).trim().toUpperCase();
  if (s === 'W' || s === 'WIN' || s === '1' || s === 'TRUE' || s === 'SI' || s === 'SÍ') return true;
  if (s === 'L' || s === 'LOSS' || s === '0' || s === 'FALSE' || s === 'NO') return false;
  const n = Number(token);
  if (n === 1) return true;
  if (n === 0 && String(token).trim() !== '') return false;
  return null;
}

/** Fixed martingale depth for UI (provider 6-step cycle). */
export const PROVIDER_MARTINGALE_STEPS = 6;

/**
 * `contador_martingala` from nested signal / mesa_info.martingala (Winx-style).
 * @param {Record<string, unknown>} r
 */
export function pickContadorMartingalaFromSignalRaw(r) {
  const d =
    r.data != null && typeof r.data === 'object' && !Array.isArray(r.data)
      ? /** @type {Record<string, unknown>} */ (r.data)
      : null;
  const d2 =
    d?.data != null && typeof d.data === 'object' && !Array.isArray(d.data)
      ? /** @type {Record<string, unknown>} */ (d.data)
      : null;
  const sig =
    d?.signal != null && typeof d.signal === 'object' && !Array.isArray(d.signal)
      ? /** @type {Record<string, unknown>} */ (d.signal)
      : null;
  const sig2 =
    d2?.signal != null && typeof d2.signal === 'object' && !Array.isArray(d2.signal)
      ? /** @type {Record<string, unknown>} */ (d2.signal)
      : null;

  const fromMart = (s) => {
    if (s == null || typeof s !== 'object' || Array.isArray(s)) return null;
    const m = /** @type {Record<string, unknown>} */ (s).martingala;
    const block = m != null && typeof m === 'object' && !Array.isArray(m) ? m : null;
    return block?.contador_martingala ?? /** @type {Record<string, unknown>} */ (s).contador_martingala;
  };

  return pickFirst(
    fromMart(sig2),
    fromMart(sig),
    sig2?.contador_martingala,
    sig?.contador_martingala,
    d2?.contador_martingala,
    d?.contador_martingala,
    r.contador_martingala,
    r.contadorMartingala,
    sig2?.martingale,
    sig?.martingale,
    r.martingale,
    r.martinGale,
  );
}

/**
 * Full `vector_forecast` array from NEW_SIGNAL-shaped raw (nested paths).
 * @param {Record<string, unknown>} r
 * @returns {unknown[]}
 */
export function extractVectorForecastArrayFromSignalRaw(r) {
  if (Array.isArray(r.vector_forecast)) return r.vector_forecast;
  const d =
    r.data != null && typeof r.data === 'object' && !Array.isArray(r.data)
      ? /** @type {Record<string, unknown>} */ (r.data)
      : null;
  const d2 =
    d?.data != null && typeof d.data === 'object' && !Array.isArray(d.data)
      ? /** @type {Record<string, unknown>} */ (d.data)
      : null;
  const sig =
    d2?.signal != null && typeof d2.signal === 'object' && !Array.isArray(d2.signal)
      ? /** @type {Record<string, unknown>} */ (d2.signal)
      : d?.signal != null && typeof d.signal === 'object' && !Array.isArray(d.signal)
        ? /** @type {Record<string, unknown>} */ (d.signal)
        : null;
  const vf = sig && Array.isArray(sig.vector_forecast) ? sig.vector_forecast : null;
  return vf || [];
}

/** @param {Record<string, unknown> | null | undefined} mart */
function readMartingalaBlock(mart) {
  if (mart == null || typeof mart !== 'object' || Array.isArray(mart)) return null;
  return /** @type {Record<string, unknown>} */ (mart);
}

/**
 * From NEW_RESULT raw: `mesa_info.martingala` (and nested envelopes).
 * Same mesa_info resolution as `extractMesaInfoFromResultRaw` (incl. `scoreDetail` fallback).
 * @param {Record<string, unknown>} r
 */
export function pickMartingalaBlockFromResultRaw(r) {
  const scoreDetail =
    r.scoreDetail != null && typeof r.scoreDetail === 'object' && !Array.isArray(r.scoreDetail)
      ? /** @type {Record<string, unknown>} */ (r.scoreDetail)
      : null;
  const nested =
    r.data != null && typeof r.data === 'object' && !Array.isArray(r.data)
      ? /** @type {Record<string, unknown>} */ (r.data)
      : null;
  const deep =
    nested?.data != null && typeof nested.data === 'object' && !Array.isArray(nested.data)
      ? /** @type {Record<string, unknown>} */ (nested.data)
      : null;
  const results = deep?.results != null && typeof deep.results === 'object' ? deep.results : nested?.results;
  const mesaInfo =
    results?.mesa_info != null && typeof results.mesa_info === 'object' && !Array.isArray(results.mesa_info)
      ? /** @type {Record<string, unknown>} */ (results.mesa_info)
      : r.mesa_info != null && typeof r.mesa_info === 'object' && !Array.isArray(r.mesa_info)
        ? /** @type {Record<string, unknown>} */ (r.mesa_info)
        : scoreDetail;
  if (!mesaInfo || typeof mesaInfo !== 'object') return null;
  return readMartingalaBlock(mesaInfo.martingala);
}

/**
 * @param {Record<string, unknown>} r — NEW_RESULT body
 * @returns {{ vector_resultado: string[], vector_win: (string|number|boolean)[] }}
 */
export function extractVectorResultadoAndWinFromResultRaw(r) {
  const mart = pickMartingalaBlockFromResultRaw(r);
  if (!mart) return { vector_resultado: [], vector_win: [] };
  const vr = mart.vector_resultado;
  const vw = mart.vector_win;
  const vector_resultado = Array.isArray(vr) ? vr.map((x) => String(x)) : [];
  const vector_win = Array.isArray(vw) ? [...vw] : [];
  return { vector_resultado, vector_win };
}

/**
 * `data` a veces llega como string JSON (socket / serialización); sin parse, el merge pierde cartas.
 * @param {unknown} layer
 * @returns {Record<string, unknown>}
 */
function unwrapEnvelopeDataLayer(layer) {
  if (layer == null) return /** @type {Record<string, unknown>} */ ({});
  if (typeof layer === 'string') {
    try {
      const j = JSON.parse(layer);
      if (j != null && typeof j === 'object' && !Array.isArray(j)) {
        return /** @type {Record<string, unknown>} */ (j);
      }
    } catch {
      return /** @type {Record<string, unknown>} */ ({});
    }
    return /** @type {Record<string, unknown>} */ ({});
  }
  if (typeof layer === 'object' && !Array.isArray(layer)) {
    return /** @type {Record<string, unknown>} */ (layer);
  }
  return /** @type {Record<string, unknown>} */ ({});
}

/**
 * Socket.io puede emitir un único argumento que es `[payload]` en lugar de `payload`.
 * @param {unknown} payload
 * @returns {unknown}
 */
export function coalesceSocketEventPayload(payload) {
  if (
    Array.isArray(payload) &&
    payload.length === 1 &&
    payload[0] != null &&
    typeof payload[0] === 'object' &&
    !Array.isArray(payload[0])
  ) {
    return payload[0];
  }
  return payload;
}

/** @param {unknown} tab */
function tableroRoughLen(tab) {
  if (Array.isArray(tab)) return tab.length;
  if (typeof tab === 'string') {
    const t = tab.trim();
    if (t.startsWith('[')) {
      try {
        const j = JSON.parse(t);
        return Array.isArray(j) ? j.length : 0;
      } catch {
        return 0;
      }
    }
    if (/[,;|]/.test(t)) return t.split(/[,;|]/).filter(Boolean).length;
    return t ? 1 : 0;
  }
  return 0;
}

/**
 * BFF a veces pone `scoreDetail: { ganador }` en el sobre y cartas en capas internas; el spread `{...acc,...u}`
 * machacaba el detalle rico con el recortado.
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>} b
 * @returns {Record<string, unknown>}
 */
export function mergeScoreDetailPreferRicher(a, b) {
  const score = (sd) => {
    if (!sd || typeof sd !== 'object' || Array.isArray(sd)) return -1;
    let s = Object.keys(sd).length;
    const cp = sd.cartas_player;
    const cb = sd.cartas_banker;
    if (Array.isArray(cp) && cp.length) s += 200 + cp.length;
    if (Array.isArray(cb) && cb.length) s += 200 + cb.length;
    s += tableroRoughLen(sd.tablero) * 50;
    return s;
  };
  return score(b) >= score(a) ? { ...a, ...b } : { ...b, ...a };
}

/** Relay BFF: `providerPayload` puede ser objeto o string JSON (snapshot proveedor antes del sobre). */
function parseJsonObjectMaybe(v) {
  if (v == null) return null;
  if (typeof v === 'object' && !Array.isArray(v)) {
    return /** @type {Record<string, unknown>} */ (v);
  }
  if (typeof v === 'string') {
    try {
      const j = JSON.parse(v);
      if (j != null && typeof j === 'object' && !Array.isArray(j)) {
        return /** @type {Record<string, unknown>} */ (j);
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Aplanar envelope NEW_RESULT (`type`/`data` anidados) para extractores (alineado con admin).
 * Algunos relays encadenan varias capas `data` como string JSON; dos niveles no bastan.
 * @param {unknown} payload
 * @param {{ siblingDepth?: number }} [options]
 * @returns {Record<string, unknown>}
 */
export function mergeResultEnvelopeForExtract(payload, options) {
  const siblingDepth = options?.siblingDepth ?? 0;
  const pIn = coalesceSocketEventPayload(payload);
  if (pIn == null || typeof pIn !== 'object' || Array.isArray(pIn)) {
    return /** @type {Record<string, unknown>} */ ({});
  }
  const p = /** @type {Record<string, unknown>} */ (pIn);
  /** @type {Record<string, unknown>} */
  let acc = { ...p };
  /** Algunos relays usan `payload` o `body` en lugar de `data`. */
  let cursor = acc.data ?? acc.payload ?? acc.body;
  const maxDepth = 8;
  for (let depth = 0; depth < maxDepth && cursor != null; depth++) {
    const prevType = typeof cursor;
    const u = unwrapEnvelopeDataLayer(cursor);
    if (Object.keys(u).length === 0) break;
    const prevSd = acc.scoreDetail;
    acc = { ...acc, ...u };
    if (
      prevSd != null &&
      u.scoreDetail != null &&
      typeof prevSd === 'object' &&
      !Array.isArray(prevSd) &&
      typeof u.scoreDetail === 'object' &&
      !Array.isArray(u.scoreDetail)
    ) {
      acc.scoreDetail = mergeScoreDetailPreferRicher(
        /** @type {Record<string, unknown>} */ (prevSd),
        /** @type {Record<string, unknown>} */ (u.scoreDetail),
      );
    }
    if (prevType === 'string') {
      acc.data = u;
    }
    cursor = u.data ?? u.payload ?? u.body;
  }

  /** `buildAdminSignalsClientPayload` / relay: cuerpo plano + `providerPayload` con cartas (no sigue `data`→`data`). */
  if (siblingDepth < 2) {
    for (const fk of ['providerPayload', 'providerNormalized']) {
      const blob = parseJsonObjectMaybe(acc[fk]);
      if (blob == null) continue;
      const sub = mergeResultEnvelopeForExtract(blob, { siblingDepth: siblingDepth + 1 });
      const prevSd = acc.scoreDetail;
      acc = { ...acc, ...sub };
      if (
        prevSd != null &&
        sub.scoreDetail != null &&
        typeof prevSd === 'object' &&
        !Array.isArray(prevSd) &&
        typeof sub.scoreDetail === 'object' &&
        !Array.isArray(sub.scoreDetail)
      ) {
        acc.scoreDetail = mergeScoreDetailPreferRicher(
          /** @type {Record<string, unknown>} */ (prevSd),
          /** @type {Record<string, unknown>} */ (sub.scoreDetail),
        );
      }
    }
  }
  return acc;
}

/**
 * Store / historial: unir el cuerpo **coalescado** del socket con el sobre aplanado.
 * Si solo guardábamos `normalize().raw` / `mergeResultEnvelopeForExtract`, podían perderse claves que solo vivían en la raíz
 * o en ramas que el merge no promueve (evidencia NDJSON: solo `type`,`scoreDetail`,`winStatus`).
 *
 * @param {unknown} payload
 * @returns {Record<string, unknown>}
 */
export function mergeCoalescedPayloadWithEnvelopeExtract(payload) {
  const coalesced = coalesceSocketEventPayload(payload);
  const base =
    coalesced != null && typeof coalesced === 'object' && !Array.isArray(coalesced)
      ? /** @type {Record<string, unknown>} */ (coalesced)
      : {};
  const flat = mergeResultEnvelopeForExtract(payload);
  let out = { ...base, ...flat };
  const bsd =
    base.scoreDetail != null && typeof base.scoreDetail === 'object' && !Array.isArray(base.scoreDetail)
      ? /** @type {Record<string, unknown>} */ (base.scoreDetail)
      : null;
  const fsd =
    flat.scoreDetail != null && typeof flat.scoreDetail === 'object' && !Array.isArray(flat.scoreDetail)
      ? /** @type {Record<string, unknown>} */ (flat.scoreDetail)
      : null;
  if (bsd != null || fsd != null) {
    out = {
      ...out,
      scoreDetail: mergeScoreDetailPreferRicher(bsd ?? {}, fsd ?? {}),
    };
  }
  return out;
}

/**
 * NEW_RESULT: `contador_martingala` (raíz → `mesa_info.martingala`) o longitud de `vector_resultado`.
 * @param {unknown} payload
 * @returns {number | undefined}
 */
export function pickContadorMartingalaFromResultRaw(payload) {
  const r = mergeResultEnvelopeForExtract(payload);
  const top = r.contador_martingala;
  if (top != null && String(top).trim() !== '') {
    const n = Number(top);
    if (Number.isFinite(n)) return n;
  }
  const mart = pickMartingalaBlockFromResultRaw(r);
  if (mart) {
    const cm = mart.contador_martingala;
    if (cm != null && String(cm).trim() !== '') {
      const n = Number(cm);
      if (Number.isFinite(n)) return n;
    }
  }
  const { vector_resultado } = extractVectorResultadoAndWinFromResultRaw(r);
  if (vector_resultado.length > 0) return vector_resultado.length;
  return undefined;
}

/**
 * Contador after settlement: prefer NEW_RESULT body (`contador_martingala` / martingala block), then row.martingale.
 * @param {{ rawResult?: unknown, martingale?: unknown } | null | undefined} outcomeRow
 * @param {{ martingale?: unknown, rawSignal?: Record<string, unknown> | null } | null | undefined} activeRowFallback
 * @returns {number}
 */
export function pickContadorFromOutcomeForMartingaleUi(outcomeRow, activeRowFallback) {
  if (outcomeRow?.rawResult != null && typeof outcomeRow.rawResult === 'object' && !Array.isArray(outcomeRow.rawResult)) {
    const flat = mergeResultEnvelopeForExtract(outcomeRow.rawResult);
    const fromRes = pickContadorMartingalaFromResultRaw(flat);
    if (fromRes != null && Number.isFinite(Number(fromRes)) && Number(fromRes) >= 1) {
      return Math.min(PROVIDER_MARTINGALE_STEPS, Math.max(1, Math.floor(Number(fromRes))));
    }
  }
  const m = Number(outcomeRow?.martingale);
  if (Number.isFinite(m) && m >= 1) return Math.min(PROVIDER_MARTINGALE_STEPS, Math.floor(m));
  const a = Number(activeRowFallback?.martingale);
  if (Number.isFinite(a) && a >= 1) return Math.min(PROVIDER_MARTINGALE_STEPS, Math.floor(a));
  return 1;
}

/**
 * NEW_RESULT intermedio: la escalera avanza pero el ciclo de señal sigue pendiente (no es el cierre final).
 * FASE 4 full stream: el store ya no «fusiona sin historial» — cada evento genera fila en `history` con `status: 'intermediate'`.
 * @param {unknown} payload
 * @param {{ martingale: number, rawResult?: Record<string, unknown> | null }} target
 * @param {boolean} normalizedWinStatus
 */
export function isInterimMartingaleStep(payload, target, normalizedWinStatus) {
  const flat = mergeResultEnvelopeForExtract(payload);
  /** Victoria explícita en `vector_win` — cierre de paso, no tratar como paso intermedio de pérdida. */
  if (winStatusFromVectorWinLast(flat) === true) return false;

  const prevMg = Number(target.martingale) || 1;
  const nextMg = pickContadorMartingalaFromResultRaw(flat);
  const { vector_resultado: vrNew } = extractVectorResultadoAndWinFromResultRaw(flat);
  const prevRaw =
    target.rawResult != null && typeof target.rawResult === 'object' && !Array.isArray(target.rawResult)
      ? target.rawResult
      : {};
  const { vector_resultado: vrOld } = extractVectorResultadoAndWinFromResultRaw(prevRaw);
  if (nextMg != null && Number.isFinite(Number(nextMg)) && Number(nextMg) > prevMg) return true;
  if (vrNew.length > vrOld.length) return true;
  /** Proveedor reemplaza el vector con la misma longitud pero otra celda (siguiente paso). */
  if (vrNew.length > 0 && vrNew.length === vrOld.length && vrNew.join('\x1e') !== vrOld.join('\x1e')) {
    return true;
  }
  if (normalizedWinStatus === true) return false;
  return false;
}

/**
 * @deprecated FASE 4: el merge en una sola fila sin historizar pasos está desactivado — usar {@link isInterimMartingaleStep} en el ingest.
 * @returns {false} siempre (no merge).
 */
export function shouldMergeInterimLossIntoPendingRow(payload, target, normalizedWinStatus) {
  void payload;
  void target;
  void normalizedWinStatus;
  return false;
}

/**
 * WIN / LOSS from `vector_win[last]` when present.
 * @returns {boolean | null} null = not derivable from vector_win
 */
export function winStatusFromVectorWinLast(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = /** @type {Record<string, unknown>} */ (raw);
  const { vector_win } = extractVectorResultadoAndWinFromResultRaw(r);
  if (vector_win.length === 0) return null;
  const last = vector_win[vector_win.length - 1];
  if (last === true) return true;
  if (last === false) return false;
  const s = String(last).trim().toUpperCase();
  if (s === 'W' || s === 'WIN' || s === '1' || s === 'TRUE' || s === 'SI' || s === 'SÍ') return true;
  if (s === 'L' || s === 'LOSS' || s === '0' || s === 'FALSE' || s === 'NO') return false;
  const n = Number(last);
  if (n === 1) return true;
  if (n === 0 && String(last).trim() !== '') return false;
  return null;
}
