/**
 * Normalización espejo de `apps/gpulse/.../externalSignalsTypes.js` (sin dependencia cross-package).
 * Incluye `data.signal` (nombre_mesa, ronda_actual, …) como en el proveedor real.
 */

import { normalizeCorrelationKey } from './correlationKeyNormalize.js';
import { buildSafeCorrelationKey, isEpochMsCorrelationId } from './buildSafeCorrelationKey.js';

/** @param {...unknown} vals */
function pickFirst(...vals) {
  for (const v of vals) {
    if (v != null && String(v).trim() !== '') return v;
  }
  return null;
}

/** mirror admin-core `forecastMartingaleStep.js` */
function forecastStepIndexFromContador(contador) {
  if (contador == null || contador === '') return 0;
  const n = Number(contador);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n <= 1) return 0;
  return Math.max(0, Math.min(5, Math.floor(n) - 1));
}

function mapForecastAtStep(vector, idx) {
  if (!Array.isArray(vector)) return null;
  const cell = vector[idx];
  return cell || null;
}

/**
 * @param {unknown} cell
 * @returns {'PLAYER' | 'BANKER' | 'TIE' | null}
 */
function forecastCellToRecommendation(cell) {
  if (cell == null) return null;
  const s = String(cell).trim().toUpperCase();
  if (s === '') return null;
  if (s === 'P' || s.startsWith('PLAY')) return 'PLAYER';
  if (s === 'B' || s.startsWith('BANK')) return 'BANKER';
  if (s === 'E' || s === 'T' || s.startsWith('TIE')) return 'TIE';
  return null;
}

/**
 * `vector_forecast` indexado por `contador_martingala` (misma regla que admin-core).
 * @param {unknown} vector
 * @param {unknown} martingaleCounter
 * @returns {'PLAYER' | 'BANKER' | 'TIE' | null}
 */
function mapVectorForecastToRecommendation(vector, martingaleCounter) {
  if (!Array.isArray(vector) || vector.length === 0) return null;
  const idx = forecastStepIndexFromContador(martingaleCounter);
  const cell = mapForecastAtStep(vector, idx);
  return forecastCellToRecommendation(cell);
}

/**
 * @param {Record<string, unknown> | null | undefined} sig2
 * @param {Record<string, unknown> | null | undefined} sig
 * @param {Record<string, unknown>} r
 */
function readMartingaleCounterForForecastStep(sig2, sig, r) {
  /** @param {Record<string, unknown> | null | undefined} s */
  const fromSig = (s) => {
    if (s == null || typeof s !== 'object' || Array.isArray(s)) return null;
    const m = s.martingala;
    const c = m != null && typeof m === 'object' && !Array.isArray(m) ? m.contador_martingala : null;
    return pickFirst(c, s.contador_martingala, s.martingale);
  };
  return pickFirst(
    fromSig(sig2),
    fromSig(sig),
    sig2?.martingale,
    sig?.martingale,
    r.martingale,
    r.martinGale,
    r.martingaleLevel,
  );
}

/**
 * Misma forma que `readNestedDataSignal` en `apps/admin-core/.../signalFormatter.js`.
 * @param {Record<string, unknown>} r
 */
export function readNestedDataSignal(r) {
  const data =
    r.data != null && typeof r.data === 'object' && !Array.isArray(r.data)
      ? /** @type {Record<string, unknown>} */ (r.data)
      : null;
  const sig =
    data?.signal != null && typeof data.signal === 'object' && !Array.isArray(data.signal)
      ? /** @type {Record<string, unknown>} */ (data.signal)
      : null;
  return { data, sig };
}

/**
 * Proveedor: a veces `data.data.signal` (doble capa) en dashboardUpdate.
 * @param {Record<string, unknown>} r
 */
export function readDoubleNestedSignal(r) {
  const { data, sig } = readNestedDataSignal(r);
  const data2 =
    data?.data != null && typeof data.data === 'object' && !Array.isArray(data.data)
      ? /** @type {Record<string, unknown>} */ (data.data)
      : null;
  const sig2 =
    data2?.signal != null && typeof data2.signal === 'object' && !Array.isArray(data2.signal)
      ? /** @type {Record<string, unknown>} */ (data2.signal)
      : null;
  return { data2, sig2 };
}

/** Winxplay: `data_evento` / `data_event` con `Ronda` junto a la señal. */
function roundFromDataEventBlock(holder) {
  if (holder == null || typeof holder !== 'object' || Array.isArray(holder)) return null;
  const h = /** @type {Record<string, unknown>} */ (holder);
  const ev = h.data_evento ?? h.data_event;
  if (ev == null || typeof ev !== 'object' || Array.isArray(ev)) return null;
  const o = /** @type {Record<string, unknown>} */ (ev);
  return pickFirst(o.Ronda, o.ronda, o.round);
}

/** Ronda en `data.data.results.mesa_info` o `data.results.mesa_info`. */
function tryRoundFromResultsMesaInfo(raw) {
  const r = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
  const d = r.data != null && typeof r.data === 'object' && !Array.isArray(r.data) ? /** @type {Record<string, unknown>} */ (r.data) : null;
  const inner = d?.data != null && typeof d.data === 'object' && !Array.isArray(d.data) ? /** @type {Record<string, unknown>} */ (d.data) : null;
  const resultsDeep =
    inner?.results != null && typeof inner.results === 'object' && !Array.isArray(inner.results)
      ? /** @type {Record<string, unknown>} */ (inner.results)
      : null;
  const resultsShallow =
    d?.results != null && typeof d.results === 'object' && !Array.isArray(d.results)
      ? /** @type {Record<string, unknown>} */ (d.results)
      : null;
  const mi =
    (resultsDeep?.mesa_info != null && typeof resultsDeep.mesa_info === 'object' && !Array.isArray(resultsDeep.mesa_info)
      ? /** @type {Record<string, unknown>} */ (resultsDeep.mesa_info)
      : null) ??
    (resultsShallow?.mesa_info != null && typeof resultsShallow.mesa_info === 'object' && !Array.isArray(resultsShallow.mesa_info)
      ? /** @type {Record<string, unknown>} */ (resultsShallow.mesa_info)
      : null);
  if (!mi) return null;
  const ev = mi.data_evento ?? mi.data_event;
  const evRec = ev != null && typeof ev === 'object' && !Array.isArray(ev) ? /** @type {Record<string, unknown>} */ (ev) : null;
  const fromEv = evRec ? pickFirst(evRec.Ronda, evRec.ronda, evRec.round) : null;
  /** Resultado cierra la señal en ronda_objetivo; ronda_actual es la mesa “en curso”, no usar para match. */
  const v = pickFirst(mi.ronda_objetivo, fromEv, mi.Ronda, mi.round, mi.ronda_actual);
  return v != null ? String(v).trim() : '';
}

/**
 * Ronda del proveedor: rutas anidadas (mesa_info / signal / data.ronda) antes que `payload.round` vacío.
 * Alineado con `apps/admin-core/src/utils/resolveRoundFromProvider.js`.
 *
 * @param {unknown} payload
 * @returns {string | null}
 */
export function resolveRoundFromProvider(payload) {
  const p =
    payload != null && typeof payload === 'object' && !Array.isArray(payload)
      ? /** @type {Record<string, unknown>} */ (payload)
      : null;
  if (!p) return null;

  /** @param {unknown} mi */
  const pickFromMesaInfo = (mi) => {
    if (mi == null || typeof mi !== 'object' || Array.isArray(mi)) return null;
    const m = /** @type {Record<string, unknown>} */ (mi);
    const ev = m.data_evento ?? m.data_event;
    const evRec = ev != null && typeof ev === 'object' && !Array.isArray(ev) ? /** @type {Record<string, unknown>} */ (ev) : null;
    const fromEv = evRec ? pickFirst(evRec.Ronda, evRec.ronda, evRec.round) : null;
    return pickFirst(m.ronda_objetivo, fromEv, m.Ronda, m.round, m.gameRound, m.ronda_actual);
  };

  const d =
    p.data != null && typeof p.data === 'object' && !Array.isArray(p.data)
      ? /** @type {Record<string, unknown>} */ (p.data)
      : null;
  const d2 =
    d?.data != null && typeof d.data === 'object' && !Array.isArray(d.data)
      ? /** @type {Record<string, unknown>} */ (d.data)
      : null;

  const resultsDeep =
    d2?.results != null && typeof d2.results === 'object' && !Array.isArray(d2.results)
      ? /** @type {Record<string, unknown>} */ (d2.results)
      : null;
  const resultsShallow =
    d?.results != null && typeof d.results === 'object' && !Array.isArray(d.results)
      ? /** @type {Record<string, unknown>} */ (d.results)
      : null;

  const miDeep = resultsDeep?.mesa_info;
  const miShallow = resultsShallow?.mesa_info;

  const sigDeep =
    d2?.signal != null && typeof d2.signal === 'object' && !Array.isArray(d2.signal)
      ? /** @type {Record<string, unknown>} */ (d2.signal)
      : null;
  const sigShallow =
    d?.signal != null && typeof d.signal === 'object' && !Array.isArray(d.signal)
      ? /** @type {Record<string, unknown>} */ (d.signal)
      : null;
  const sigRoot =
    p.signal != null && typeof p.signal === 'object' && !Array.isArray(p.signal)
      ? /** @type {Record<string, unknown>} */ (p.signal)
      : null;

  /** @param {unknown} holder */
  const roundFromDataEventBlock = (holder) => {
    if (holder == null || typeof holder !== 'object' || Array.isArray(holder)) return null;
    const h = /** @type {Record<string, unknown>} */ (holder);
    const ev = h.data_evento ?? h.data_event;
    if (ev == null || typeof ev !== 'object' || Array.isArray(ev)) return null;
    const o = /** @type {Record<string, unknown>} */ (ev);
    return pickFirst(o.Ronda, o.ronda, o.round);
  };

  const nested = pickFirst(
    pickFromMesaInfo(miDeep),
    pickFromMesaInfo(miShallow),
    pickFromMesaInfo(p.mesa_info),
    sigDeep?.ronda_actual,
    sigShallow?.ronda_actual,
    sigRoot?.ronda_actual,
    d2?.ronda,
    d?.ronda,
    roundFromDataEventBlock(sigDeep),
    roundFromDataEventBlock(sigShallow),
    roundFromDataEventBlock(sigRoot),
    roundFromDataEventBlock(d2),
    roundFromDataEventBlock(d),
    roundFromDataEventBlock(p),
    sigDeep?.ronda_objetivo,
    sigDeep?.gameRound,
    sigShallow?.ronda_objetivo,
    sigShallow?.gameRound,
    d2?.ronda_actual,
    d2?.ronda_objetivo,
    d?.ronda_actual,
    d?.ronda_objetivo,
  );

  if (nested != null && String(nested).trim() !== '') return String(nested).trim();

  const shallow = pickFirst(p.round, p.ronda, p.ronda_actual, p.Ronda, p.gameRound, p.roundId, p.hand);
  return shallow != null && String(shallow).trim() !== '' ? String(shallow).trim() : null;
}

export function buildCorrelationKey(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const forcedCk = r.correlationKey != null ? String(r.correlationKey).trim() : '';
  if (forcedCk !== '') {
    if (forcedCk.startsWith('id:')) {
      const rest = forcedCk.slice(3);
      if (isEpochMsCorrelationId(rest)) {
        console.warn('[NO_CORRELATION_KEY]', { correlationKey: forcedCk, note: 'ignored_epoch_like_wire' });
      } else {
        const n = normalizeCorrelationKey(forcedCk);
        return n != null && String(n).trim() !== '' ? String(n).trim() : forcedCk;
      }
    } else {
      /** `mesa:Nombre|round:12` (GPulse/relay) → `Nombre|12` — mismo criterio que admin-core. */
      const n = normalizeCorrelationKey(forcedCk);
      return n != null && String(n).trim() !== '' ? String(n).trim() : forcedCk;
    }
  }
  const { data, sig } = readNestedDataSignal(r);
  const { data2, sig2 } = readDoubleNestedSignal(r);
  const id = r.id ?? r.signalId ?? sig?.id ?? sig?.signalId ?? sig2?.id ?? sig2?.signalId;
  const mesa = String(
    pickFirst(
      sig2?.nombre_mesa,
      sig2?.tableName,
      data2?.mesa,
      sig?.nombre_mesa,
      sig?.tableName,
      data?.mesa,
      r.mesa,
      r.table,
      r.desk,
      r.tableName,
      r.tableId,
      r.mesaName,
    ) ?? '',
  ).trim();
  const roundV = pickFirst(
    resolveRoundFromProvider(r),
    sig2?.ronda_actual,
    data2?.ronda,
    data?.ronda,
    roundFromDataEventBlock(sig2),
    roundFromDataEventBlock(sig),
    roundFromDataEventBlock(data2),
    roundFromDataEventBlock(data),
    roundFromDataEventBlock(r),
    sig2?.gameRound,
    sig2?.ronda_objetivo,
    data2?.ronda_actual,
    sig?.ronda_actual,
    sig?.gameRound,
    sig?.ronda_objetivo,
    data?.ronda_actual,
    r.ronda,
    r.ronda_actual,
    r.Ronda,
    r.round,
    r.gameRound,
    r.roundId,
    r.hand,
  );
  const round = roundV != null ? String(roundV).trim() : '';
  const pid = id != null && String(id).trim() !== '' ? String(id).trim() : undefined;
  const providerId = pid && !isEpochMsCorrelationId(pid) ? pid : undefined;
  const ck = buildSafeCorrelationKey({ mesa: mesa || null, round: round || null, providerId });
  if (ck == null && (mesa !== '' || round !== '' || pid !== undefined)) {
    console.warn('[MISSING_ROUND_NO_ID]', { mesa: mesa || null, round: round || null, providerId: pid ?? null });
  }
  return ck;
}

export function normalizeNewSignalPayload(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const { data, sig } = readNestedDataSignal(r);
  const { data2, sig2 } = readDoubleNestedSignal(r);

  const mesa = String(
    pickFirst(
      sig2?.nombre_mesa,
      sig2?.tableName,
      data2?.mesa,
      sig?.nombre_mesa,
      sig?.tableName,
      data?.mesa,
      r.mesa,
      r.tableName,
      r.table,
      r.desk,
      r.tableId,
    ) ?? '',
  ).trim();

  let roundStr = resolveRoundFromProvider(r) ?? '';
  if (!roundStr) {
    const roundV = pickFirst(
      sig2?.gameRound,
      sig2?.ronda_objetivo,
      data2?.ronda_actual,
      sig?.gameRound,
      sig?.ronda_objetivo,
      data?.ronda_actual,
      r.gameRound,
      r.roundId,
      r.hand,
    );
    roundStr = roundV != null ? String(roundV).trim() : '';
  }

  const rec = String(
    pickFirst(
      sig2?.recommendation,
      sig?.recommendation,
      sig2?.forecast,
      sig?.forecast,
      sig?.signal,
      sig?.side,
      sig?.prediction,
      r.recommendation,
      r.forecast,
      r.signal,
      r.side,
      r.prediction,
    ) ?? '',
  ).toUpperCase();
  let recommendation = 'UNKNOWN';
  if (rec === 'BANKER' || rec === 'B' || rec.startsWith('BANK')) recommendation = 'BANKER';
  else if (rec === 'PLAYER' || rec === 'P' || rec.startsWith('PLAY')) recommendation = 'PLAYER';
  else if (rec === 'TIE' || rec === 'T' || rec.startsWith('TIE') || rec.startsWith('EMP')) recommendation = 'TIE';

  if (recommendation === 'UNKNOWN') {
    let vf = sig2?.vector_forecast;
    if (!Array.isArray(vf) || vf.length === 0) vf = sig?.vector_forecast;
    if (!Array.isArray(vf) || vf.length === 0) vf = r.vector_forecast;
    const mc = readMartingaleCounterForForecastStep(sig2, sig, r);
    const fromVec = mapVectorForecastToRecommendation(Array.isArray(vf) ? vf : [], mc);
    if (fromVec) recommendation = fromVec;
  }

  const idVal = r.id ?? r.signalId ?? sig?.id ?? sig?.signalId ?? sig2?.id ?? sig2?.signalId;

  return {
    providerSignalId: idVal != null ? String(idVal) : null,
    mesa,
    round: roundStr,
    martingale: Number(pickFirst(sig2?.martingale, sig?.martingale, r.martingale, r.martinGale) ?? 0) || 0,
    recommendation,
    correlationKey: buildCorrelationKey(r),
    raw: r,
  };
}

export function normalizeNewResultPayload(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const idVal = r.signalId ?? r.id;
  let w = r.winStatus;
  if (w === undefined || w === null) {
    const res = r.result;
    if (res === true || res === false) w = res;
    else if (typeof res === 'string') {
      const s = res.trim().toLowerCase();
      if (['win', 'won', 'true', '1', 'yes', 'hit'].includes(s)) w = true;
      if (['loss', 'lost', 'false', '0', 'no', 'miss'].includes(s)) w = false;
    }
  }
  const winStatus = w === true || w === 'true' || w === 1 || w === '1';
  let roundStr = resolveRoundFromProvider(r) ?? '';
  if (!roundStr) {
    roundStr =
      r.round != null
        ? String(r.round)
        : r.gameRound != null
          ? String(r.gameRound)
          : r.ronda != null
            ? String(r.ronda)
            : r.ronda_objetivo != null
              ? String(r.ronda_objetivo)
              : r.ronda_actual != null
                ? String(r.ronda_actual)
                : '';
  }
  return {
    providerSignalId: idVal != null ? String(idVal) : null,
    mesa: String(r.mesa ?? r.table ?? r.desk ?? r.tableName ?? r.tableId ?? ''),
    round: roundStr,
    winStatus,
    correlationKey: buildCorrelationKey(r),
    raw: r,
  };
}

export function extractMesaFromPayload(payload) {
  const r = payload && typeof payload === 'object' ? payload : {};
  const { data, sig } = readNestedDataSignal(r);
  const m = String(
    pickFirst(
      sig?.nombre_mesa,
      sig?.tableName,
      data?.mesa,
      r.mesa,
      r.table,
      r.desk,
      r.tableName,
      r.tableId,
      r.mesaName,
    ) ?? '',
  ).trim();
  return m || '—';
}
