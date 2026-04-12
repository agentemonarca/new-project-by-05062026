/**
 * Contrato único proveedor real (admin-core): delega en `@ai-genesis/provider-contract`.
 */

import {
  buildCorrelationKey,
  extractSupplierSignal,
  extractVectorForecastFromWire,
  getPredictionSideLetter,
} from '@/core/provider-contract.js';
import { mapForecast } from './resolveSignalFromProvider.js';

/**
 * Vector proveedor: mismo criterio que `extractVectorForecastFromWire` (bloque anidado **o** `vector_forecast` en raíz).
 * El ingest / `harvestSignalFieldsFromNestedData` puede dejar el vector solo en la fila plana; antes solo se leía vía `extractSupplierSignal`.
 * @param {Record<string, unknown>} working
 * @returns {unknown[]}
 */
export function getStrictProviderVectorForecast(working) {
  const w =
    working != null && typeof working === 'object' && !Array.isArray(working)
      ? /** @type {Record<string, unknown>} */ (working)
      : {};
  return extractVectorForecastFromWire(w);
}

/**
 * @param {Record<string, unknown>} working
 * @returns {'PLAYER' | 'BANKER' | 'TIE' | null}
 */
export function getStrictPredictionSide(working) {
  const sig = extractSupplierSignal(working);
  const p = sig != null ? getPredictionSideLetter(sig) : null;
  if (p === 'P') return 'PLAYER';
  if (p === 'B') return 'BANKER';
  if (p === 'T') return 'TIE';
  return mapForecast(getStrictProviderVectorForecast(working));
}

/**
 * @param {Record<string, unknown>} working
 * @returns {string}
 */
export function getStrictProviderCorrelationKey(working) {
  const sig = extractSupplierSignal(working);
  if (!sig) return '';
  try {
    return buildCorrelationKey(sig);
  } catch {
    return '';
  }
}
