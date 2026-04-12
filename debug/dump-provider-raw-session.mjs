#!/usr/bin/env node
/**
 * Dumps one complete provider_raw cycle (NEW_SIGNAL + NEW_RESULT) from
 * debug/provider-full-flow.json — payloads unchanged (JSON snapshot as stored).
 *
 * Usage: node debug/dump-provider-raw-session.mjs [path/to/provider-full-flow.json]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultPath = path.join(__dirname, 'provider-full-flow.json');
const file = process.argv[2] ? path.resolve(process.argv[2]) : defaultPath;

function getCkFromPayload(payload) {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const p = /** @type {Record<string, unknown>} */ (payload);
  if (p.correlationKey != null && String(p.correlationKey).trim()) return String(p.correlationKey).trim();
  return null;
}

/** Same heuristics as `analyze-provider-full-flow.mjs` + `results.mesa_info` on NEW_RESULT. */
function mesaRoundFromPayload(payload) {
  if (payload == null || typeof payload !== 'object') return { mesa: null, round: null };
  const tryPick = (o) => {
    if (!o || typeof o !== 'object') return { mesa: null, round: null };
    const mesa =
      o.mesa ?? o.table ?? o.tableName ?? o.tableId ?? o.nombre_mesa ?? o.desk ?? o.room ?? null;
    const round =
      o.round ??
      o.ronda_actual ??
      o.roundId ??
      o.gameRound ??
      o.ronda ??
      o.Ronda ??
      o.ronda_objetivo ??
      null;
    return {
      mesa: mesa != null ? String(mesa) : null,
      round: round != null ? String(round) : null,
    };
  };
  const direct = tryPick(payload);
  if (direct.mesa || direct.round) return direct;
  const d = payload.data;
  if (d && typeof d === 'object') {
    const inner = d.data && typeof d.data === 'object' ? d.data : null;
    const sig = d.signal && typeof d.signal === 'object' ? d.signal : null;
    const fromData = tryPick(d);
    if (fromData.mesa || fromData.round) return fromData;
    if (inner) {
      const i = tryPick(inner);
      if (i.mesa || i.round) return i;
      const isig = inner.signal && typeof inner.signal === 'object' ? inner.signal : null;
      if (isig) {
        const s = tryPick(isig);
        if (s.mesa || s.round) return s;
      }
      const res = inner.results && typeof inner.results === 'object' ? inner.results : null;
      const mi = res?.mesa_info && typeof res.mesa_info === 'object' ? res.mesa_info : null;
      if (mi) {
        const m = tryPick(mi);
        if (m.mesa || m.round) return m;
      }
    }
    if (sig) {
      const s = tryPick(sig);
      if (s.mesa || s.round) return s;
    }
  }
  return { mesa: null, round: null };
}

function syntheticCorrelationKey(payload) {
  const { mesa, round } = mesaRoundFromPayload(payload);
  if (mesa && round) return `mesaRound:${mesa}|${round}`;
  if (mesa) return `mesaOnly:${mesa}`;
  return null;
}

/** Empareja cada NEW_RESULT con el NEW_SIGNAL previo sin pareja (orden cronológico). */
function pairChronological(raw) {
  /** @type {object[]} */
  const queue = [];
  /** @type {Array<{ signal: object, result: object, inferredKey: string | null }>} */
  const pairs = [];
  for (const ev of raw) {
    const t = ev.type;
    if (t === 'NEW_SIGNAL') {
      queue.push(ev);
    } else if (t === 'NEW_RESULT' && queue.length) {
      const signal = queue.shift();
      const ik =
        syntheticCorrelationKey(signal.payload) ?? syntheticCorrelationKey(ev.payload) ?? null;
      pairs.push({ signal, result: ev, inferredKey: ik });
    }
  }
  return pairs;
}

function eventCorrelationKey(ev) {
  const pay = ev.payload;
  return (
    (ev.correlationKey != null && String(ev.correlationKey).trim()) ||
    getCkFromPayload(pay) ||
    syntheticCorrelationKey(pay) ||
    '_ungrouped'
  );
}

function main() {
  if (!fs.existsSync(file)) {
    console.error('File not found:', file);
    process.exit(1);
  }
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const all = Array.isArray(doc.events) ? doc.events : [];
  const raw = all.filter((e) => e && e.pipeline === 'provider_raw');
  raw.sort((a, b) => (a.capturedAt ?? 0) - (b.capturedAt ?? 0));

  if (raw.length === 0) {
    console.log('No provider_raw events in file. Enable ADMIN_SIGNALS_FULL_FLOW=1 and capture live cycles.');
    process.exit(0);
  }

  /** @type {Map<string, { signal?: object, result?: object }>} */
  const byCk = new Map();
  for (const ev of raw) {
    const t = ev.type;
    const ck = eventCorrelationKey(ev);
    if (!byCk.has(ck)) byCk.set(ck, {});
    const bucket = byCk.get(ck);
    if (t === 'NEW_SIGNAL' && !bucket.signal) bucket.signal = ev;
    if (t === 'NEW_RESULT' && !bucket.result) bucket.result = ev;
  }

  let chosen = null;
  let correlationKey = null;
  let pairingMethod = 'correlationKey_or_mesaRound_bucket';
  for (const [ck, b] of byCk.entries()) {
    if (b.signal && b.result) {
      chosen = b;
      correlationKey = ck === '_ungrouped' ? null : ck;
      break;
    }
  }

  if (!chosen) {
    const pairs = pairChronological(raw);
    if (pairs.length > 0) {
      const first = pairs[0];
      chosen = { signal: first.signal, result: first.result };
      correlationKey =
        first.inferredKey ??
        getCkFromPayload(first.signal.payload) ??
        getCkFromPayload(first.result.payload) ??
        null;
      pairingMethod = 'chronological_fifo';
    }
  }

  if (!chosen) {
    const sig = raw.find((e) => e.type === 'NEW_SIGNAL');
    const res = raw.find((e) => e.type === 'NEW_RESULT');
    if (sig && res) {
      chosen = { signal: sig, result: res };
      correlationKey =
        sig.correlationKey ??
        res.correlationKey ??
        getCkFromPayload(sig.payload) ??
        getCkFromPayload(res.payload) ??
        syntheticCorrelationKey(sig.payload) ??
        syntheticCorrelationKey(res.payload) ??
        null;
      pairingMethod = 'first_signal_first_result';
    }
  }

  if (!chosen || !chosen.signal || !chosen.result) {
    console.log('No complete NEW_SIGNAL + NEW_RESULT pair in provider_raw events.');
    process.exit(0);
  }

  const tsSig = chosen.signal.capturedAt;
  const tsRes = chosen.result.capturedAt;
  const delta =
    tsSig != null && tsRes != null && Number.isFinite(tsSig) && Number.isFinite(tsRes)
      ? tsRes - tsSig
      : null;

  const signalJson = JSON.stringify(chosen.signal.payload, null, 2);
  const resultJson = JSON.stringify(chosen.result.payload, null, 2);

  console.log('=== SESSION START ===\n');
  console.log('[NEW_SIGNAL RAW]');
  console.log(signalJson);
  console.log('\n[NEW_RESULT RAW]');
  console.log(resultJson);
  console.log('\n=== SESSION END ===\n');
  console.log('--- metadata (optional) ---');
  console.log(
    JSON.stringify(
      {
        correlationKey: correlationKey ?? '(infer from payloads — see mesa|ronda in JSON)',
        pairingMethod,
        capturedAtSignal: tsSig ?? null,
        capturedAtResult: tsRes ?? null,
        deltaMs: delta,
      },
      null,
      2,
    ),
  );
}

main();
