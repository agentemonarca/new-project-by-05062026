#!/usr/bin/env node
/**
 * Reads debug/provider-full-flow.json and builds a deterministic execution report
 * from observed events only (no provider assumptions).
 *
 * Usage: node debug/analyze-provider-full-flow.mjs [path/to/provider-full-flow.json]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultPath = path.join(__dirname, 'provider-full-flow.json');

const file = process.argv[2] ? path.resolve(process.argv[2]) : defaultPath;

function readJson(p) {
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

/** Collect every path in an object where leaf key matches `key`. */
function pathsForKey(obj, key, prefix = '') {
  if (obj == null || typeof obj !== 'object') return [];
  if (Array.isArray(obj)) {
    return obj.flatMap((v, i) => pathsForKey(v, key, `${prefix}[${i}]`));
  }
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (k === key) out.push(p);
    out.push(...pathsForKey(v, key, p));
  }
  return out;
}

function getCk(ev) {
  if (ev.correlationKey != null && String(ev.correlationKey).trim()) return String(ev.correlationKey).trim();
  const pay = ev.payload ?? ev.normalizedPayload;
  if (pay && typeof pay === 'object' && !Array.isArray(pay) && pay.correlationKey != null) {
    return String(pay.correlationKey).trim();
  }
  return null;
}

function eventType(ev) {
  return ev.type ?? ev.eventType ?? ev.event ?? null;
}

function pipeline(ev) {
  return ev.pipeline ?? 'unknown';
}

/** Best-effort mesa|round from nested payload (observed shapes only). */
function mesaRoundFromPayload(payload) {
  if (payload == null || typeof payload !== 'object') return { mesa: null, round: null };
  const tryPick = (o) => {
    if (!o || typeof o !== 'object') return { mesa: null, round: null };
    const mesa =
      o.mesa ?? o.table ?? o.tableName ?? o.tableId ?? o.nombre_mesa ?? o.desk ?? o.room ?? null;
    const round =
      o.round ?? o.ronda_actual ?? o.roundId ?? o.gameRound ?? o.ronda ?? o.Ronda ?? null;
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
    }
    if (sig) {
      const s = tryPick(sig);
      if (s.mesa || s.round) return s;
    }
  }
  return { mesa: null, round: null };
}

function syntheticKey(ev) {
  const p = ev.payload ?? ev.normalizedPayload;
  const { mesa, round } = mesaRoundFromPayload(p);
  if (mesa && round) return `mesaRound:${mesa}|${round}`;
  if (mesa) return `mesaOnly:${mesa}`;
  return null;
}

function main() {
  if (!fs.existsSync(file)) {
    console.error('File not found:', file);
    process.exit(1);
  }
  const doc = readJson(file);
  const events = Array.isArray(doc.events) ? doc.events : [];
  console.log('Source:', file);
  console.log('Event count:', events.length);
  if (events.length === 0) {
    console.log('\nNo events — enable ADMIN_SIGNALS_FULL_FLOW=1 and VITE_GPULSE_FULL_FLOW=1, run live cycles, then re-run this script.');
    process.exit(0);
  }

  const byCk = new Map();
  const unkeyed = [];

  for (const ev of events) {
    const ck = getCk(ev) || syntheticKey(ev);
    if (!ck) {
      unkeyed.push(ev);
      continue;
    }
    if (!byCk.has(ck)) byCk.set(ck, []);
    byCk.get(ck).push(ev);
  }

  for (const ev of unkeyed) {
    const sk = `unkeyed_${ev.capturedAt ?? 'x'}_${Math.random().toString(36).slice(2, 8)}`;
    if (!byCk.has(sk)) byCk.set(sk, []);
    byCk.get(sk).push(ev);
  }

  /** Per-cycle stats */
  const cycles = [];
  for (const [ck, evs] of byCk.entries()) {
    const sorted = [...evs].sort((a, b) => (a.capturedAt ?? 0) - (b.capturedAt ?? 0));
    const stages = {
      provider_raw_signal: sorted.filter((e) => pipeline(e) === 'provider_raw' && eventType(e) === 'NEW_SIGNAL'),
      provider_raw_result: sorted.filter((e) => pipeline(e) === 'provider_raw' && eventType(e) === 'NEW_RESULT'),
      normalized: sorted.filter((e) => pipeline(e) === 'normalized'),
      relay_out: sorted.filter((e) => pipeline(e) === 'relay_out'),
      front_socket: sorted.filter((e) => pipeline(e) === 'front_socket'),
      store: sorted.filter((e) => pipeline(e) === 'store'),
      ia_real: sorted.filter((e) => pipeline(e) === 'ia_real'),
      client: sorted.filter((e) => pipeline(e) === 'client'),
    };

    const rawSig = stages.provider_raw_signal[0]?.payload;
    const rawRes = stages.provider_raw_result[0]?.payload;

    const vfPathsSig = rawSig ? [...new Set(pathsForKey(rawSig, 'vector_forecast'))] : [];
    const vfPathsRes = rawRes ? [...new Set(pathsForKey(rawRes, 'vector_resultado'))] : [];
    const ganPaths = rawRes ? [...new Set(pathsForKey(rawRes, 'ganador'))] : [];
    const cmPaths = rawRes ? [...new Set(pathsForKey(rawRes, 'contador_martingala'))] : [];

    const tsSig = stages.provider_raw_signal.map((e) => e.capturedAt).filter(Boolean);
    const tsRes = stages.provider_raw_result.map((e) => e.capturedAt).filter(Boolean);
    const t0 = tsSig.length ? Math.min(...tsSig) : null;
    const t1 = tsRes.length ? Math.min(...tsRes) : null;
    const delayMs = t0 != null && t1 != null ? t1 - t0 : null;

    cycles.push({
      correlationKey: ck,
      stagesPresent: Object.fromEntries(
        Object.entries(stages).map(([k, v]) => [k, v.length > 0]),
      ),
      vector_forecast_paths_sample: vfPathsSig.slice(0, 12),
      vector_resultado_paths_sample: vfPathsRes.slice(0, 12),
      ganador_paths_sample: ganPaths.slice(0, 8),
      contador_martingala_paths_sample: cmPaths.slice(0, 8),
      signalTs: t0,
      resultTs: t1,
      delayMs,
    });
  }

  const delays = cycles.map((c) => c.delayMs).filter((d) => d != null && Number.isFinite(d));
  const avg = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : null;
  const min = delays.length ? Math.min(...delays) : null;
  const max = delays.length ? Math.max(...delays) : null;

  console.log('\n--- GROUPED CYCLES (by correlationKey or synthetic mesa|round) ---\n');
  console.log(JSON.stringify(cycles, null, 2));

  console.log('\n--- TIMING (provider_raw NEW_SIGNAL → provider_raw NEW_RESULT, same bucket) ---\n');
  console.log(
    JSON.stringify(
      {
        sampleCount: delays.length,
        averageDelayMs: avg,
        minDelayMs: min,
        maxDelayMs: max,
      },
      null,
      2,
    ),
  );

  console.log('\n--- KEY FREQUENCY (all events) ---\n');
  const keyFreq = new Map();
  for (const ev of events) {
    const p = ev.payload ?? ev.normalizedPayload;
    if (p && typeof p === 'object') walkKeys(p, keyFreq, '');
  }
  const top = [...keyFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 80);
  console.log(Object.fromEntries(top));
}

function walkKeys(obj, freq, prefix) {
  if (obj == null || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach((x) => walkKeys(x, freq, prefix));
    return;
  }
  for (const k of Object.keys(obj)) {
    const f = freq.get(k) ?? 0;
    freq.set(k, f + 1);
    walkKeys(obj[k], freq, `${prefix}.${k}`);
  }
}

main();
