/** Utilidades compartidas para editar `configByProject` sin acoplar módulos. */

export function cloneCfg(c) {
  return JSON.parse(JSON.stringify(c));
}

/**
 * Inmutabilidad: devuelve copia profunda con `path` (dot notation) = `value`.
 * @param {object} obj
 * @param {string} path
 * @param {unknown} value
 */
export function setAtPath(obj, path, value) {
  const parts = String(path).split('.');
  const n = cloneCfg(obj);
  let cur = n;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
    else cur[p] = { ...cur[p] };
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
  return n;
}
