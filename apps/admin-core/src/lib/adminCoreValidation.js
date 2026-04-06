import { PROJECT_IDS } from '../data/mockMaster.js';

export const KNOWN_PROJECT_IDS = new Set(Object.values(PROJECT_IDS));

export function assertProject(project) {
  if (project == null || project === '') {
    return { ok: false, error: 'Proyecto requerido' };
  }
  if (typeof project !== 'string') {
    return { ok: false, error: 'Proyecto inválido' };
  }
  if (!KNOWN_PROJECT_IDS.has(project)) {
    return { ok: false, error: 'Proyecto desconocido' };
  }
  return { ok: true };
}

export function assertUserId(userId) {
  if (userId == null || String(userId).trim() === '') {
    return { ok: false, error: 'Usuario inválido' };
  }
  return { ok: true };
}

/** @param {unknown} stateSlice */
export function safeProjectSlice(stateSlice, project) {
  if (!stateSlice || typeof stateSlice !== 'object') return [];
  const list = stateSlice[project];
  return Array.isArray(list) ? list : [];
}
