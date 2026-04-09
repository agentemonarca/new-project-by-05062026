/** Visual / copy separator between GPulse Lab alert sections */
export const ALERT_SECTION_SEP = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

/** Emoji per section (UI + clipboard export) */
/** Orden alineado a lectura rápida: qué / cuándo / dónde / impacto / causas / flujo / datos / traza / código / acciones */
export const ALERT_SECTION_ICONS = {
  que: '🧠',
  cuando: '⏱️',
  donde: '📍',
  impacto: '🎯',
  porque: '⚠️',
  /** Informativo (p. ej. STREAM_DELAY_EXPECTED): sin tono de advertencia. */
  porqueInfo: '💡',
  estadoActual: '📌',
  como: '🔄',
  data: '📊',
  rutaTecnica: '🧭',
  dondeBuscar: '🔧',
  recomendacion: '🛠️',
  calidadRecuperacion: '🧠',
};

/**
 * @param {string} icon
 * @param {string} label
 */
export function formatSectionHeader(icon, label) {
  return `${icon} ${label}`;
}
