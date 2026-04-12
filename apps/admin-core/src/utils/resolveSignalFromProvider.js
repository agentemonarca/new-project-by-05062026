/**
 * Dirección y nombre de algoritmo desde el anidado del proveedor (`vector_forecast`, `nombre_algoritmo`).
 * Espejo conceptual de `mapVectorForecastToRecommendation` en `signalNormalize.js` (backend).
 */

import {
  forecastStepIndexFromContador,
  mapForecastAtStep,
  recommendationFromForecastCell,
} from './forecastMartingaleStep.js';

/** @param {...unknown} vals */
function pickFirstFinite(...vals) {
  for (const v of vals) {
    if (v == null) continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * @param {Record<string, unknown> | null | undefined} sig
 */
function readContadorFromSignalBlock(sig) {
  if (sig == null || typeof sig !== 'object' || Array.isArray(sig)) return null;
  const m = sig.martingala;
  const fromMart =
    m != null && typeof m === 'object' && !Array.isArray(m) ? m.contador_martingala : null;
  return pickFirstFinite(fromMart, sig.contador_martingala, sig.martingale);
}

/**
 * @param {unknown} vector
 * @param {number} [stepIndex] — 0..5; por defecto 0 (primera celda)
 * @returns {'PLAYER' | 'BANKER' | 'TIE' | null}
 */
export function mapForecast(vector, stepIndex = 0) {
  const cell = mapForecastAtStep(vector, stepIndex);
  return recommendationFromForecastCell(cell);
}

/**
 * @param {Record<string, unknown>} p
 * @param {Record<string, unknown> | null} d
 * @param {Record<string, unknown> | null} d2
 * @param {Record<string, unknown> | null} sig2
 * @param {Record<string, unknown> | null} sigShallow
 * @param {Record<string, unknown> | null} sigRoot
 */
function resolveMartingaleStepIndex(p, d, d2, sig2, sigShallow, sigRoot) {
  const counter = pickFirstFinite(
    readContadorFromSignalBlock(sig2),
    readContadorFromSignalBlock(sigShallow),
    readContadorFromSignalBlock(sigRoot),
    d2?.martingale,
    d?.martingale,
    p.martingale,
    p.martinGale,
    p.martingaleLevel,
    p.contador_martingala,
  );
  return forecastStepIndexFromContador(counter ?? 0);
}

/**
 * @param {unknown} payload
 * @returns {{ signalName: string | null, direction: 'PLAYER' | 'BANKER' | 'TIE' | null }}
 */
export function resolveSignalFromProvider(payload) {
  const p =
    payload != null && typeof payload === 'object' && !Array.isArray(payload)
      ? /** @type {Record<string, unknown>} */ (payload)
      : null;
  if (!p) return { signalName: null, direction: null };

  const d =
    p.data != null && typeof p.data === 'object' && !Array.isArray(p.data)
      ? /** @type {Record<string, unknown>} */ (p.data)
      : null;
  const d2 =
    d?.data != null && typeof d.data === 'object' && !Array.isArray(d.data)
      ? /** @type {Record<string, unknown>} */ (d.data)
      : null;

  const sig2 =
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

  const signal = sig2 ?? sigShallow ?? sigRoot;
  const stepIdx = resolveMartingaleStepIndex(p, d, d2, sig2, sigShallow, sigRoot);

  if (!signal) {
    const vfRoot = p.vector_forecast;
    const dirFlat = mapForecast(
      Array.isArray(vfRoot) ? vfRoot : [],
      stepIdx,
    );
    const nameFlat = p.nombre_algoritmo;
    const signalNameFlat =
      nameFlat != null && String(nameFlat).trim() !== '' ? String(nameFlat).trim() : null;
    return { signalName: signalNameFlat, direction: dirFlat };
  }

  const rawName = signal.nombre_algoritmo;
  const signalName = rawName != null && String(rawName).trim() !== '' ? String(rawName).trim() : null;
  const vf = signal.vector_forecast;
  const direction = mapForecast(Array.isArray(vf) ? vf : [], stepIdx);

  return { signalName, direction };
}
