/**
 * Transforma `dashboardUpdate` del proveedor a raws para NEW_SIGNAL / NEW_RESULT.
 * Soporta: tableName, prediction, gameRound, result (primitivo u objeto), payloads anidados.
 */

/** Claves típicas de anidamiento (se aplanan hacia el mismo nivel, el hijo aporta defaults). */
const NEST_KEYS = /** @type {const} */ ([
  'payload',
  'body',
  'content',
  'data',
  'dashboard',
  'snapshot',
  'signal',
  'update',
  'meta',
  'detail',
  'attributes',
  'nested',
  'value',
  'message',
]);

/**
 * @param {unknown} v
 * @returns {string}
 */
function normalizeBaccaratSide(v) {
  const s = String(v ?? '')
    .trim()
    .toUpperCase();
  if (!s) return '';
  if (s === 'B' || s.startsWith('BANK')) return 'BANKER';
  if (s === 'P' || s.startsWith('PLAY')) return 'PLAYER';
  if (s.startsWith('TIE') || s === 'T') return 'TIE';
  return s;
}

/**
 * Aplana hasta 5 pasadas: { data: { payload: { x: 1 } } } → mescla internos.
 * @param {unknown} input
 * @returns {Record<string, unknown>}
 */
export function flattenNestedDashboardPayload(input) {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  let cur = { .../** @type {Record<string, unknown>} */ (input) };
  for (let pass = 0; pass < 5; pass++) {
    let next = { ...cur };
    let changed = false;
    for (const k of NEST_KEYS) {
      const v = next[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        next = { .../** @type {Record<string, unknown>} */ (v), ...next };
        changed = true;
      }
    }
    cur = next;
    if (!changed) break;
  }
  return cur;
}

/**
 * @param {unknown} w
 * @returns {boolean | null} null si no se puede interpretar como win/loss
 */
function winLossFromPrimitive(w) {
  if (w === true || w === false) return w;
  if (w === 1 || w === 0) return w === 1;
  if (typeof w === 'string') {
    const s = w.trim().toLowerCase();
    if (['win', 'won', 'true', '1', 'yes', 'hit', 'ok', 'success'].includes(s)) return true;
    if (['loss', 'lost', 'false', '0', 'no', 'miss', 'fail'].includes(s)) return false;
  }
  return null;
}

/**
 * Interpreta `result`: boolean, string win/loss, objeto anidado, o lado Baccarat vs prediction.
 * @param {Record<string, unknown>} o — ya aplanado
 * @returns {boolean | null}
 */
function deriveWinStatusFromResult(o) {
  const direct =
    o.winStatus ?? o.win ?? o.won ?? o.correct ?? o.hit ?? o.success ?? o.profit;
  const fromDirect = winLossFromPrimitive(direct);
  if (fromDirect !== null) return fromDirect;

  let res = o.result;
  if (res && typeof res === 'object' && !Array.isArray(res)) {
    const ro = /** @type {Record<string, unknown>} */ (res);
    res = ro.winStatus ?? ro.win ?? ro.won ?? ro.outcome ?? ro.value ?? ro.side;
  }
  const fromRes = winLossFromPrimitive(res);
  if (fromRes !== null) return fromRes;

  const outcome = o.outcome;
  if (outcome != null && typeof outcome !== 'object') {
    const fo = winLossFromPrimitive(outcome);
    if (fo !== null) return fo;
  }

  const pred =
    o.prediction ??
    o.recommendation ??
    o.signal ??
    o.side ??
    o.pick ??
    o.bet;
  const resSide = normalizeBaccaratSide(res);
  const predSide = normalizeBaccaratSide(pred);
  if (resSide && predSide && (resSide === 'BANKER' || resSide === 'PLAYER')) {
    if (predSide === 'TIE' || resSide === 'TIE') return false;
    return resSide === predSide;
  }

  return null;
}

/**
 * @param {Record<string, unknown>} o
 * @returns {Record<string, unknown> | null}
 */
function coerceToSignalRawFromFlat(o) {
  const mesa = o.mesa ?? o.table ?? o.desk ?? o.tableName ?? o.tableId ?? o.mesaName ?? o.room;
  const round =
    o.round ??
    o.gameRound ??
    o.gameId ??
    o.shoe ??
    o.hand ??
    o.roundId ??
    o.ronda ??
    o.ronda_actual ??
    o.Ronda;
  const id = o.id ?? o.signalId ?? o.betId ?? o.externalId ?? o.uid;
  const rec =
    o.recommendation ?? o.signal ?? o.side ?? o.prediction ?? o.bet ?? o.pick ?? o.forecast;
  const hasHint =
    (id != null && String(id).trim() !== '') ||
    (rec != null && String(rec).trim() !== '') ||
    (mesa != null && String(mesa).trim() !== '') ||
    (round != null && String(round).trim() !== '');
  if (!hasHint) return null;

  const out = { ...o };
  if (mesa != null) out.mesa = mesa;
  if (round != null) out.round = round;
  if (id != null) {
    out.id = id;
    if (o.signalId == null) out.signalId = id;
  }
  if (rec != null) {
    const side = normalizeBaccaratSide(rec);
    if (side === 'BANKER' || side === 'PLAYER') out.recommendation = side;
    else {
      const s = String(rec).toUpperCase();
      if (s === 'B' || s === 'BANK' || s === 'BANKER') out.recommendation = 'BANKER';
      else if (s === 'P' || s === 'PLAY' || s === 'PLAYER') out.recommendation = 'PLAYER';
      else out.recommendation = rec;
    }
  }
  return out;
}

/**
 * @param {Record<string, unknown>} o
 * @returns {Record<string, unknown> | null}
 */
function coerceToResultRawFromFlat(o) {
  const winStatus =
    typeof o.winStatus === 'boolean' ? o.winStatus : deriveWinStatusFromResult(o);
  if (winStatus === null || winStatus === undefined) return null;

  const id = o.signalId ?? o.id ?? o.betId ?? o.externalId;
  const mesa = o.mesa ?? o.table ?? o.desk ?? o.tableName ?? o.tableId ?? o.mesaName;
  const round =
    o.round ?? o.gameRound ?? o.gameId ?? o.shoe ?? o.hand ?? o.roundId ?? o.ronda ?? o.ronda_actual ?? o.Ronda;

  const out = { ...o, winStatus };
  if (id != null) {
    out.signalId = id;
    out.id = id;
  }
  if (mesa != null) out.mesa = mesa;
  if (round != null) out.round = round;
  return out;
}

/**
 * Un mismo renglón de dashboard puede generar señal (predicción) y resultado (si hay `result` interpretable).
 * @param {unknown} item
 * @returns {{ signals: Record<string, unknown>[], results: Record<string, unknown>[] }}
 */
function expandOneDashboardRow(item) {
  const signals = [];
  const results = [];
  if (item == null || typeof item !== 'object') return { signals, results };
  const flat = flattenNestedDashboardPayload(item);

  const hasPrediction =
    flat.prediction != null ||
    flat.recommendation != null ||
    flat.signal != null ||
    flat.side != null ||
    flat.pick != null;

  if (hasPrediction) {
    const sig = coerceToSignalRawFromFlat(flat);
    if (sig) signals.push(sig);
  }

  const resolvedWin = deriveWinStatusFromResult(flat);
  if (resolvedWin !== null) {
    const resObj = coerceToResultRawFromFlat({ ...flat, winStatus: resolvedWin });
    if (resObj) results.push(resObj);
  }

  if (signals.length === 0 && results.length === 0) {
    const sig = coerceToSignalRawFromFlat(flat);
    if (sig) signals.push(sig);
  }

  return { signals, results };
}

/**
 * Parsea cuerpo JSON en string.
 * @param {unknown} payload
 * @returns {unknown}
 */
function maybeParseJson(payload) {
  if (typeof payload === 'string') {
    const t = payload.trim();
    if (!t) return payload;
    if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
      try {
        return JSON.parse(t);
      } catch {
        return payload;
      }
    }
  }
  return payload;
}

/**
 * @param {unknown} payload
 * @returns {{ signals: Record<string, unknown>[], results: Record<string, unknown>[] }}
 */
export function expandDashboardUpdate(payload) {
  const signals = [];
  const results = [];
  const root = maybeParseJson(payload);
  if (root == null) return { signals, results };

  const pushRow = (item) => {
    const { signals: s, results: r } = expandOneDashboardRow(item);
    signals.push(...s);
    results.push(...r);
  };

  const p = root && typeof root === 'object' && !Array.isArray(root) ? root : {};
  const arr = Array.isArray(root)
    ? root
    : p.signals ??
      p.items ??
      p.updates ??
      p.rows ??
      p.tables ??
      (Array.isArray(p.data) ? p.data : null);

  if (Array.isArray(arr)) {
    for (const item of arr) pushRow(item);
    return { signals, results };
  }

  if (typeof p === 'object' && !Array.isArray(root)) {
    if (Array.isArray(p.data)) {
      for (const x of p.data) pushRow(x);
    } else {
      pushRow(p);
    }
  }

  return { signals, results };
}
