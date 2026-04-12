/**
 * Runtime ESM — copia alineada con `core/provider-contract.js` del monorepo (admin-core empaquetable sin carpeta `/core` en disco).
 */

/** @param {unknown} v */
function asRecord(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? /** @type {Record<string, unknown>} */ (v) : null;
}

/** @param {unknown} raw */
function wireRoot(raw) {
  const r = asRecord(raw);
  if (!r) return null;
  const p = r.payload;
  if (p != null && typeof p === 'object' && !Array.isArray(p)) return /** @type {Record<string, unknown>} */ (p);
  return r;
}

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown> | null}
 */
export function extractSupplierSignal(raw) {
  const tryOnce = (x) => {
    const root = wireRoot(x);
    if (!root) return null;
    const d = asRecord(root.data);
    if (!d) return null;
    const d2 = asRecord(d.data);
    const deep = d2?.signal;
    if (deep != null && typeof deep === 'object' && !Array.isArray(deep)) return /** @type {Record<string, unknown>} */ (deep);
    const shallow = d.signal;
    if (shallow != null && typeof shallow === 'object' && !Array.isArray(shallow))
      return /** @type {Record<string, unknown>} */ (shallow);
    return null;
  };
  let s = tryOnce(raw);
  if (s) return s;
  const r0 = asRecord(raw);
  const sup = r0?.supplier;
  if (sup != null && typeof sup === 'object' && !Array.isArray(sup)) {
    s = tryOnce({ payload: sup });
    if (s) return s;
    s = tryOnce(sup);
  }
  return s;
}

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown> | null}
 */
export function extractSupplierResult(raw) {
  const tryOnce = (x) => {
    const root = wireRoot(x);
    if (!root) return null;
    const d = asRecord(root.data);
    if (!d) return null;
    const d2 = asRecord(d.data);
    const resDeep = d2 ? asRecord(d2.results) : null;
    const miDeep = resDeep?.mesa_info;
    if (miDeep != null && typeof miDeep === 'object' && !Array.isArray(miDeep))
      return /** @type {Record<string, unknown>} */ (miDeep);
    const resShallow = asRecord(d.results);
    const miShallow = resShallow?.mesa_info;
    if (miShallow != null && typeof miShallow === 'object' && !Array.isArray(miShallow))
      return /** @type {Record<string, unknown>} */ (miShallow);
    return null;
  };
  let s = tryOnce(raw);
  if (s) return s;
  const r0 = asRecord(raw);
  const sup = r0?.supplier;
  if (sup != null && typeof sup === 'object' && !Array.isArray(sup)) {
    s = tryOnce({ payload: sup });
    if (s) return s;
    s = tryOnce(sup);
  }
  if (s) return s;
  const topMi = r0?.mesa_info;
  if (topMi != null && typeof topMi === 'object' && !Array.isArray(topMi))
    return /** @type {Record<string, unknown>} */ (topMi);
  return null;
}

/**
 * Relay inner envelope `data.data` (phase, event, ts).
 * @param {unknown} raw
 * @returns {Record<string, unknown> | null}
 */
export function extractInnerDataEnvelope(raw) {
  const root = wireRoot(raw);
  if (!root) return null;
  const d = asRecord(root.data);
  if (!d) return null;
  const d2 = asRecord(d.data);
  return d2;
}

/**
 * @param {unknown} signal
 * @returns {unknown[]}
 */
export function getVectorForecast(signal) {
  const s = asRecord(signal);
  if (!s || !Array.isArray(s.vector_forecast)) return [];
  return s.vector_forecast;
}

/**
 * @param {unknown} raw
 * @returns {unknown[]}
 */
export function extractVectorForecastFromWire(raw) {
  const sig = extractSupplierSignal(raw);
  if (sig) return getVectorForecast(sig);
  return getVectorForecast(raw);
}

/**
 * @param {unknown} signal
 * @returns {unknown}
 */
export function getPrediction(signal) {
  const s = asRecord(signal);
  if (!s || !Array.isArray(s.vector_forecast) || s.vector_forecast.length === 0) {
    throw new Error('INVALID_SIGNAL: vector_forecast missing');
  }
  return s.vector_forecast[0];
}

/**
 * @param {unknown} entity
 * @returns {string}
 */
export function buildCorrelationKey(entity) {
  const e = asRecord(entity);
  if (!e) throw new Error('INVALID_CORRELATION_KEY');
  const mesa = e.mesa ?? e.table_id ?? e.nombre_mesa;
  const round = e.round ?? e.round_id ?? e.ronda_actual ?? e.ronda_objetivo;
  if (mesa == null || String(mesa).trim() === '' || round == null || String(round).trim() === '') {
    throw new Error('INVALID_CORRELATION_KEY');
  }
  return `mesa:${String(mesa).trim()}|round:${String(round).trim()}`;
}

/**
 * @param {unknown} signal
 * @returns {string}
 */
export function buildTraceId(signal) {
  const s = asRecord(signal);
  const tid = s?.table_id ?? s?.mesa ?? s?.nombre_mesa;
  const rid = s?.round_id ?? s?.round ?? s?.ronda_actual;
  return `${tid}-${rid}-${Date.now()}`;
}

/** @param {unknown} raw */
function letterFromRawFirstUnit(raw) {
  if (raw == null) return null;
  const u = String(raw).trim().toUpperCase();
  if (u.length === 0) return null;
  const c0 = u.charCodeAt(0);
  if (c0 === 0x50) return 'P';
  if (c0 === 0x42) return 'B';
  if (c0 === 0x54 || c0 === 0x45) return 'T';
  return null;
}

/**
 * @param {unknown} signal
 * @returns {'P' | 'B' | 'T' | null}
 */
export function getPredictionSideLetter(signal) {
  try {
    return letterFromRawFirstUnit(getPrediction(signal));
  } catch {
    return null;
  }
}

/**
 * @param {unknown} mesaInfo
 * @returns {string | null}
 */
export function buildCorrelationKeyFromMesaInfo(mesaInfo) {
  try {
    return buildCorrelationKey(mesaInfo);
  } catch {
    return null;
  }
}

/**
 * @param {unknown} body
 */
export function resolveSupplierBody(body) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) return body;
  const b = /** @type {Record<string, unknown>} */ (body);
  return b.supplier != null && typeof b.supplier === 'object' && !Array.isArray(b.supplier) ? b.supplier : body;
}

/**
 * @param {unknown} raw
 */
export function predictionFromBackendWire(raw) {
  const sig = extractSupplierSignal(raw);
  if (!sig) return 'UNKNOWN';
  const L = getPredictionSideLetter(sig);
  if (L === 'P') return 'PLAYER';
  if (L === 'B') return 'BANKER';
  if (L === 'T') return 'TIE';
  return 'UNKNOWN';
}

/**
 * @param {unknown} raw
 */
export function predictionFromGpulseWire(raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? /** @type {Record<string, unknown>} */ (raw) : {};
  const sig = extractSupplierSignal(resolveSupplierBody(r));
  if (!sig) return 'UNKNOWN';
  const L = getPredictionSideLetter(sig);
  if (L === 'P') return 'PLAYER';
  if (L === 'B') return 'BANKER';
  if (L === 'T') return 'TIE';
  return 'UNKNOWN';
}

/**
 * @param {unknown} p
 */
export function normalizeFinalPredictionRole(p) {
  if (p == null) return 'UNKNOWN';
  const s = String(p).trim();
  if (s === '' || s === '—' || s === '-') return 'UNKNOWN';
  const u = s.toUpperCase();
  if (u === 'PLAYER' || u === 'P') return 'PLAYER';
  if (u === 'BANKER' || u === 'B') return 'BANKER';
  if (u === 'TIE' || u === 'T' || u === 'E') return 'TIE';
  if (u === 'UNKNOWN') return 'UNKNOWN';
  return 'UNKNOWN';
}

/**
 * @param {unknown} backendPrediction
 * @param {unknown} adminPrediction
 * @param {unknown} gpulsePrediction
 */
export function assertFinalSystemPredictionAligned(backendPrediction, adminPrediction, gpulsePrediction) {
  console.log('FINAL SYSTEM CHECK', { backendPrediction, adminPrediction, gpulsePrediction });
  const b = normalizeFinalPredictionRole(backendPrediction);
  const a = normalizeFinalPredictionRole(adminPrediction);
  const g = normalizeFinalPredictionRole(gpulsePrediction);
  if (b !== a || a !== g || b !== g) {
    throw new Error('SYSTEM NOT ALIGNED');
  }
}
