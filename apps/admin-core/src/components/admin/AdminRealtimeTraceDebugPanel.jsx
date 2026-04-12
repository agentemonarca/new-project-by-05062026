import React, { memo, useMemo, useRef, useSyncExternalStore } from 'react';
import { Bug } from 'lucide-react';
import {
  buildCorrelationKey,
  extractSupplierResult,
  extractSupplierSignal,
  extractVectorForecastFromWire,
  getPrediction,
  getPredictionSideLetter,
} from '@/core/provider-contract.js';
import {
  getAdminSignalsLiveServerSnapshot,
  getAdminSignalsLiveSnapshot,
  subscribeAdminSignalsLive,
} from '../../realtime/adminSignalsLiveStore.js';

/** @param {unknown} v */
function safeJson(v, max = 4000) {
  try {
    const s = JSON.stringify(v, null, 0);
    return s.length > max ? `${s.slice(0, max)}…` : s;
  } catch {
    return String(v);
  }
}

/**
 * @param {unknown} rawPred
 * @param {string | null | undefined} ganadorNorm
 * @returns {'MATCH' | 'MISMATCH' | 'WAITING' | 'UNKNOWN'}
 */
function computeMatchStatus(rawPred, ganadorNorm) {
  if (ganadorNorm == null || ganadorNorm === '' || ganadorNorm === '—') return 'WAITING';
  // DISPLAY ONLY — NOT SOURCE OF TRUTH: wrap resolved cell for letter compare
  const letter = getPredictionSideLetter({ vector_forecast: [rawPred] });
  const g = String(ganadorNorm).trim().toUpperCase();
  if (g === 'TIE' || g === 'EMPATE') {
    return letter === 'T' ? 'MATCH' : 'MISMATCH';
  }
  if (letter === null) return 'UNKNOWN';
  const wLetter = g === 'PLAYER' || g === 'JUGADOR' ? 'P' : g === 'BANKER' || g === 'BANCA' ? 'B' : g === 'TIE' || g === 'EMPATE' ? 'T' : null;
  if (wLetter === null) return 'UNKNOWN';
  return letter === wLetter ? 'MATCH' : 'MISMATCH';
}

/**
 * @param {Record<string, unknown> | null} sigEx
 * @param {unknown} tracePayload
 */
/**
 * Misma intención que la cabecera: vector[0] “crudo”. `getPrediction(extractSupplierSignal)`
 * falla si el bloque `data.data.signal` no trae `vector_forecast`, aunque `formatSignal` ya
 * resolvió el vector vía `providerNormalized` / wire plano — por eso los fallbacks.
 * @param {any} formattedSignal — fila `formatSignal` en `snap.signals[]`
 * @param {unknown} tracePayload — `traceSourcePayload` (pre-format)
 */
function resolvePredictionRawForTracePanel(formattedSignal, tracePayload) {
  const sigEx = tracePayload != null ? extractSupplierSignal(tracePayload) : null;
  try {
    if (sigEx) return getPrediction(sigEx);
  } catch {
    /* contract path incompleto */
  }
  const fs =
    formattedSignal != null && typeof formattedSignal === 'object' && !Array.isArray(formattedSignal)
      ? /** @type {Record<string, unknown>} */ (formattedSignal)
      : null;
  const vf = fs?.vector_forecast;
  if (Array.isArray(vf) && vf.length > 0 && vf[0] != null) return vf[0];
  const fromWire = extractVectorForecastFromWire(tracePayload);
  if (fromWire.length > 0 && fromWire[0] != null) return fromWire[0];
  return null;
}

function correlationKeyFromContractSignal(sigEx, tracePayload) {
  if (sigEx && typeof sigEx === 'object') {
    try {
      return buildCorrelationKey(sigEx);
    } catch {
      /* fall through */
    }
  }
  const root =
    tracePayload != null && typeof tracePayload === 'object' && !Array.isArray(tracePayload)
      ? /** @type {Record<string, unknown>} */ (tracePayload)
      : null;
  if (!root) return '';
  const merged = extractSupplierSignal(tracePayload) ?? root;
  try {
    return buildCorrelationKey(merged);
  } catch {
    return '';
  }
}

export const AdminRealtimeTraceDebugPanel = memo(function AdminRealtimeTraceDebugPanel() {
  const snap = useSyncExternalStore(
    subscribeAdminSignalsLive,
    getAdminSignalsLiveSnapshot,
    getAdminSignalsLiveServerSnapshot,
  );

  const [mesaFilter, setMesaFilter] = React.useState('');
  const [roundFilter, setRoundFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const warnedRef = useRef(/** @type {Set<string>} */ (new Set()));

  const rows = useMemo(() => {
    const signals = snap.signals ?? [];
    const results = snap.results ?? [];

    /** @type {Map<string, { signal?: any, result?: any }>} */
    const byCk = new Map();

    for (const s of signals) {
      const ck = s?.correlationKey != null ? String(s.correlationKey).trim() : '';
      const key = ck || `__sig:${String(s?.recvId ?? Math.random())}`;
      if (!byCk.has(key)) byCk.set(key, {});
      const e = byCk.get(key);
      if (e && !e.signal) e.signal = s;
    }
    for (const r of results) {
      const ck = r?.correlationKey != null ? String(r.correlationKey).trim() : '';
      const key = ck || `__res:${String(r?.recvId ?? Math.random())}`;
      if (!byCk.has(key)) byCk.set(key, {});
      const e = byCk.get(key);
      if (e && !e.result) e.result = r;
    }

    /** @type {any[]} */
    const out = [];

    for (const [mapKey, pair] of byCk) {
      const sig = pair.signal;
      const res = pair.result;
      const correlationKey = sig?.correlationKey ?? res?.correlationKey ?? mapKey;

      const tracePayload = sig?.traceSourcePayload ?? null;
      const sigEx = tracePayload != null ? extractSupplierSignal(tracePayload) : null;

      const predictionRaw = sig ? resolvePredictionRawForTracePanel(sig, tracePayload) : null;

      const resPayload = res?.traceSourcePayload ?? null;
      const resEx = resPayload != null ? extractSupplierResult(resPayload) : null;
      const winner =
        res?.ganador != null && String(res.ganador).trim() !== '' && String(res.ganador) !== '—'
          ? String(res.ganador).trim()
          : resEx && resEx.ganador != null
            ? String(resEx.ganador).trim()
            : null;

      const matchStatus = computeMatchStatus(predictionRaw, winner);

      const ckFromSig = correlationKeyFromContractSignal(sigEx, tracePayload);
      const ckFromRes =
        resEx && typeof resEx === 'object'
          ? (() => {
              try {
                return buildCorrelationKey(resEx);
              } catch {
                return '';
              }
            })()
          : '';

      if (sig && res && String(sig.correlationKey ?? '') !== String(res.correlationKey ?? '')) {
        console.error('[TRACE] CRITICAL correlationKey mismatch signal≠result', {
          signalCk: sig.correlationKey,
          resultCk: res.correlationKey,
        });
      } else if (sig && ckFromSig && String(sig.correlationKey ?? '') !== ckFromSig) {
        console.error('[TRACE] CRITICAL correlationKey vs contract(signal)', {
          formattedCk: sig.correlationKey,
          contractCk: ckFromSig,
        });
      } else if (res && ckFromRes && String(res.correlationKey ?? '') !== ckFromRes) {
        console.error('[TRACE] CRITICAL correlationKey vs contract(result)', {
          formattedCk: res.correlationKey,
          contractCk: ckFromRes,
        });
      } else if (!sig && res) {
        const rid = String(res.recvId ?? '');
        if (!warnedRef.current.has(`orphan-${rid}`)) {
          warnedRef.current.add(`orphan-${rid}`);
          console.warn('[TRACE] result without matching signal in buffer', {
            correlationKey: String(correlationKey),
            recvId: res.recvId,
            mesa: res.mesa,
            round: res.round,
          });
        }
      }

      const traceId =
        sig?.recvId != null
          ? String(sig.recvId)
          : res?.recvId != null
            ? String(res.recvId)
            : correlationKey;

      const rawSignalStr =
        sig?.providerRawPreview ??
        (tracePayload ? safeJson(tracePayload) : res?.providerRawPreview ?? (resPayload ? safeJson(resPayload) : '—'));
      const extractedStr = sigEx ? safeJson(sigEx) : resEx ? `[RESULT] ${safeJson(resEx)}` : '—';

      const winnerStr = winner ?? '—';
      const matchStrict =
        predictionRaw != null &&
        winner != null &&
        String(predictionRaw).trim() === String(winnerStr).trim();

      const mesa = sig?.mesa ?? res?.mesa ?? null;
      const round = sig?.round ?? res?.round ?? null;

      out.push({
        key: String(mapKey || correlationKey || sig?.recvId || res?.recvId || Math.random()),
        traceId,
        correlationKey: String(correlationKey),
        predictionRaw: predictionRaw != null ? predictionRaw : '—',
        signalExtracted: sigEx,
        formattedSignal: sig ?? null,
        result: res ?? null,
        winner: winnerStr,
        match: matchStrict,
        matchStatus,
        mesa,
        round,
        rawSignalStr,
        extractedStr,
        ckMismatch:
          (sig && res && String(sig.correlationKey ?? '') !== String(res.correlationKey ?? '')) ||
          (sig && ckFromSig && String(sig.correlationKey ?? '') !== ckFromSig) ||
          (res && ckFromRes && String(res.correlationKey ?? '') !== ckFromRes),
        ingestTs: Math.max(
          sig?.ingestTs ?? 0,
          res?.ingestTs ?? 0,
        ),
      });
    }

    out.sort((a, b) => (b.ingestTs ?? 0) - (a.ingestTs ?? 0));
    return out;
  }, [snap.signals, snap.results]);

  const mesaOptions = useMemo(() => {
    const s = new Set();
    for (const r of rows) {
      const m = r.mesa;
      if (m != null && String(m).trim() !== '') s.add(String(m));
    }
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const statusWant =
      statusFilter === 'all'
        ? null
        : ({ match: 'MATCH', mismatch: 'MISMATCH', waiting: 'WAITING' })[statusFilter] ?? null;
    return rows.filter((row) => {
      const mesa = row.mesa;
      const round = row.round;
      if (mesaFilter.trim() !== '' && String(mesa ?? '') !== mesaFilter.trim()) return false;
      if (roundFilter.trim() !== '' && String(round ?? '') !== roundFilter.trim()) return false;
      if (statusWant != null && row.matchStatus !== statusWant) return false;
      return true;
    });
  }, [rows, mesaFilter, roundFilter, statusFilter]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: '#2B3139', backgroundColor: 'rgba(11, 14, 17, 0.65)' }}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
          <Bug className="h-4 w-4 text-emerald-300" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[#EAECEF]">Trazas en vivo (contrato)</h3>
          <p className="text-[11px] text-[#848E9C]">
            RAW → extract → predictionRaw (vector[0]) · CK · ganador · estado. Sin recomendaciones ni predicción derivada en esta vista.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-3 text-[11px]">
        <label className="flex items-center gap-2 text-[#848E9C]">
          Mesa
          <select
            value={mesaFilter}
            onChange={(e) => setMesaFilter(e.target.value)}
            className="rounded-lg border border-[#2B3139] bg-[#0B0E11] px-2 py-1.5 text-[#EAECEF]"
          >
            <option value="">Todas</option>
            {mesaOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[#848E9C]">
          Ronda
          <input
            type="text"
            value={roundFilter}
            onChange={(e) => setRoundFilter(e.target.value)}
            placeholder="ej. 12"
            className="w-24 rounded-lg border border-[#2B3139] bg-[#0B0E11] px-2 py-1.5 font-mono text-[#EAECEF]"
          />
        </label>
        <label className="flex items-center gap-2 text-[#848E9C]">
          Estado
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-[#2B3139] bg-[#0B0E11] px-2 py-1.5 text-[#EAECEF]"
          >
            <option value="all">Todos</option>
            <option value="match">MATCH</option>
            <option value="mismatch">MISMATCH</option>
            <option value="waiting">WAITING</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: '#2B3139' }}>
        <table className="w-full min-w-[960px] text-left text-[11px] text-[#EAECEF]">
          <thead>
            <tr className="border-b text-[10px] uppercase tracking-wider text-[#848E9C]" style={{ borderColor: '#2B3139' }}>
              <th className="px-2 py-2">Estado</th>
              <th className="px-2 py-2">traceId</th>
              <th className="px-2 py-2">correlationKey</th>
              <th className="px-2 py-2">predictionRaw</th>
              <th className="px-2 py-2">RESULT</th>
              <th className="px-2 py-2">RAW SIGNAL</th>
              <th className="px-2 py-2">EXTRACTED SIGNAL</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-[#848E9C]">
                  Sin filas (buffer vacío o filtros sin coincidencias).
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const statusEmoji =
                  row.matchStatus === 'MATCH'
                    ? '🟢 MATCH'
                    : row.matchStatus === 'WAITING'
                      ? '🟡 WAITING RESULT'
                      : row.matchStatus === 'MISMATCH'
                        ? '🔴 MISMATCH'
                        : '⚪ UNKNOWN';
                const rowBg =
                  row.ckMismatch
                    ? 'rgba(239,68,68,0.12)'
                    : row.matchStatus === 'MISMATCH'
                      ? 'rgba(246,70,93,0.08)'
                      : 'transparent';
                return (
                  <tr key={row.key} className="border-b border-[#2B3139]/80 align-top" style={{ backgroundColor: rowBg }}>
                    <td className="whitespace-nowrap px-2 py-2 font-semibold">{statusEmoji}</td>
                    <td className="max-w-[140px] break-all px-2 py-2 font-mono text-[#B7BDC6]">{row.traceId}</td>
                    <td className="max-w-[180px] break-all px-2 py-2 font-mono text-cyan-200/90">{row.correlationKey}</td>
                    <td className="px-2 py-2 font-mono text-amber-200/90">{String(row.predictionRaw)}</td>
                    <td className="px-2 py-2 font-mono text-emerald-200/90">{String(row.winner)}</td>
                    <td className="max-w-[220px] break-all px-2 py-2 font-mono text-[#848E9C]">{row.rawSignalStr}</td>
                    <td className="max-w-[220px] break-all px-2 py-2 font-mono text-[#B7BDC6]">{row.extractedStr}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

AdminRealtimeTraceDebugPanel.displayName = 'AdminRealtimeTraceDebugPanel';
