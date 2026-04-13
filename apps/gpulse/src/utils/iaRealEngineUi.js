/**
 * IA Real + relay: helpers for state-driven dashboard (no VISOR / SIMULACION).
 */

import { buildCorrelationKey } from '../ui-genesis/lib/externalSignalsTypes.js';
import {
  coalesceSocketEventPayload,
  forecastStepIndexFromContador,
  mergeCoalescedPayloadWithEnvelopeExtract,
  mergeResultEnvelopeForExtract,
  pickContadorFromOutcomeForMartingaleUi,
  pickContadorMartingalaFromSignalRaw,
} from './providerMartingaleRead.js';
import { getDebugIngestUrl, isIaRealExtractDebugEnabled } from './debugIngestUrl.js';

/**
 * `mergedKeys` puede listar `signal` pero el valor llega como **string JSON** (Mongo/relay), no objeto.
 * @param {unknown} v
 * @returns {Record<string, unknown> | null}
 */
function unwrapSignalLikeObject(v) {
  let cur = v;
  for (let i = 0; i < 4; i++) {
    cur = coalesceSocketEventPayload(cur);
    if (cur == null) return null;
    if (typeof cur === 'object' && !Array.isArray(cur)) {
      return /** @type {Record<string, unknown>} */ (cur);
    }
    if (typeof cur === 'string') {
      const t = cur.trim();
      if (!t.startsWith('{') && !t.startsWith('[')) return null;
      try {
        cur = JSON.parse(t);
      } catch {
        return null;
      }
      continue;
    }
    return null;
  }
  return null;
}

/**
 * `outcomeRow.rawResult` suele ser el objeto NEW_RESULT; a veces llega serializado como string (persistencia / relay).
 * Puede estar **doble-stringificado** (`JSON.stringify(JSON.stringify(obj))`); un solo `parse` deja un string, no un objeto.
 * @param {{ rawResult?: unknown } | null | undefined} row
 * @returns {unknown | null}
 */
export function resolveOutcomeRowResultPayload(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const r = /** @type {Record<string, unknown>} */ (row);
  let v = r.rawResult ?? r.raw_result ?? r.resultPayload ?? r.raw ?? null;
  if (v == null) return null;
  for (let depth = 0; depth < 8; depth++) {
    if (typeof v === 'string') {
      try {
        v = JSON.parse(v);
      } catch {
        return null;
      }
    } else {
      break;
    }
  }
  return v;
}

/**
 * @param {Record<string, unknown> | null | undefined} raw
 * @returns {string[]}
 */
export function extractVectorForecastFromRawSignal(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  if (Array.isArray(raw.vector_forecast)) return raw.vector_forecast.map((x) => String(x));
  const d =
    raw.data != null && typeof raw.data === 'object' && !Array.isArray(raw.data)
      ? /** @type {Record<string, unknown>} */ (raw.data)
      : null;
  const inner =
    d?.data != null && typeof d.data === 'object' && !Array.isArray(d.data)
      ? /** @type {Record<string, unknown>} */ (d.data)
      : null;
  const sig =
    inner?.signal != null && typeof inner.signal === 'object' && !Array.isArray(inner.signal)
      ? /** @type {Record<string, unknown>} */ (inner.signal)
      : d?.signal != null && typeof d.signal === 'object' && !Array.isArray(d.signal)
        ? /** @type {Record<string, unknown>} */ (d.signal)
        : null;
  const vf = sig && Array.isArray(sig.vector_forecast) ? sig.vector_forecast : null;
  if (vf) return vf.map((x) => String(x));
  return [];
}

/**
 * @param {{ rawSignal?: Record<string, unknown> | null, recommendation?: string }} row
 * @returns {string[]}
 */
export function extractVectorForecastFromActiveRow(row) {
  if (!row) return [];
  return extractVectorForecastFromRawSignal(row.rawSignal ?? null);
}

/**
 * @param {unknown} rawResult
 * @returns {{ ganador?: string, cartas_player?: unknown[], cartas_banker?: unknown[] }}
 */
export function extractMesaInfoFromResultRaw(rawResult) {
  if (!rawResult || typeof rawResult !== 'object' || Array.isArray(rawResult)) return {};
  const root = coalesceSocketEventPayload(rawResult);
  if (root == null || typeof root !== 'object' || Array.isArray(root)) return {};
  /** Misma regla que la card theater: relay string/array/`payload` (otros callers no pasan por extractMesaInfoFlexible). */
  const r = mergeResultEnvelopeForExtract(/** @type {Record<string, unknown>} */ (root));
  const scoreDetail = unwrapSignalLikeObject(r.scoreDetail);
  const nestCand = r.data ?? r.payload;
  const nested =
    nestCand != null && typeof nestCand === 'object' && !Array.isArray(nestCand)
      ? /** @type {Record<string, unknown>} */ (nestCand)
      : null;
  const deepCand = nested?.data ?? nested?.payload;
  const deep =
    deepCand != null && typeof deepCand === 'object' && !Array.isArray(deepCand)
      ? /** @type {Record<string, unknown>} */ (deepCand)
      : null;
  const results = deep?.results != null && typeof deep.results === 'object' ? deep.results : nested?.results;
  const mesaInfo =
    results?.mesa_info != null && typeof results.mesa_info === 'object' && !Array.isArray(results.mesa_info)
      ? /** @type {Record<string, unknown>} */ (results.mesa_info)
      : scoreDetail;
  if (!mesaInfo || typeof mesaInfo !== 'object') return {};

  const pickArr = (primary, ...alts) => {
    if (Array.isArray(primary) && primary.length) return primary;
    for (const a of alts) {
      if (Array.isArray(a) && a.length) return a;
    }
    return undefined;
  };

  let cp = pickArr(
    mesaInfo.cartas_player,
    scoreDetail?.cartas_player,
    scoreDetail?.player_cards,
    mesaInfo.player_cards,
  );
  let cb = pickArr(
    mesaInfo.cartas_banker,
    scoreDetail?.cartas_banker,
    scoreDetail?.banker_cards,
    mesaInfo.banker_cards,
  );
  if ((!cp || !cp.length) && (!cb || !cb.length)) {
    const tabRaw = mesaInfo.tablero ?? scoreDetail?.tablero;
    const tab = normalizeTableroToArray(tabRaw);
    if (tab.length) {
      const sp = splitTableroBaccaratDealOrder(tab);
      if (sp.cartas_player.length || sp.cartas_banker.length) {
        cp = sp.cartas_player;
        cb = sp.cartas_banker;
      }
    }
  }

  const ganRaw =
    mesaInfo.ganador != null
      ? String(mesaInfo.ganador)
      : scoreDetail?.ganador != null
        ? String(scoreDetail.ganador)
        : undefined;

  return {
    ganador: ganRaw,
    cartas_player: cp,
    cartas_banker: cb,
    puntaje_player:
      mesaInfo.puntaje_player != null
        ? String(mesaInfo.puntaje_player)
        : scoreDetail?.puntaje_player != null
          ? String(scoreDetail.puntaje_player)
          : undefined,
    puntaje_banker:
      mesaInfo.puntaje_banker != null
        ? String(mesaInfo.puntaje_banker)
        : scoreDetail?.puntaje_banker != null
          ? String(scoreDetail.puntaje_banker)
          : undefined,
  };
}

/** `data` puede seguir como string JSON tras capas parciales (Mongo/relay). */
function dataLayerAsRecord(data) {
  if (data == null) return null;
  if (typeof data === 'object' && !Array.isArray(data)) {
    return /** @type {Record<string, unknown>} */ (data);
  }
  if (typeof data === 'string') {
    const t = data.trim();
    if (!t.startsWith('{')) return null;
    try {
      const j = JSON.parse(t);
      if (j != null && typeof j === 'object' && !Array.isArray(j)) {
        return /** @type {Record<string, unknown>} */ (j);
      }
    } catch {
      return null;
    }
  }
  return null;
}

/** Igual que core-api `findMesaInfoInPayload`: prioriza `data.data.results`, luego `results` / `data.results`. */
function findMesaInfoRecordInPayload(rawPayload) {
  if (rawPayload == null || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) return null;
  const r = /** @type {Record<string, unknown>} */ (rawPayload);
  const d = dataLayerAsRecord(r.data) ?? dataLayerAsRecord(r.payload);
  const innerSrc = d?.data ?? d?.payload;
  const inner =
    innerSrc != null && typeof innerSrc === 'object' && !Array.isArray(innerSrc)
      ? /** @type {Record<string, unknown>} */ (innerSrc)
      : dataLayerAsRecord(innerSrc);
  const results =
    inner?.results != null && typeof inner.results === 'object' && !Array.isArray(inner.results)
      ? /** @type {Record<string, unknown>} */ (inner.results)
      : r.results != null && typeof r.results === 'object' && !Array.isArray(r.results)
        ? /** @type {Record<string, unknown>} */ (r.results)
        : d?.results != null && typeof d.results === 'object' && !Array.isArray(d.results)
          ? /** @type {Record<string, unknown>} */ (d.results)
          : null;
  if (!results) return null;
  const mesa_info =
    results.mesa_info != null && typeof results.mesa_info === 'object' && !Array.isArray(results.mesa_info)
      ? /** @type {Record<string, unknown>} */ (results.mesa_info)
      : null;
  return mesa_info;
}

/** Relay: `tablero` puede ser array, string JSON `["a","b"]`, o lista separada por comas. */
function normalizeTableroToArray(tablero) {
  if (Array.isArray(tablero)) return tablero;
  if (tablero == null) return [];
  if (typeof tablero === 'string') {
    const t = tablero.trim();
    if (!t) return [];
    if (t.startsWith('[')) {
      try {
        const j = JSON.parse(t);
        return Array.isArray(j) ? j : [];
      } catch {
        return [];
      }
    }
    if (/[,;|]/.test(t)) return t.split(/[,;|]/).map((x) => String(x).trim()).filter(Boolean);
    return [t];
  }
  return [];
}

/**
 * WinX/BFF: a veces solo `tablero` (sin `cartas_player`/`cartas_banker`); orden estándar Punto Banco P,B,P,B,…
 * @param {unknown} tablero
 * @returns {{ cartas_player: string[], cartas_banker: string[] }}
 */
function splitTableroBaccaratDealOrder(tablero) {
  const arr = normalizeTableroToArray(tablero);
  if (arr.length === 0) {
    return { cartas_player: [], cartas_banker: [] };
  }
  const cartas_player = [];
  const cartas_banker = [];
  for (let i = 0; i < arr.length; i++) {
    const tok = arr[i];
    if (tok == null) continue;
    const s = String(tok).trim();
    if (!s) continue;
    if (i % 2 === 0) cartas_player.push(s);
    else cartas_banker.push(s);
  }
  return { cartas_player, cartas_banker };
}

/** Relay: cartas como string u objeto indexado (paridad con IaRealCardTheater.coerceCardList). */
function coerceCardsField(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x ?? '').trim()).filter(Boolean);
  if (typeof raw === 'object') {
    const o = /** @type {Record<string, unknown>} */ (raw);
    return Object.keys(o)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => String(o[k] ?? '').trim())
      .filter(Boolean);
  }
  const s = String(raw).trim();
  if (!s) return [];
  if (/[,;]/.test(s)) return s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  return [s];
}

/**
 * Si los arrays canónicos siguen vacíos: `scoreDetail.player`/`banker` (o alias) y luego `mesa_info` raíz.
 * @param {unknown} rawResult
 * @param {{ ganador?: string, cartas_player?: unknown[], cartas_banker?: unknown[] }} m
 */
function applyAggressiveMesaInfoFallback(rawResult, m) {
  let ganador = m.ganador;
  let cp = [...coerceCardsField(m.cartas_player)];
  let cb = [...coerceCardsField(m.cartas_banker)];
  const r =
    rawResult != null && typeof rawResult === 'object' && !Array.isArray(rawResult)
      ? /** @type {Record<string, unknown>} */ (rawResult)
      : null;
  if (!r) return { ganador, cartas_player: cp, cartas_banker: cb };

  if (!cp.length && !cb.length) {
    const sd = unwrapSignalLikeObject(r.scoreDetail);
    if (sd) {
      const p = sd.player ?? sd.cartas_player ?? sd.player_cards;
      const b = sd.banker ?? sd.cartas_banker ?? sd.banker_cards;
      let pCo = coerceCardsField(p);
      let bCo = coerceCardsField(b);
      if (!pCo.length && !bCo.length && normalizeTableroToArray(sd.tablero).length) {
        const sp = splitTableroBaccaratDealOrder(sd.tablero);
        pCo = sp.cartas_player;
        bCo = sp.cartas_banker;
      }
      if (pCo.length) cp = pCo;
      if (bCo.length) cb = bCo;
    }
  }
  if ((!cp.length || !cb.length) && r.mesa_info != null && typeof r.mesa_info === 'object' && !Array.isArray(r.mesa_info)) {
    const mi = /** @type {Record<string, unknown>} */ (r.mesa_info);
    if (!cp.length) {
      const x = coerceCardsField(mi.cartas_player ?? mi.player_cards);
      if (x.length) cp = x;
    }
    if (!cb.length) {
      const x = coerceCardsField(mi.cartas_banker ?? mi.banker_cards);
      if (x.length) cb = x;
    }
  }
  if ((!cp.length || !cb.length) && r) {
    try {
      const flat = mergeResultEnvelopeForExtract(r);
      const md =
        flat?.martingalaData != null && typeof flat.martingalaData === 'object' && !Array.isArray(flat.martingalaData)
          ? /** @type {Record<string, unknown>} */ (flat.martingalaData)
          : null;
      const miM =
        md?.mesa_info != null && typeof md.mesa_info === 'object' && !Array.isArray(md.mesa_info)
          ? /** @type {Record<string, unknown>} */ (md.mesa_info)
          : null;
      if (miM) {
        if (!cp.length) {
          const x = coerceCardsField(miM.cartas_player ?? miM.player_cards);
          if (x.length) cp = x;
        }
        if (!cb.length) {
          const x = coerceCardsField(miM.cartas_banker ?? miM.banker_cards);
          if (x.length) cb = x;
        }
        if (ganador == null && miM.ganador != null) ganador = String(miM.ganador);
      }
    } catch {
      /* ignore */
    }
  }
  return { ganador, cartas_player: cp, cartas_banker: cb };
}

/**
 * @param {unknown} rawResult
 * @param {{ ganador?: string, cartas_player?: unknown[], cartas_banker?: unknown[] }} m
 */
function finalizeExtract(rawResult, m) {
  const out = applyAggressiveMesaInfoFallback(rawResult, {
    ganador: m.ganador,
    cartas_player: coerceCardsField(m.cartas_player),
    cartas_banker: coerceCardsField(m.cartas_banker),
  });
  const fin = {
    ...out,
    cartas_player: coerceCardsField(out.cartas_player),
    cartas_banker: coerceCardsField(out.cartas_banker),
  };
  return fin;
}

/**
 * Mesa/cartas desde NEW_RESULT relay: intenta varias formas (anidada WinX, `mesa_info` raíz, `scoreDetail`, merge).
 * Usar en UI cuando el payload cliente no trae siempre `data.data.results.mesa_info`.
 *
 * @param {unknown} rawResult
 * @returns {{ ganador?: string, cartas_player: unknown[], cartas_banker: unknown[] }}
 */
export function extractMesaInfoFlexible(rawResult) {
  /** No devolver solo por `ganador` sin cartas: deja probar el resto de ramas (p. ej. `scoreDetail`). */
  const blockHasCards = (m) =>
    (Array.isArray(m.cartas_player) && m.cartas_player.length > 0) ||
    (Array.isArray(m.cartas_banker) && m.cartas_banker.length > 0);

  /** Igual que merge: socket.io puede pasar `[payload]`; sin esto `read` queda null. */
  const root = coalesceSocketEventPayload(rawResult);

  /** Envelope `{ type, data }` con `data` string JSON: merge antes de leer (logs: rawTopKeys ["type","data"]). */
  const read =
    root != null && typeof root === 'object' && !Array.isArray(root)
      ? mergeResultEnvelopeForExtract(root)
      : null;

  const strict = extractMesaInfoFromDataDataResults(read ?? root);
  /** Solo acortar si ya hay cartas en la ruta anidada; si solo viene `ganador` (payload recortado), seguir y leer `martingalaData` / `results`. */
  const strictHasCards = blockHasCards(strict);
  if (strictHasCards) return finalizeExtract(root, strict);

  const winxMesa = findMesaInfoRecordInPayload(read ?? root);
  if (winxMesa) {
    let cp = coerceCardsField(winxMesa.cartas_player ?? winxMesa.player_cards);
    let cb = coerceCardsField(winxMesa.cartas_banker ?? winxMesa.banker_cards);
    if (!cp.length && !cb.length && normalizeTableroToArray(winxMesa.tablero).length) {
      const sp = splitTableroBaccaratDealOrder(winxMesa.tablero);
      cp = sp.cartas_player;
      cb = sp.cartas_banker;
    }
    const gan = winxMesa.ganador != null ? String(winxMesa.ganador) : undefined;
    const block = { ganador: gan, cartas_player: cp, cartas_banker: cb };
    if (blockHasCards(block)) return finalizeExtract(root, block);
  }

  /** Tras `mergeResultEnvelopeForExtract`, `results.mesa_info` puede quedar en raíz (`results` viene de `data.data`). */
  if (read != null && typeof read === 'object' && !Array.isArray(read)) {
    try {
      const flat = read;
      /** NDJSON real: `signal` puede ser objeto **o string JSON** (Mongo/relay). */
      {
        const sig = unwrapSignalLikeObject(flat.signal);
        if (sig) {
          const fs = extractMesaInfoFromResultRaw(sig);
          let blk = {
            ganador: fs.ganador,
            cartas_player: coerceCardsField(fs.cartas_player),
            cartas_banker: coerceCardsField(fs.cartas_banker),
          };
          if (blockHasCards(blk)) return finalizeExtract(root, blk);
          const fsM = extractMesaInfoFromResultRaw(mergeResultEnvelopeForExtract(sig));
          blk = {
            ganador: fsM.ganador,
            cartas_player: coerceCardsField(fsM.cartas_player),
            cartas_banker: coerceCardsField(fsM.cartas_banker),
          };
          if (blockHasCards(blk)) return finalizeExtract(root, blk);
        }
      }
      /** Relay/admin: `data.martingalaData` queda en plano tras merge; `mesa_info` puede vivir ahí (clave en logs: martingalaData). */
      const md =
        flat?.martingalaData != null && typeof flat.martingalaData === 'object' && !Array.isArray(flat.martingalaData)
          ? /** @type {Record<string, unknown>} */ (flat.martingalaData)
          : null;
      if (md) {
        const miMd =
          md.mesa_info != null && typeof md.mesa_info === 'object' && !Array.isArray(md.mesa_info)
            ? /** @type {Record<string, unknown>} */ (md.mesa_info)
            : null;
        if (miMd) {
          const cp = coerceCardsField(miMd.cartas_player ?? miMd.player_cards);
          const cb = coerceCardsField(miMd.cartas_banker ?? miMd.banker_cards);
          const gan = miMd.ganador != null ? String(miMd.ganador) : undefined;
          const block = { ganador: gan, cartas_player: cp, cartas_banker: cb };
          if (blockHasCards(block)) return finalizeExtract(root, block);
        }
      }
      const res =
        flat?.results != null && typeof flat.results === 'object' && !Array.isArray(flat.results)
          ? /** @type {Record<string, unknown>} */ (flat.results)
          : null;
      const miTop =
        res?.mesa_info != null && typeof res.mesa_info === 'object' && !Array.isArray(res.mesa_info)
          ? /** @type {Record<string, unknown>} */ (res.mesa_info)
          : null;
      if (miTop) {
        const cp = coerceCardsField(miTop.cartas_player ?? miTop.player_cards);
        const cb = coerceCardsField(miTop.cartas_banker ?? miTop.banker_cards);
        const gan = miTop.ganador != null ? String(miTop.ganador) : undefined;
        const block = { ganador: gan, cartas_player: cp, cartas_banker: cb };
        if (blockHasCards(block)) return finalizeExtract(root, block);
      }
      const strictMerged = extractMesaInfoFromDataDataResults(flat);
      if (blockHasCards(strictMerged)) return finalizeExtract(root, strictMerged);
    } catch {
      /* ignore */
    }
  }

  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    const merged = extractMesaInfoFromResultRaw(root);
    return finalizeExtract(root, {
      ganador: merged.ganador,
      cartas_player: coerceCardsField(merged.cartas_player),
      cartas_banker: coerceCardsField(merged.cartas_banker),
    });
  }

  const r = /** @type {Record<string, unknown>} */ (read ?? root);

  if (r.mesa_info != null && typeof r.mesa_info === 'object' && !Array.isArray(r.mesa_info)) {
    const mi = /** @type {Record<string, unknown>} */ (r.mesa_info);
    const cp = coerceCardsField(mi.cartas_player ?? mi.player_cards);
    const cb = coerceCardsField(mi.cartas_banker ?? mi.banker_cards);
    const gan = mi.ganador != null ? String(mi.ganador) : undefined;
    const block = { ganador: gan, cartas_player: cp, cartas_banker: cb };
    if (blockHasCards(block)) return finalizeExtract(root, block);
  }

  {
    const sd = unwrapSignalLikeObject(r.scoreDetail);
    if (sd) {
      let cp = coerceCardsField(sd.cartas_player ?? sd.player_cards ?? sd.player);
      let cb = coerceCardsField(sd.cartas_banker ?? sd.banker_cards ?? sd.banker);
      if (!cp.length && !cb.length && normalizeTableroToArray(sd.tablero).length) {
        const sp = splitTableroBaccaratDealOrder(sd.tablero);
        cp = sp.cartas_player;
        cb = sp.cartas_banker;
      }
      const gan = sd.ganador != null ? String(sd.ganador) : undefined;
      const block = { ganador: gan, cartas_player: cp, cartas_banker: cb };
      if (blockHasCards(block)) return finalizeExtract(root, block);
    }
  }

  {
    const sig = unwrapSignalLikeObject(r.signal);
    if (sig) {
      const fs = extractMesaInfoFromResultRaw(sig);
      let block = {
        ganador: fs.ganador,
        cartas_player: coerceCardsField(fs.cartas_player),
        cartas_banker: coerceCardsField(fs.cartas_banker),
      };
      if (blockHasCards(block)) return finalizeExtract(root, block);
      const fsM = extractMesaInfoFromResultRaw(mergeResultEnvelopeForExtract(sig));
      block = {
        ganador: fsM.ganador,
        cartas_player: coerceCardsField(fsM.cartas_player),
        cartas_banker: coerceCardsField(fsM.cartas_banker),
      };
      if (blockHasCards(block)) return finalizeExtract(root, block);
    }
  }

  const merged = extractMesaInfoFromResultRaw(read ?? root);
  return finalizeExtract(root, {
    ganador: merged.ganador,
    cartas_player: coerceCardsField(merged.cartas_player),
    cartas_banker: coerceCardsField(merged.cartas_banker),
  });
}

/** @param {{ cartas_player?: unknown[], cartas_banker?: unknown[] }} m */
function totalExtractedCardSlots(m) {
  const p = Array.isArray(m.cartas_player) ? m.cartas_player.length : 0;
  const b = Array.isArray(m.cartas_banker) ? m.cartas_banker.length : 0;
  return p + b;
}

/**
 * Cierre NEW_RESULT: `freshMerged` puede traer `scoreDetail`/`data` recortados y machacar el merge LOSS previo.
 * Añade claves de `freshMerged` solo si no reducen cartas extraíbles (greedy por clave).
 *
 * @param {Record<string, unknown>} prevMerged
 * @param {Record<string, unknown>} freshMerged
 * @returns {Record<string, unknown>}
 */
export function mergeSettledResultPayloadPreferringCards(prevMerged, freshMerged) {
  const pSlots = totalExtractedCardSlots(extractMesaInfoFlexible(prevMerged));
  const combined = { ...prevMerged, ...freshMerged };
  if (totalExtractedCardSlots(extractMesaInfoFlexible(combined)) >= pSlots) return combined;
  let out = { ...prevMerged };
  for (const k of Object.keys(freshMerged)) {
    const trial = { ...out, [k]: freshMerged[k] };
    if (
      totalExtractedCardSlots(extractMesaInfoFlexible(trial)) >=
      totalExtractedCardSlots(extractMesaInfoFlexible(out))
    ) {
      out = trial;
    }
  }
  if (pSlots > 0 && totalExtractedCardSlots(extractMesaInfoFlexible(out)) === 0) {
    return prevMerged;
  }
  return out;
}

/** @param {{ cartas_player?: unknown[], cartas_banker?: unknown[] }} meta */
function metaHasExtractedCards(meta) {
  return (
    (Array.isArray(meta.cartas_player) && meta.cartas_player.length > 0) ||
    (Array.isArray(meta.cartas_banker) && meta.cartas_banker.length > 0)
  );
}

/** Misma ronda con distinto tipo (8 vs "8") o alias de campo en relay. */
function roundTokensEqual(a, b) {
  const sa = String(a ?? '').trim();
  const sb = String(b ?? '').trim();
  if (sa === sb) return true;
  const na = Number(sa);
  const nb = Number(sb);
  return Number.isFinite(na) && Number.isFinite(nb) && sa !== '' && sb !== '' && na === nb;
}

/** Mesa relay vs historial: mismo nombre con distinto casing / espacios. */
function mesaTokensEqual(a, b) {
  const sa = String(a ?? '').trim().toLowerCase();
  const sb = String(b ?? '').trim().toLowerCase();
  return sa !== '' && sa === sb;
}

/**
 * `buildCorrelationKey` sin id devuelve `mesa|round`; si ambos vacíos → `"|"`, no identifica nada (evidencia NDJSON: wantCk/firstFeedCk "|").
 * @param {string} k
 */
function isTrivialCompositeCorrelationKey(k) {
  const s = String(k ?? '').trim();
  if (s.startsWith('id:')) return false;
  return s === '' || s === '|';
}

/**
 * `buildCorrelationKey` con ronda vacía → `"Mesa X|"` (NDJSON relay: `correlationKey` "Baccarat 9|").
 * No coincide con feed `firstFeedCk` `"|"` ni activa `byMesaRound` si `round` en fila sigue vacío; el singleton debe aplicar igual que para `"|"`.
 * @param {string} k
 */
function isCompositeKeyMissingRound(k) {
  const s = String(k ?? '').trim();
  if (!s || s.startsWith('id:')) return false;
  const pipe = s.indexOf('|');
  if (pipe === -1) return false;
  const mesa = s.slice(0, pipe).trim();
  const round = s.slice(pipe + 1).trim();
  return mesa !== '' && round === '';
}

/**
 * `ExternalBaccaratSignalRow.id` es interno (`genId`), no id proveedor; si se mezcla en `buildCorrelationKey` → `id:sig-…` y no coincide con el feed.
 * @param {Record<string, unknown>} rowRec
 */
function rowHintsForBuildCorrelationKey(rowRec) {
  const {
    id: _omitStoreRowId,
    rawResult: _rr,
    rawSignal: _rs,
    settledAt: _st,
    receivedAt: _rcv,
    status: _stat,
    winStatus: _ws,
    recommendation: _rec,
    algorithmDisplayName: _alg,
    ...hints
  } = rowRec;
  return hints;
}

/**
 * `rawResult` mínimo a veces arrastra `id` de otra capa; no es el id proveedor que usa `buildCorrelationKey` con `signalId`/`providerSignalId`.
 * @param {Record<string, unknown>} flat
 */
function shallowOmitIdForCorrelationKey(flat) {
  const o = { ...flat };
  delete o.id;
  return o;
}

/**
 * `logAdminRawSocketEvent` envuelve no-objeto como `{ _primitive: raw }`; si es JSON de objeto, parsear.
 * @param {Record<string, unknown>} raw
 */
function normalizeAdminFeedRawObject(raw) {
  const root0 = coalesceSocketEventPayload(raw);
  if (root0 == null || typeof root0 !== 'object' || Array.isArray(root0)) {
    return /** @type {Record<string, unknown>} */ (root0 ?? {});
  }
  const r = /** @type {Record<string, unknown>} */ (root0);
  /** BFF a veces deja el NEW_RESULT en `signal` o `payload` como string JSON (evidencia NDJSON: wantCk "|", firstFeedCk "|", slotsAfterNorm 0). */
  if (typeof r.signal === 'string') {
    const u = unwrapSignalLikeObject(r.signal);
    if (u && typeof u === 'object' && !Array.isArray(u)) {
      return normalizeAdminFeedRawObject(/** @type {Record<string, unknown>} */ (u));
    }
  }
  if (typeof r.payload === 'string') {
    const t = r.payload.trim();
    if (t.startsWith('{') || t.startsWith('[')) {
      try {
        const parsed = JSON.parse(t);
        if (parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return normalizeAdminFeedRawObject(/** @type {Record<string, unknown>} */ (parsed));
        }
      } catch {
        /* noop */
      }
    }
  }
  /** A veces se guarda el marco `signal_stream_frame` entero en lugar de `layers.raw` (NDJSON: firstFeedCk "|" y sin cartas). */
  if (r.layers != null && typeof r.layers === 'object' && !Array.isArray(r.layers)) {
    const lr = /** @type {Record<string, unknown>} */ (r.layers).raw;
    if (lr != null && typeof lr === 'object' && !Array.isArray(lr)) {
      return normalizeAdminFeedRawObject(/** @type {Record<string, unknown>} */ (lr));
    }
    /** `layers.raw` puede ser string JSON (relay); sin parse el merge no ve `data.data.results.mesa_info`. */
    if (typeof lr === 'string') {
      const t = lr.trim();
      if (t.startsWith('{') || t.startsWith('[')) {
        try {
          const parsed = JSON.parse(t);
          const inner = coalesceSocketEventPayload(parsed);
          if (inner != null && typeof inner === 'object' && !Array.isArray(inner)) {
            return normalizeAdminFeedRawObject(/** @type {Record<string, unknown>} */ (inner));
          }
        } catch {
          /* noop */
        }
      }
    }
  }
  if ('_primitive' in r) {
    const p = r._primitive;
    if (typeof p === 'string') {
      const t = p.trim();
      if (t.startsWith('{') || t.startsWith('[')) {
        try {
          const parsed = JSON.parse(t);
          if (parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)) {
            /** Recurse: `_primitive` puede ser marco con `layers.raw` string (evidencia: augment miss con "|" y 1 NEW_RESULT). */
            return normalizeAdminFeedRawObject(/** @type {Record<string, unknown>} */ (parsed));
          }
        } catch {
          /* noop */
        }
      }
    }
  }
  return r;
}

/**
 * NDJSON: `wantPid` / `id:` tail en outcome pero `firstFeedCk` otra mesa — id solo en JSON anidado.
 * @param {unknown} raw
 * @param {string} id
 */
function adminRawJsonContainsIdSubstring(raw, id) {
  const t = String(id ?? '').trim();
  if (!t || t.length < 4) return false;
  try {
    if (typeof raw === 'string') return raw.includes(t);
    return JSON.stringify(raw).includes(t);
  } catch {
    return false;
  }
}

/** `wantCk` tipo `id:xxx` vs feed con `firstFeedCk` mesa|ronda (NDJSON: id:sig-777 vs M2|12). */
function idTailFromCorrelationKey(ck) {
  const s = String(ck ?? '').trim();
  return s.startsWith('id:') ? s.slice(3).trim() : '';
}

/**
 * IDs / provider keys en relay (evidencia NDJSON: `wantPid` numérico pero `firstFeedCk` mesa|ronda distinta;
 * `firstFeedPid` vacío — el id suele vivir bajo `data` / `data.data`, no en raíz).
 * @param {Record<string, unknown>} flat
 * @param {Record<string, unknown>} r
 */
function feedCandidateIds(flat, r) {
  /** @type {Set<string>} */
  const ids = new Set();
  const add = (v) => {
    if (v == null) return;
    const t = String(v).trim();
    if (t) ids.add(t);
  };
  const walk = (obj, depth) => {
    if (obj == null || depth > 4) return;
    if (typeof obj !== 'object' || Array.isArray(obj)) return;
    const o = /** @type {Record<string, unknown>} */ (obj);
    add(o.id);
    add(o.signalId);
    add(o.providerSignalId);
    add(o.signal_id);
    for (const k of ['data', 'payload', 'body', 'layers']) {
      const ch = o[k];
      if (ch != null && typeof ch === 'object' && !Array.isArray(ch)) {
        walk(/** @type {Record<string, unknown>} */ (ch), depth + 1);
      }
    }
  };
  walk(flat, 0);
  walk(r, 0);
  return ids;
}

/**
 * `activeRow` / fila con `rawSignal` rico cuando `adminRawFeed` solo tiene tick mínimo (evidencia NDJSON: `slotsAfterNorm` 0).
 * @param {unknown} base
 * @param {Record<string, unknown>} rowRec
 * @returns {unknown | null}
 */
function tryMergeBaseWithRowRawSignal(base, rowRec) {
  if (rowRec.rawSignal == null || typeof rowRec.rawSignal !== 'object' || Array.isArray(rowRec.rawSignal)) {
    return null;
  }
  const baseRec =
    base != null && typeof base === 'object' && !Array.isArray(base)
      ? /** @type {Record<string, unknown>} */ (base)
      : {};
  const rs = /** @type {Record<string, unknown>} */ (rowRec.rawSignal);
  const flatSig = mergeResultEnvelopeForExtract(rs);
  const candidates = [
    mergeCoalescedPayloadWithEnvelopeExtract({ ...baseRec, ...rs }),
    mergeCoalescedPayloadWithEnvelopeExtract({ ...baseRec, ...flatSig }),
    mergeCoalescedPayloadWithEnvelopeExtract(rs),
  ];
  for (const cand of candidates) {
    if (
      cand != null &&
      typeof cand === 'object' &&
      !Array.isArray(cand) &&
      metaHasExtractedCards(extractMesaInfoFlexible(cand))
    ) {
      return cand;
    }
  }
  return null;
}

/**
 * `rawSignal` a veces es solo señal/vector; el cuerpo con `mesa_info` vive en `rawResult` de la fila activa (NDJSON: slotsFromFallbackRawSignal 0).
 * @param {unknown} base
 * @param {Record<string, unknown>} rowRec
 * @returns {unknown | null}
 */
function tryMergeBaseWithRowRawResultPayload(base, rowRec) {
  const alt = resolveOutcomeRowResultPayload(rowRec);
  if (alt == null || typeof alt !== 'object' || Array.isArray(alt)) return null;
  const baseRec =
    base != null && typeof base === 'object' && !Array.isArray(base)
      ? /** @type {Record<string, unknown>} */ (base)
      : {};
  const altFlat = mergeResultEnvelopeForExtract(/** @type {Record<string, unknown>} */ (alt));
  const merged = mergeCoalescedPayloadWithEnvelopeExtract({ ...baseRec, ...altFlat });
  if (metaHasExtractedCards(extractMesaInfoFlexible(merged))) return merged;
  return null;
}

/**
 * @param {unknown} base
 * @param {Record<string, unknown>} rowRec
 * @returns {unknown | null}
 */
function tryMergeBaseWithRowEnrichment(base, rowRec) {
  const fromSignal = tryMergeBaseWithRowRawSignal(base, rowRec);
  if (fromSignal != null) return fromSignal;
  return tryMergeBaseWithRowRawResultPayload(base, rowRec);
}

/**
 * @param {unknown} base
 * @param {Array<Record<string, unknown> | null | undefined>} rowRecs
 * @returns {unknown | null}
 */
function tryMergeFromRowRawSignals(base, rowRecs) {
  const seen = new WeakSet();
  for (const rowRec of rowRecs) {
    if (!rowRec || typeof rowRec !== 'object' || Array.isArray(rowRec)) continue;
    if (seen.has(rowRec)) continue;
    seen.add(rowRec);
    const m = tryMergeBaseWithRowEnrichment(base, rowRec);
    if (m != null) return m;
  }
  return null;
}

/** @param {unknown} base @param {Record<string, unknown>} rowRec — máx. slots tras merge signal o rawResult */
function totalSlotsFromRowEnrichmentDiagnostic(base, rowRec) {
  let max = -1;
  if (rowRec.rawSignal != null && typeof rowRec.rawSignal === 'object' && !Array.isArray(rowRec.rawSignal)) {
    const br =
      base != null && typeof base === 'object' && !Array.isArray(base)
        ? /** @type {Record<string, unknown>} */ (base)
        : {};
    const rs = /** @type {Record<string, unknown>} */ (rowRec.rawSignal);
    const m = mergeCoalescedPayloadWithEnvelopeExtract({
      ...br,
      ...mergeResultEnvelopeForExtract(rs),
    });
    max = Math.max(max, totalExtractedCardSlots(extractMesaInfoFlexible(m)));
  }
  const alt = resolveOutcomeRowResultPayload(rowRec);
  if (alt != null && typeof alt === 'object' && !Array.isArray(alt)) {
    const br =
      base != null && typeof base === 'object' && !Array.isArray(base)
        ? /** @type {Record<string, unknown>} */ (base)
        : {};
    const merged = mergeCoalescedPayloadWithEnvelopeExtract({
      ...br,
      ...mergeResultEnvelopeForExtract(/** @type {Record<string, unknown>} */ (alt)),
    });
    max = Math.max(max, totalExtractedCardSlots(extractMesaInfoFlexible(merged)));
  }
  return max;
}

/** Buffer admin: `raw` a veces es **string** JSON; antes se ignoraba en `typeof raw === 'object'` (NDJSON wantCk "|", 1 NEW_RESULT). */
function coerceAdminFeedEntryRaw(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return /** @type {Record<string, unknown>} */ (raw);
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t.startsWith('{') && !t.startsWith('[')) return null;
    try {
      const p = JSON.parse(t);
      if (p != null && typeof p === 'object' && !Array.isArray(p)) {
        return /** @type {Record<string, unknown>} */ (p);
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Historial puede guardar solo el sobre BFF mínimo; `logAdminRawSocketEvent` suele conservar el cuerpo completo
 * del mismo `NEW_RESULT` (misma correlación / mesa+ronda).
 *
 * @param {{ rawResult?: unknown, correlationKey?: string, mesa?: string, round?: string, rawSignal?: Record<string, unknown> | null } | null | undefined} outcomeRow
 * @param {Array<{ type: string, raw: Record<string, unknown> }> | null | undefined} adminRawFeed
 * @param {{ rawSignal?: Record<string, unknown> | null, rawResult?: unknown } | null | undefined} [signalFallbackRow] — p. ej. `activeRow` (rawSignal y/o rawResult; NDJSON: enrichment 0 si solo vector).
 * @returns {unknown | null}
 */
export function augmentOutcomePayloadFromAdminRaw(outcomeRow, adminRawFeed, signalFallbackRow = null) {
  const rowRec =
    outcomeRow != null && typeof outcomeRow === 'object' && !Array.isArray(outcomeRow)
      ? /** @type {Record<string, unknown>} */ (outcomeRow)
      : {};
  const fallbackRec =
    signalFallbackRow != null && typeof signalFallbackRow === 'object' && !Array.isArray(signalFallbackRow)
      ? /** @type {Record<string, unknown>} */ (signalFallbackRow)
      : null;

  const baseFromOutcome = resolveOutcomeRowResultPayload(outcomeRow);
  let base = baseFromOutcome;
  if (base == null && fallbackRec != null) {
    base = resolveOutcomeRowResultPayload(fallbackRec);
  }
  if (base == null) {
    const rowOnly = tryMergeFromRowRawSignals(null, [rowRec, fallbackRec]);
    if (rowOnly != null) return rowOnly;
    return null;
  }

  // #region agent log
  if (
    import.meta.env.DEV &&
    typeof fetch !== 'undefined' &&
    baseFromOutcome == null &&
    base != null
  ) {
    fetch(getDebugIngestUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '3126a9' },
      body: JSON.stringify({
        sessionId: '3126a9',
        location: 'iaRealEngineUi.js:augmentOutcomePayloadFromAdminRaw',
        message: 'base resolved from signalFallbackRow (outcome had no rawResult)',
        data: {
          outcomeHasId: outcomeRow?.id != null,
          fallbackHasId: fallbackRec?.id != null,
        },
        timestamp: Date.now(),
        hypothesisId: 'H-base-from-fallback-row',
        runId: 'repro',
      }),
    }).catch(() => {});
  }
  // #endregion

  if (metaHasExtractedCards(extractMesaInfoFlexible(base))) return base;

  if (!Array.isArray(adminRawFeed) || adminRawFeed.length === 0) {
    return tryMergeFromRowRawSignals(base, [rowRec, fallbackRec]) ?? base;
  }

  const baseFlat =
    base != null && typeof base === 'object' && !Array.isArray(base)
      ? mergeResultEnvelopeForExtract(/** @type {Record<string, unknown>} */ (base))
      : {};
  let wantCkFromRow =
    outcomeRow?.correlationKey != null ? String(outcomeRow.correlationKey).trim() : '';
  if (!wantCkFromRow && fallbackRec?.correlationKey != null) {
    wantCkFromRow = String(fallbackRec.correlationKey).trim();
  }
  /** Store usa `buildCorrelationKey`; omitir `id` superficial en base+row (evidencia: wantCk `id:singleton-row` falso). */
  const wantCk =
    wantCkFromRow ||
    buildCorrelationKey({
      ...shallowOmitIdForCorrelationKey(/** @type {Record<string, unknown>} */ (baseFlat)),
      ...rowHintsForBuildCorrelationKey(rowRec),
      ...rowHintsForBuildCorrelationKey(fallbackRec ?? /** @type {Record<string, unknown>} */ ({})),
    });

  let wantMesa = outcomeRow?.mesa != null ? String(outcomeRow.mesa).trim() : '';
  if (!wantMesa) {
    wantMesa = String(baseFlat.mesa ?? baseFlat.table ?? baseFlat.tableName ?? '').trim();
  }
  if (!wantMesa && fallbackRec?.mesa != null) {
    wantMesa = String(fallbackRec.mesa).trim();
  }
  let wantRound = outcomeRow?.round != null ? String(outcomeRow.round).trim() : '';
  if (!wantRound) {
    const br =
      baseFlat.round ??
      baseFlat.ronda ??
      baseFlat.roundId ??
      baseFlat.gameRound ??
      baseFlat.hand;
    wantRound = br != null ? String(br).trim() : '';
  }
  if (!wantRound && fallbackRec?.round != null) {
    wantRound = String(fallbackRec.round).trim();
  }

  let wantPid =
    rowRec.providerSignalId != null ? String(rowRec.providerSignalId).trim() : '';
  if (!wantPid && fallbackRec?.providerSignalId != null) {
    wantPid = String(fallbackRec.providerSignalId).trim();
  }

  if ((!wantMesa || !wantRound) && rowRec.rawSignal != null && typeof rowRec.rawSignal === 'object') {
    const rf = mergeResultEnvelopeForExtract(/** @type {Record<string, unknown>} */ (rowRec.rawSignal));
    if (!wantMesa) {
      wantMesa = String(rf.mesa ?? rf.table ?? rf.tableName ?? '').trim();
    }
    if (!wantRound) {
      const br = rf.round ?? rf.ronda ?? rf.roundId ?? rf.gameRound ?? rf.hand;
      if (br != null) wantRound = String(br).trim();
    }
    if (!wantPid && rf.providerSignalId != null) {
      wantPid = String(rf.providerSignalId).trim();
    }
  }
  if ((!wantMesa || !wantRound || !wantPid) && fallbackRec?.rawSignal != null && typeof fallbackRec.rawSignal === 'object') {
    const rf = mergeResultEnvelopeForExtract(/** @type {Record<string, unknown>} */ (fallbackRec.rawSignal));
    if (!wantMesa) {
      wantMesa = String(rf.mesa ?? rf.table ?? rf.tableName ?? '').trim();
    }
    if (!wantRound) {
      const br = rf.round ?? rf.ronda ?? rf.roundId ?? rf.gameRound ?? rf.hand;
      if (br != null) wantRound = String(br).trim();
    }
    if (!wantPid && rf.providerSignalId != null) {
      wantPid = String(rf.providerSignalId).trim();
    }
  }

  const wantIdTail = idTailFromCorrelationKey(wantCk);

  for (const entry of adminRawFeed) {
    if (!entry || entry.type !== 'NEW_RESULT') continue;
    const rawObj = coerceAdminFeedEntryRaw(entry.raw);
    if (!rawObj) continue;
    const r = normalizeAdminFeedRawObject(rawObj);
    /** Relay/BFF a menudo envía `correlationKey` / mesa / ronda bajo `data` u hojas anidadas; la raíz puede tener pocas claves y antes se descartaba el evento por un umbral arbitrario. */
    const flat = mergeResultEnvelopeForExtract(r);
    const feedCk = buildCorrelationKey(flat);
    const ckExplicit = flat.correlationKey != null ? String(flat.correlationKey).trim() : '';
    const mesa = String(flat.mesa ?? flat.table ?? flat.tableName ?? r.mesa ?? r.table ?? r.tableName ?? '').trim();
    const round =
      flat.round ??
      flat.ronda ??
      flat.roundId ??
      flat.gameRound ??
      flat.hand ??
      r.round ??
      r.ronda ??
      r.roundId;
    const roundStr = round != null ? String(round).trim() : '';
    const byCk = Boolean(
      wantCk &&
        feedCk &&
        !isTrivialCompositeCorrelationKey(wantCk) &&
        !isTrivialCompositeCorrelationKey(feedCk) &&
        (feedCk === wantCk || (ckExplicit && ckExplicit === wantCk)),
    );
    const feedIdentityIds = feedCandidateIds(flat, r);
    const feedPid =
      flat.providerSignalId != null
        ? String(flat.providerSignalId).trim()
        : r.providerSignalId != null
          ? String(r.providerSignalId).trim()
          : '';
    /** `wantPid` a menudo coincide con `id` anidado, no solo `providerSignalId` en raíz (NDJSON: firstFeedPid ""). */
    const byPid = Boolean(wantPid && (feedPid === wantPid || feedIdentityIds.has(String(wantPid).trim())));
    const bySignalId = Boolean(wantIdTail && feedIdentityIds.has(wantIdTail));
    const byIdInRawBlob = Boolean(
      (wantPid && adminRawJsonContainsIdSubstring(entry.raw, wantPid)) ||
        (wantIdTail && adminRawJsonContainsIdSubstring(entry.raw, wantIdTail)),
    );
    const byMesaRound = Boolean(
      wantMesa &&
        wantRound &&
        mesaTokensEqual(mesa, wantMesa) &&
        roundTokensEqual(roundStr, wantRound),
    );
    /** NDJSON: wantRound 53 vs firstFeedCk `Baccarat 1|55` — outcome/base arrastra ronda vieja; buffer trae mano nueva misma mesa. */
    const byMesaRoundDrift = Boolean(
      wantMesa &&
        mesaTokensEqual(mesa, wantMesa) &&
        Boolean(wantRound) &&
        Boolean(roundStr) &&
        !roundTokensEqual(roundStr, wantRound),
    );
    if (!byCk && !byMesaRound && !byMesaRoundDrift && !byPid && !bySignalId && !byIdInRawBlob) continue;

    const baseRec =
      base != null && typeof base === 'object' && !Array.isArray(base)
        ? /** @type {Record<string, unknown>} */ (base)
        : {};
    /** Feed `r` primero en el spread pierde frente a `baseRec`; el historial suele traer `scoreDetail` mínimo y machaca cartas del feed. Orden: base (historial) y encima el RAW admin (más completo). */
    const mergedCandidates = [
      mergeCoalescedPayloadWithEnvelopeExtract({ ...baseRec, ...r }),
      mergeCoalescedPayloadWithEnvelopeExtract(r),
      mergeResultEnvelopeForExtract(r),
    ];
    for (const merged of mergedCandidates) {
      if (merged != null && typeof merged === 'object' && !Array.isArray(merged) && metaHasExtractedCards(extractMesaInfoFlexible(merged))) {
        return merged;
      }
    }
  }

  const newResultObjs = adminRawFeed.filter(
    (e) => e && e.type === 'NEW_RESULT' && coerceAdminFeedEntryRaw(e.raw) != null,
  );
  const identityVacuous =
    !wantPid &&
    (!wantMesa || !wantRound) &&
    (isTrivialCompositeCorrelationKey(wantCk) || isCompositeKeyMissingRound(wantCk));
  /** Buffer en orden reciente→antiguo: el primero puede ser tick mínimo; recorrer todos si identidad es débil (evidencia: slotsAfterNorm 0 en primera entrada). */
  if (newResultObjs.length >= 1 && identityVacuous) {
    for (const nrEntry of newResultObjs) {
      const r = normalizeAdminFeedRawObject(/** @type {Record<string, unknown>} */ (nrEntry.raw));
      const baseRec =
        base != null && typeof base === 'object' && !Array.isArray(base)
          ? /** @type {Record<string, unknown>} */ (base)
          : {};
      const candidates = [
        mergeCoalescedPayloadWithEnvelopeExtract({ ...baseRec, ...r }),
        mergeCoalescedPayloadWithEnvelopeExtract(r),
        mergeResultEnvelopeForExtract(r),
        coalesceSocketEventPayload(r),
        r,
      ];
      for (const cand of candidates) {
        if (cand == null || typeof cand !== 'object' || Array.isArray(cand)) continue;
        const rec = /** @type {Record<string, unknown>} */ (cand);
        if (metaHasExtractedCards(extractMesaInfoFlexible(rec))) {
          return rec;
        }
      }
    }
  }

  const fromRawSignal = tryMergeFromRowRawSignals(base, [rowRec, fallbackRec]);
  if (fromRawSignal != null) return fromRawSignal;

  // #region agent log
  if (
    isIaRealExtractDebugEnabled() &&
    typeof fetch !== 'undefined' &&
    !metaHasExtractedCards(extractMesaInfoFlexible(base))
  ) {
    const nr = adminRawFeed.filter((e) => e && e.type === 'NEW_RESULT' && coerceAdminFeedEntryRaw(e.raw) != null)
      .length;
    if (nr > 0) {
      fetch(getDebugIngestUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '3126a9' },
        body: JSON.stringify({
          sessionId: '3126a9',
          location: 'iaRealEngineUi.js:augmentOutcomePayloadFromAdminRaw',
          message: 'augment miss after feed scan',
          data: {
            wantCk,
            wantCkMissingRound: isCompositeKeyMissingRound(wantCk),
            wantMesa,
            wantRound,
            wantPid,
            newResultEntries: nr,
            firstFeedCk: (() => {
              const e = adminRawFeed.find((x) => x && x.type === 'NEW_RESULT' && coerceAdminFeedEntryRaw(x.raw));
              const fr = e?.raw != null ? coerceAdminFeedEntryRaw(e.raw) : null;
              if (!fr) return '';
              return buildCorrelationKey(mergeResultEnvelopeForExtract(fr));
            })(),
            firstFeedPid: (() => {
              const e = adminRawFeed.find((x) => x && x.type === 'NEW_RESULT' && coerceAdminFeedEntryRaw(x.raw));
              const fr = e?.raw != null ? coerceAdminFeedEntryRaw(e.raw) : null;
              if (!fr) return '';
              const fl = mergeResultEnvelopeForExtract(fr);
              const p = fl.providerSignalId ?? fr.providerSignalId;
              return p != null ? String(p).trim() : '';
            })(),
            slotsAfterNorm: (() => {
              const e = adminRawFeed.find((x) => x && x.type === 'NEW_RESULT' && coerceAdminFeedEntryRaw(x.raw));
              const fr = e?.raw != null ? coerceAdminFeedEntryRaw(e.raw) : null;
              if (!fr) return -1;
              const nrm = normalizeAdminFeedRawObject(fr);
              const m = extractMesaInfoFlexible(mergeCoalescedPayloadWithEnvelopeExtract(nrm));
              return totalExtractedCardSlots(m);
            })(),
            slotsFromOutcomeEnrichment: totalSlotsFromRowEnrichmentDiagnostic(base, rowRec),
            slotsFromFallbackEnrichment:
              fallbackRec != null ? totalSlotsFromRowEnrichmentDiagnostic(base, fallbackRec) : -2,
            firstRawShape: (() => {
              const e = adminRawFeed.find((x) => x && x.type === 'NEW_RESULT');
              if (e?.raw == null) return 'none';
              const r = e.raw;
              if (typeof r === 'string') return 'string';
              if (typeof r === 'object' && r !== null && !Array.isArray(r) && '_primitive' in r) {
                return 'object+_primitive';
              }
              return 'object';
            })(),
          },
          timestamp: Date.now(),
          hypothesisId: 'H-augment-miss',
          runId: 'repro',
        }),
      }).catch(() => {});
    }
  }
  // #endregion
  return base;
}

/**
 * NEW_RESULT canónico: solo `payload.data.data.results.mesa_info` (sin fallbacks).
 * @param {unknown} rawResult
 * @returns {{ ganador?: string, cartas_player: unknown[], cartas_banker: unknown[] }}
 */
export function extractMesaInfoFromDataDataResults(rawResult) {
  if (!rawResult || typeof rawResult !== 'object' || Array.isArray(rawResult)) {
    return { cartas_player: [], cartas_banker: [] };
  }
  const r = /** @type {Record<string, unknown>} */ (rawResult);
  const d0 = dataLayerAsRecord(r.data);
  const d1 =
    d0?.data != null && typeof d0.data === 'object' && !Array.isArray(d0.data)
      ? /** @type {Record<string, unknown>} */ (d0.data)
      : null;
  const results =
    d1?.results != null && typeof d1.results === 'object' && !Array.isArray(d1.results)
      ? /** @type {Record<string, unknown>} */ (d1.results)
      : d0?.results != null && typeof d0.results === 'object' && !Array.isArray(d0.results)
        ? /** @type {Record<string, unknown>} */ (d0.results)
        : null;
  const mesaInfo =
    results?.mesa_info != null && typeof results.mesa_info === 'object' && !Array.isArray(results.mesa_info)
      ? /** @type {Record<string, unknown>} */ (results.mesa_info)
      : null;
  if (!mesaInfo) return { cartas_player: [], cartas_banker: [] };
  let cp = Array.isArray(mesaInfo.cartas_player) ? [...mesaInfo.cartas_player] : [];
  let cb = Array.isArray(mesaInfo.cartas_banker) ? [...mesaInfo.cartas_banker] : [];
  if (cp.length === 0 && cb.length === 0 && normalizeTableroToArray(mesaInfo.tablero).length) {
    const sp = splitTableroBaccaratDealOrder(mesaInfo.tablero);
    cp = sp.cartas_player;
    cb = sp.cartas_banker;
  }
  const ganRaw = mesaInfo.ganador != null ? String(mesaInfo.ganador) : undefined;
  return { ganador: ganRaw, cartas_player: cp, cartas_banker: cb };
}

/** @param {string | undefined} rec */
export function formatRecommendationDisplay(rec) {
  const s = String(rec ?? '').trim();
  if (!s || s === 'UNKNOWN') return '—';
  return s;
}

/** @param {unknown} token — vector_forecast cell (P, B, PLAYER, etc.) */
export function normalizeForecastCellLetter(token) {
  const s = String(token ?? '').trim().toUpperCase();
  if (!s) return '';
  if (s.startsWith('P') || s.includes('PLAY')) return 'P';
  if (s.startsWith('B') || s.includes('BANK')) return 'B';
  if (s.startsWith('T') || s.includes('TIE') || s === 'E') return 'T';
  const c = s.slice(0, 1);
  if (c === 'P' || c === 'B' || c === 'T') return c;
  return '';
}

/**
 * PLAYER vs BANKER for center prediction styling (same mapping as vector).
 * @param {string | undefined} rec
 * @returns {'PLAYER' | 'BANKER' | 'TIE' | 'OTHER'}
 */
export function recommendationSide(rec) {
  const u = String(rec ?? '').trim().toUpperCase();
  if (!u || u === 'UNKNOWN') return 'OTHER';
  if (u === 'PLAYER' || u === 'P' || u.startsWith('PLAY')) return 'PLAYER';
  if (u === 'BANKER' || u === 'B' || u.startsWith('BANK')) return 'BANKER';
  if (u === 'TIE' || u === 'T' || u.startsWith('TIE')) return 'TIE';
  return 'OTHER';
}

/**
 * 0-based index into `vector_forecast` from provider `contador_martingala` (no local increments).
 * Same index rule as `predictionSideFromVectorAndContador` / core-api relay.
 * @param {{ martingale?: unknown, rawSignal?: Record<string, unknown> | null } | null | undefined} row
 * @param {number} len
 */
export function forecastStepIndexFromProviderRow(row, len) {
  if (!len) return 0;
  const contador = resolveContadorMartingalaForUi(row);
  const idx = forecastStepIndexFromContador(contador);
  return Math.min(idx, len - 1);
}

/**
 * Priority: store `martingale` ≥ 1, else `contador_martingala` from rawSignal, else 1.
 * Prediction index = vector_forecast[contador − 1] via {@link forecastStepIndexFromContador}.
 * @param {{ martingale?: unknown, rawSignal?: Record<string, unknown> | null } | null | undefined} row
 * @returns {number}
 */
export function resolveContadorMartingalaForUi(row) {
  if (!row) return 1;
  const fromStore = Number(row.martingale);
  if (Number.isFinite(fromStore) && fromStore >= 1) return fromStore;
  const fromRaw = row.rawSignal != null ? pickContadorMartingalaFromSignalRaw(row.rawSignal) : null;
  const rawNum =
    fromRaw != null && String(fromRaw).trim() !== '' && Number.isFinite(Number(fromRaw))
      ? Number(fromRaw)
      : null;
  return rawNum != null && rawNum >= 1 ? rawNum : 1;
}

/** Tras NEW_RESULT, `phaseVisual` es una sola fase (`RESULT`); el contador del strip usa `outcomeRow`. */
const POST_RESULT_CONTADOR_PHASES = new Set(['RESULT', 'MARTINGALE_UPDATE', 'FINAL_HOLD']);

/**
 * During the cinematic sequence, use provider post-result contador only after martingale update phase.
 * @param {object | null | undefined} activeRow
 * @param {object | null | undefined} outcomeRow
 * @param {string | null | undefined} phaseVisual
 * @param {string | undefined} status
 */
export function iaRealContadorForStrip(activeRow, outcomeRow, phaseVisual, status) {
  if (
    (status === 'RESULT' || status === 'RESULT_SEQUENCE') &&
    outcomeRow &&
    phaseVisual &&
    POST_RESULT_CONTADOR_PHASES.has(phaseVisual)
  ) {
    return pickContadorFromOutcomeForMartingaleUi(outcomeRow, activeRow);
  }
  return resolveContadorMartingalaForUi(activeRow);
}

/**
 * @deprecated use forecastStepIndexFromProviderRow — kept for call sites
 */
export function iaRealActiveShotIndex(row, len) {
  return forecastStepIndexFromProviderRow(row, len);
}

/** @param {unknown} ganador */
export function normalizeGanadorSide(ganador) {
  const u = String(ganador ?? '').trim().toUpperCase();
  if (!u || u === '—') return 'OTHER';
  if (u.includes('TIE') || u.includes('EMPATE') || u === 'T') return 'TIE';
  if (u.includes('PLAY') || u === 'P') return 'PLAYER';
  if (u.includes('BANK')) return 'BANKER';
  return 'OTHER';
}

/**
 * Real-only: prediction vs mesa ganador (no RNG).
 * @param {string | undefined} recommendation
 * @param {string | undefined} ganadorRaw
 */
export function doesPredictionMatchGanador(recommendation, ganadorRaw) {
  const pred = recommendationSide(recommendation);
  const g = normalizeGanadorSide(ganadorRaw);
  if (pred === 'OTHER' || g === 'OTHER') return false;
  if (pred === 'TIE' && g === 'TIE') return true;
  if (pred === 'TIE' || g === 'TIE') return pred === g;
  return pred === g;
}

/**
 * Index of the vector cell whose letter matches the resolved ganador (P/B/T), or -1.
 * @param {string[]} vf
 * @param {string | undefined} ganadorRaw
 */
export function winnerVectorIndexFromGanador(vf, ganadorRaw) {
  const g = normalizeGanadorSide(ganadorRaw);
  const want = g === 'PLAYER' ? 'P' : g === 'BANKER' ? 'B' : g === 'TIE' ? 'T' : '';
  if (!want || !vf?.length) return -1;
  return vf.findIndex((t) => normalizeForecastCellLetter(t) === want);
}

/**
 * @param {unknown} rawResult
 */
export function extractScoreLabelsFromResultRaw(rawResult) {
  const meta = extractMesaInfoFromResultRaw(rawResult);
  const r =
    rawResult != null && typeof rawResult === 'object' && !Array.isArray(rawResult)
      ? /** @type {Record<string, unknown>} */ (rawResult)
      : {};
  const sc = r.scoreDetail && typeof r.scoreDetail === 'object' ? /** @type {Record<string, unknown>} */ (r.scoreDetail) : {};
  const puntP = meta.puntaje_player ?? sc.puntaje_player ?? sc.playerScore;
  const puntB = meta.puntaje_banker ?? sc.puntaje_banker ?? sc.bankerScore;
  return {
    puntajePlayer: puntP != null ? String(puntP) : null,
    puntajeBanker: puntB != null ? String(puntB) : null,
  };
}

function parseBaccaratPointsLabelForLive(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[^\d]/g, ''));
  if (!Number.isFinite(n)) return null;
  const x = Math.floor(n);
  if (x < 0 || x > 9) return null;
  return x;
}

/**
 * Live Control: puntajes PLAYER/BANKER (0–9 o null) desde fila store/historial.
 * Usa {@link resolveOutcomeRowResultPayload} para `rawResult` stringificado / doble JSON (relay/Mongo).
 * @param {{ rawResult?: unknown } | null | undefined} row
 * @returns {{ player: number | null, banker: number | null }}
 */
export function liveScoresFromOutcomeRow(row) {
  if (row == null || typeof row !== 'object' || Array.isArray(row)) {
    return { player: null, banker: null };
  }
  const rec = /** @type {Record<string, unknown>} */ (row);
  let raw = resolveOutcomeRowResultPayload(rec);
  if (raw == null) raw = rec.rawResult ?? null;
  for (let d = 0; d < 8 && raw != null && typeof raw === 'string'; d++) {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
      break;
    }
  }
  if (raw != null && (typeof raw !== 'object' || Array.isArray(raw))) raw = null;
  const { puntajePlayer, puntajeBanker } = extractScoreLabelsFromResultRaw(raw);
  return {
    player: parseBaccaratPointsLabelForLive(puntajePlayer),
    banker: parseBaccaratPointsLabelForLive(puntajeBanker),
  };
}

/**
 * Vector cell: P = cyan/blue, B = rose/red (system tones). Optional active emphasis.
 * @param {unknown} token
 * @param {boolean} isLightMode
 * @param {boolean} isActive
 * @param {boolean} [isOutcomeMatch] — result phase: cell letter matches mesa ganador
 */
/**
 * Waiting phase only: visually de-emphasize vector cells before the active martingale step (“past”)
 * and slightly soften cells after (“future”). Does not change engine state.
 * @param {number} idx
 * @param {number} activeIdx
 */
export function iaRealVectorMaturityDimClass(idx, activeIdx) {
  if (idx < activeIdx) return ' opacity-[0.38] saturate-[0.7] ';
  if (idx > activeIdx) return ' opacity-[0.62] ';
  return '';
}

/**
 * Result phase: dim cells that are neither the winning resolution cell nor the active step (context only).
 * @param {number} idx
 * @param {number} activeIdx
 * @param {number} winIdx
 */
export function iaRealVectorResultDimClass(idx, activeIdx, winIdx) {
  const isWin = winIdx >= 0 && idx === winIdx;
  const isActive = idx === activeIdx;
  if (isWin || isActive) return '';
  return ' opacity-45 ';
}

export function iaRealVectorCellToneClasses(token, isLightMode, isActive, isOutcomeMatch = false) {
  const L = normalizeForecastCellLetter(token);
  const emphasis = isActive ? ' scale-105 z-[1] ring-2 ring-offset-0 ' : '';
  const outcomeRing = isOutcomeMatch
    ? ' ring-2 ring-emerald-400/95 shadow-[0_0_22px_rgba(52,211,153,0.55)] z-[2] '
    : '';

  if (L === 'P') {
    const base = isLightMode
      ? 'border-cyan-500 text-cyan-800 bg-cyan-500/12'
      : 'border-cyan-400/85 text-cyan-100 bg-cyan-500/18';
    const glow = isActive
      ? isLightMode
        ? ' ring-cyan-400 shadow-[0_0_16px_rgba(6,182,212,0.45)] '
        : ' ring-cyan-300/90 shadow-[0_0_20px_rgba(34,211,238,0.5)] '
      : '';
    return `${base}${emphasis}${glow}${outcomeRing}`;
  }
  if (L === 'B') {
    const base = isLightMode
      ? 'border-rose-500/95 text-rose-900 bg-rose-500/10'
      : 'border-rose-400/80 text-rose-100 bg-rose-500/16';
    const glow = isActive
      ? isLightMode
        ? ' ring-rose-400 shadow-[0_0_16px_rgba(244,63,94,0.4)] '
        : ' ring-rose-400/90 shadow-[0_0_20px_rgba(251,113,133,0.45)] '
      : '';
    return `${base}${emphasis}${glow}${outcomeRing}`;
  }
  if (L === 'T') {
    const base = isLightMode
      ? 'border-slate-400 text-slate-700 bg-slate-500/10'
      : 'border-white/25 text-white/80 bg-white/5';
    return `${base}${emphasis}${outcomeRing}`;
  }
  const neutral = isLightMode
    ? 'border-slate-300 text-slate-600 bg-slate-500/8'
    : 'border-white/20 text-white/70 bg-white/5';
  return `${neutral}${emphasis}${outcomeRing}`;
}

/**
 * Center prediction text: blue glow for PLAYER, rose glow for BANKER.
 * @param {string | undefined} rec
 * @param {boolean} isLightMode
 */
export function iaRealPredictionToneClasses(rec, isLightMode) {
  const side = recommendationSide(rec);
  if (side === 'PLAYER') {
    return isLightMode
      ? 'text-cyan-800 drop-shadow-[0_0_10px_rgba(8,145,178,0.35)]'
      : 'text-cyan-100 drop-shadow-[0_0_16px_rgba(34,211,238,0.55)]';
  }
  if (side === 'BANKER') {
    return isLightMode
      ? 'text-rose-900 drop-shadow-[0_0_10px_rgba(190,18,60,0.22)]'
      : 'text-rose-100 drop-shadow-[0_0_16px_rgba(251,113,133,0.5)]';
  }
  if (side === 'TIE') {
    return isLightMode ? 'text-slate-800' : 'text-white/90';
  }
  return isLightMode ? 'text-slate-800' : 'text-white/90';
}
