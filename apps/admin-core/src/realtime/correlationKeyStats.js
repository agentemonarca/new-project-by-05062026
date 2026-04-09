/**
 * Observación en vivo: `correlationKey` `id:…` vs `mesa|round` (pipe, sin prefijo mesa:).
 *
 * Activar logs: `VITE_CORRELATION_STATS_LOG=1` (opcional `VITE_CORRELATION_STATS_EVERY=10` cada N ingresos).
 */

const STATS_LOG_ON = import.meta.env.VITE_CORRELATION_STATS_LOG === '1';
const LOG_EVERY = Math.max(1, Number(import.meta.env.VITE_CORRELATION_STATS_EVERY) || 10);

/** @param {unknown} ck */
function classifyCorrelationKey(ck) {
  const s = String(ck ?? '').trim();
  if (s.startsWith('id:')) return 'id';
  if (s.includes('|')) return 'round';
  return 'other';
}

/** @param {unknown} round */
function isRoundMissing(round) {
  if (round == null) return true;
  if (typeof round === 'number') return !Number.isFinite(round) || round <= 0;
  const t = String(round).trim();
  if (t === '' || t === '-') return true;
  const n = Number(t);
  return !Number.isFinite(n) || n <= 0;
}

let signalIdBased = 0;
let signalRoundBased = 0;
let signalOther = 0;
let resultIdBased = 0;
let resultRoundBased = 0;
let resultOther = 0;

/** Señales con CK id: y sin ronda numérica en la fila formateada (sospecha: proveedor sin ronda / solo epoch). */
let signalIdWithMissingRound = 0;

let ingestCount = 0;

/** @type {Record<string, { id: number, round: number, other: number }>} */
const bySource = {};

function bumpSource(source, bucket) {
  const key = String(source || 'unknown');
  if (!bySource[key]) bySource[key] = { id: 0, round: 0, other: 0 };
  if (bucket === 'id') bySource[key].id += 1;
  else if (bucket === 'round') bySource[key].round += 1;
  else bySource[key].other += 1;
}

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 10_000) / 100 : 0;
}

function maybeLog() {
  if (!STATS_LOG_ON) return;
  if (ingestCount % LOG_EVERY !== 0) return;

  const sTot = signalIdBased + signalRoundBased + signalOther;
  const rTot = resultIdBased + resultRoundBased + resultOther;
  const cId = signalIdBased + resultIdBased;
  const cRound = signalRoundBased + resultRoundBased;
  const cOther = signalOther + resultOther;
  const cTot = cId + cRound + cOther;

  console.log('[CORRELATION_STATS]', {
    idBased: cId,
    roundBased: cRound,
    other: cOther,
    pctId: pct(cId, cTot),
    pctRound: pct(cRound, cTot),
    signals: {
      idBased: signalIdBased,
      roundBased: signalRoundBased,
      other: signalOther,
      pctId: pct(signalIdBased, sTot),
      pctRound: pct(signalRoundBased, sTot),
    },
    results: {
      idBased: resultIdBased,
      roundBased: resultRoundBased,
      other: resultOther,
      pctId: pct(resultIdBased, rTot),
      pctRound: pct(resultRoundBased, rTot),
    },
    signalIdWithMissingRound,
    pctSignalIdMissingRoundAmongIdSignals: pct(signalIdWithMissingRound, signalIdBased),
    bySource: { ...bySource },
  });
}

/**
 * @param {'signal' | 'result'} kind
 * @param {Record<string, unknown>} formatted — salida de formatSignal / formatResult
 * @param {{ source?: string }} [meta] — p.ej. `socket:NEW_SIGNAL`, `socket:dashboardUpdate:NEW_SIGNAL`
 */
export function recordCorrelationKeyObservation(kind, formatted, meta = {}) {
  const bucket = classifyCorrelationKey(formatted?.correlationKey);
  const source = `${kind}:${meta.source ?? 'unknown'}`;

  if (kind === 'signal') {
    if (bucket === 'id') {
      signalIdBased += 1;
      if (isRoundMissing(formatted?.round)) signalIdWithMissingRound += 1;
    } else if (bucket === 'round') signalRoundBased += 1;
    else signalOther += 1;
  } else {
    if (bucket === 'id') resultIdBased += 1;
    else if (bucket === 'round') resultRoundBased += 1;
    else resultOther += 1;
  }

  bumpSource(source, bucket);
  ingestCount += 1;
  maybeLog();
}

/** Para tests / paneles: instantánea acumulada desde carga de página. */
export function getCorrelationKeyStatsSnapshot() {
  const sTot = signalIdBased + signalRoundBased + signalOther;
  const rTot = resultIdBased + resultRoundBased + resultOther;
  const cId = signalIdBased + resultIdBased;
  const cRound = signalRoundBased + resultRoundBased;
  const cOther = signalOther + resultOther;
  const cTot = cId + cRound + cOther;
  return {
    signals: {
      idBased: signalIdBased,
      roundBased: signalRoundBased,
      other: signalOther,
      pctId: pct(signalIdBased, sTot),
      pctRound: pct(signalRoundBased, sTot),
    },
    results: {
      idBased: resultIdBased,
      roundBased: resultRoundBased,
      other: resultOther,
      pctId: pct(resultIdBased, rTot),
      pctRound: pct(resultRoundBased, rTot),
    },
    combined: {
      idBased: cId,
      roundBased: cRound,
      other: cOther,
      pctId: pct(cId, cTot),
      pctRound: pct(cRound, cTot),
    },
    signalIdWithMissingRound,
    bySource: { ...bySource },
    ingestCount,
  };
}
