/**
 * Comparación proveedor vs fila formateada (panel). Stub mínimo si el diff detallado no está en el árbol;
 * la tubería de ingest sigue funcionando y `hasMismatch: false` evita ruido en debug.
 * @param {unknown} _wire
 * @param {unknown} _formatted
 */
export function diffNewSignalProviderVsPanel(_wire, _formatted) {
  return {
    hasMismatch: false,
    mismatches: /** @type {string[]} */ ([]),
    provider: null,
    panel: null,
  };
}

/**
 * @param {unknown} _wire
 * @param {unknown} _formatted
 */
export function diffNewResultProviderVsPanel(_wire, _formatted) {
  return {
    hasMismatch: false,
    mismatches: /** @type {string[]} */ ([]),
    provider: null,
    panel: null,
  };
}
