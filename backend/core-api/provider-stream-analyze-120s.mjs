/**
 * Análisis pasivo del stream del proveedor (solo observación).
 * 2 minutos de captura vía socket.onAny → reporte JSON (flow, rules, anomalies).
 *
 * Requiere .env en backend/core-api (o variables de entorno):
 *   EXTERNAL_SIGNALS_API_KEY
 *   EXTERNAL_SIGNALS_WS o EXTERNAL_SIGNALS_URL (URL socket.io, ej. wss://host:3000/external-signals)
 *
 * Opcional: CAPTURE_MS=120000  CAPTURE_JSON_PATH=./provider-capture-report.json
 *
 *   cd backend/core-api && node provider-stream-analyze-120s.mjs
 */

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { io as ioClient } from 'socket.io-client';

const CAPTURE_MS = Math.max(1000, Number(process.env.CAPTURE_MS || 120_000));
const OUT_PATH = String(process.env.CAPTURE_JSON_PATH || '').trim();

const upstreamUrl =
  String(process.env.EXTERNAL_SIGNALS_WS || process.env.EXTERNAL_SIGNALS_URL || '').trim() ||
  'wss://appserver.winxplay.io:3000/external-signals';
const apiKey = String(process.env.EXTERNAL_SIGNALS_API_KEY || '').trim();

/** @param {unknown} payload */
function coerceRoot(payload) {
  return payload != null && typeof payload === 'object' && !Array.isArray(payload)
    ? /** @type {Record<string, unknown>} */ (payload)
    : {};
}

/**
 * Extrae campos observables sin asumir contrato fijo (solo rutas comunes).
 * @param {string} eventName
 * @param {unknown} payload
 */
function captureEvent(eventName, payload) {
  const r = coerceRoot(payload);
  const d =
    r.data != null && typeof r.data === 'object' && !Array.isArray(r.data)
      ? /** @type {Record<string, unknown>} */ (r.data)
      : /** @type {Record<string, unknown>} */ ({});

  const payloadType = r.type != null ? String(r.type) : d.type != null ? String(d.type) : null;

  const mesaRaw =
    r.mesa ?? d.mesa ?? r.table ?? d.table ?? r.tableId ?? d.tableId ?? r.desk ?? d.desk ?? r.mesaName ?? d.mesaName;
  const mesa = mesaRaw != null && String(mesaRaw).trim() !== '' ? String(mesaRaw) : null;

  const roundRaw =
    r.round ?? d.round ?? r.gameRound ?? d.gameRound ?? r.gameId ?? d.gameId ?? r.shoe ?? d.shoe ?? r.hand ?? d.hand;
  const round = roundRaw != null && String(roundRaw).trim() !== '' ? String(roundRaw) : null;

  const resultadoRaw =
    d.result ?? r.result ?? d.ganador ?? r.ganador ?? d.resultado ?? r.resultado ?? d.outcome ?? r.outcome;
  const resultado = resultadoRaw != null ? resultadoRaw : null;

  const recommendationRaw =
    d.forecast ?? r.forecast ?? d.recommendation ?? r.recommendation ?? d.signal ?? r.signal ?? d.side ?? r.side;
  const recommendation = recommendationRaw != null ? recommendationRaw : null;

  return {
    timestamp: Date.now(),
    eventName: String(eventName),
    payloadType,
    mesa,
    round,
    resultado,
    recommendation,
  };
}

/** @param {Record<string, number>} m */
function sortFreq(m) {
  return Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count }));
}

/**
 * @param {{
 *   records: ReturnType<typeof captureEvent>[],
 *   sequence: string[],
 * }} ctx
 */
function analyze(ctx) {
  const { records, sequence } = ctx;
  const totalEvents = records.length;

  /** @type {Record<string, number>} */
  const eventFrequency = {};
  /** @type {Record<string, number>} */
  const payloadTypeFrequency = {};
  /** @type {Record<string, number>} */
  const transitionCounts = {};
  /** @type {Record<string, string[]>} */
  const byMesaTokens = {};
  /** @type {Record<string, boolean>} */
  const pendingSignalByMesa = {};
  /** @type {Array<Record<string, unknown>>} */
  const signalsWithoutResult = [];
  /** @type {Array<Record<string, unknown>>} */
  const resultsWithoutSignal = [];
  /** @type {Record<string, number>} */
  const duplicateSig = {};

  let prevEvent = null;
  for (const rec of records) {
    eventFrequency[rec.eventName] = (eventFrequency[rec.eventName] || 0) + 1;
    const pt = rec.payloadType || '(sin type en payload)';
    payloadTypeFrequency[pt] = (payloadTypeFrequency[pt] || 0) + 1;

    if (prevEvent) {
      const k = `${prevEvent}→${rec.eventName}`;
      transitionCounts[k] = (transitionCounts[k] || 0) + 1;
    }
    prevEvent = rec.eventName;

    const mesaKey = rec.mesa || '_sin_mesa';
    const token = rec.payloadType ? `${rec.eventName}:${rec.payloadType}` : rec.eventName;
    if (!byMesaTokens[mesaKey]) byMesaTokens[mesaKey] = [];
    byMesaTokens[mesaKey].push(token);

    const dupKey = JSON.stringify([
      rec.eventName,
      rec.payloadType,
      rec.mesa,
      rec.round,
      rec.recommendation,
      rec.resultado,
    ]);
    duplicateSig[dupKey] = (duplicateSig[dupKey] || 0) + 1;

    if (rec.eventName === 'NEW_SIGNAL' || rec.payloadType === 'NEW_SIGNAL') {
      if (pendingSignalByMesa[mesaKey]) {
        signalsWithoutResult.push({
          mesa: rec.mesa,
          round: rec.round,
          at: rec.timestamp,
          note: 'Nueva señal con señal previa sin NEW_RESULT en la misma mesa (en ventana).',
        });
      }
      pendingSignalByMesa[mesaKey] = true;
    }
    if (rec.eventName === 'NEW_RESULT' || rec.payloadType === 'NEW_RESULT') {
      if (!pendingSignalByMesa[mesaKey]) {
        resultsWithoutSignal.push({
          mesa: rec.mesa,
          round: rec.round,
          at: rec.timestamp,
          note: 'NEW_RESULT sin señal previa registrada para esta mesa en la ventana.',
        });
      }
      pendingSignalByMesa[mesaKey] = false;
    }
  }

  const transitionTop = sortFreq(transitionCounts);
  const duplicates = Object.entries(duplicateSig)
    .filter(([, n]) => n > 1)
    .map(([key, count]) => ({ fingerprint: JSON.parse(key), count }))
    .slice(0, 80);

  const openAtEnd = Object.entries(pendingSignalByMesa)
    .filter(([, p]) => p)
    .map(([m]) => m);

  const flowSummary = {
    totalEvents,
    captureMsRequested: CAPTURE_MS,
    eventFrequency,
    payloadTypeFrequency,
    eventTypesDetected: Object.keys(eventFrequency).sort(),
  };

  const sequenceCollapsed = [];
  for (const name of sequence) {
    if (sequenceCollapsed.length === 0 || sequenceCollapsed[sequenceCollapsed.length - 1] !== name) {
      sequenceCollapsed.push(name);
    }
  }
  const sequenceSample = sequence.length > 400 ? sequence.slice(0, 400).concat(['…']) : sequence;

  const multiDashboard = transitionCounts['dashboardUpdate→dashboardUpdate'] || 0;

  /** @type {string[]} */
  const rules = [];
  if (transitionTop[0]) {
    rules.push(
      `La transición más observada es «${transitionTop[0].key}» (${transitionTop[0].count} veces); úsala como hipótesis de pipeline.`,
    );
  }
  if (multiDashboard > 0) {
    rules.push(`Hay ${multiDashboard} pares consecutivos dashboardUpdate→dashboardUpdate; el proveedor puede refrescar estado en ráfaga.`);
  }
  if ((eventFrequency.NEW_SIGNAL || 0) > 0 || (eventFrequency.NEW_RESULT || 0) > 0) {
    rules.push(
      `Eventos nominales NEW_SIGNAL (${eventFrequency.NEW_SIGNAL || 0}) / NEW_RESULT (${eventFrequency.NEW_RESULT || 0}) frente a dashboardUpdate (${eventFrequency.dashboardUpdate || 0}).`,
    );
  }
  if (signalsWithoutResult.length === 0 && resultsWithoutSignal.length === 0 && openAtEnd.length === 0) {
    rules.push(
      'En esta ventana, el patrón señal→resultado por mesa no registró huecos (según heurística NEW_SIGNAL/NEW_RESULT por mesa).',
    );
  } else {
    rules.push(
      'Existen cruces señal/resultado ambiguos o señales abiertas al cierre; validar correlación por id/ronda antes de reglas automáticas en GPulse.',
    );
  }
  if ((eventFrequency.dashboardUpdate || 0) > (eventFrequency.NEW_SIGNAL || 0) + (eventFrequency.NEW_RESULT || 0)) {
    rules.push(
      'dashboardUpdate domina en volumen; muchas decisiones pueden depender de expansión local (no solo eventos nominales).',
    );
  }

  const flow = {
    resumen: flowSummary,
    frecuencia: {
      porNombreEvento: sortFreq(eventFrequency),
      porPayloadType: sortFreq(payloadTypeFrequency),
    },
    flujoRealDetectado: {
      secuenciaSinColapsarMuestra: sequenceSample,
      secuenciaColapsadaConsecutivos: sequenceCollapsed.slice(-120),
      transicionesTop: transitionTop.slice(0, 25),
    },
    porMesa: Object.fromEntries(
      Object.entries(byMesaTokens).map(([m, tokens]) => {
        const tail = tokens.length > 200 ? tokens.slice(-200).concat(['…']) : tokens;
        return [m, { flujo: tail.join(' → '), tokens: tail }];
      }),
    ),
    senales: {
      comoLlegan: sortFreq(
        records
          .filter(
            (r) =>
              r.eventName === 'NEW_SIGNAL' || r.payloadType === 'NEW_SIGNAL' || (r.recommendation != null && r.mesa),
          )
          .reduce((acc, r) => {
            const k = `${r.eventName}${r.payloadType ? `|type:${r.payloadType}` : ''}`;
            acc[k] = (acc[k] || 0) + 1;
            return acc;
          }, /** @type {Record<string, number>} */ ({})),
      ),
      camposObservados: ['recommendation/forecast/signal', 'mesa', 'round', 'martingale (si existe en raw no extraído aquí)'],
    },
    resultados: {
      comoLlegan: sortFreq(
        records
          .filter((r) => r.eventName === 'NEW_RESULT' || r.payloadType === 'NEW_RESULT' || r.resultado != null)
          .reduce((acc, r) => {
            const k = `${r.eventName}${r.payloadType ? `|type:${r.payloadType}` : ''}`;
            acc[k] = (acc[k] || 0) + 1;
            return acc;
          }, /** @type {Record<string, number>} */ ({})),
      ),
      relacion: [
        'Correlación heurística por mesa: se asume NEW_RESULT cierra señal abierta en la misma mesa.',
        `Incidencias «resultado sin señal» en ventana: ${resultsWithoutSignal.length}.`,
      ],
    },
  };

  const anomalies = {
    senalesSinResultado: signalsWithoutResult,
    resultadosSinSenal: resultsWithoutSignal,
    duplicados: duplicates,
    mesasConSenalAbiertaAlCierre: openAtEnd,
    patronRafagaDashboardUpdate: multiDashboard,
  };

  return { flow, rules, anomalies };
}

async function main() {
  if (!apiKey) {
    console.error(
      JSON.stringify(
        {
          error: 'EXTERNAL_SIGNALS_API_KEY ausente',
          hint: 'Define la clave en backend/core-api/.env',
          flow: null,
          rules: [],
          anomalies: null,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  /** @type {ReturnType<typeof captureEvent>[]} */
  const records = [];
  /** @type {string[]} */
  const sequence = [];

  const socket = ioClient(upstreamUrl, {
    transports: ['websocket'],
    auth: { apiKey },
    reconnection: false,
    timeout: 25_000,
  });

  const done = () =>
    new Promise((resolve) => {
      socket.onAny((event, ...args) => {
        const payload = args.length ? args[0] : undefined;
        const row = captureEvent(String(event), payload);
        records.push(row);
        sequence.push(row.payloadType ? `${row.eventName}[${row.payloadType}]` : row.eventName);
      });

      socket.on('connect', () => {
        console.error(`[capture] conectado · ${upstreamUrl} · ${CAPTURE_MS}ms`);
      });
      socket.on('connect_error', (err) => {
        console.error('[capture] connect_error:', err?.message || err);
      });

      setTimeout(() => {
        try {
          socket.removeAllListeners();
          socket.disconnect();
        } catch {
          /* ignore */
        }
        resolve();
      }, CAPTURE_MS);
    });

  await done();

  const report = analyze({ records, sequence });
  const out = { flow: report.flow, rules: report.rules, anomalies: report.anomalies };
  const text = JSON.stringify(out, null, 2);
  console.log(text);
  if (OUT_PATH) {
    try {
      writeFileSync(OUT_PATH, text, 'utf8');
      console.error(`[capture] guardado: ${OUT_PATH}`);
    } catch (e) {
      console.error('[capture] no se pudo escribir CAPTURE_JSON_PATH:', e?.message || e);
    }
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ error: String(e?.message || e), flow: null, rules: [], anomalies: null }, null, 2));
  process.exit(1);
});
