/**
 * Clasificación operativa por nivel de martingala + dirección PLAYER/BANKER.
 *
 * @param {Record<string, unknown>} signal — crudo o ya formateado (recommendation, martingaleLevel, martingale)
 * @returns {{
 *   type: 'DIRECT_ENTRY' | 'RECOVERY' | 'HIGH_RISK' | 'UNKNOWN',
 *   label: string,
 *   color: 'green' | 'yellow' | 'red' | 'slate',
 *   icon: string,
 *   direction: string,
 * }}
 */
export function classifySignal(signal) {
  const side = signal.recommendation ?? signal.predictionLabel;
  const m = martingaleLevelFrom(signal);

  /** @type {'DIRECT_ENTRY' | 'RECOVERY' | 'HIGH_RISK' | 'UNKNOWN'} */
  let type = 'UNKNOWN';
  let label = '';
  /** @type {'green' | 'yellow' | 'red' | 'slate'} */
  let color = 'slate';
  let icon = '';

  if (m === 0) {
    type = 'DIRECT_ENTRY';
    label = 'Entrada directa';
    color = 'green';
    icon = '🟢';
  } else if (m <= 2) {
    type = 'RECOVERY';
    label = 'Recuperación';
    color = 'yellow';
    icon = '🟡';
  } else {
    type = 'HIGH_RISK';
    label = 'Alto riesgo';
    color = 'red';
    icon = '🔴';
  }

  const s = String(side ?? '').toUpperCase();
  const direction =
    s === 'PLAYER' || s === 'P'
      ? '🔵 PLAYER'
      : s === 'BANKER' || s === 'B'
        ? '🔴 BANKER'
        : s === 'TIE' || s === 'T'
          ? '🤝 TIE'
          : '⚪ ' + (side || '—');

  return {
    type,
    label,
    color,
    icon,
    direction,
  };
}

/**
 * Nivel numérico de martingala desde distintos shapes de proveedor.
 * @param {Record<string, unknown>} signal
 */
function martingaleLevelFrom(signal) {
  if (typeof signal.martingaleLevel === 'number' && !Number.isNaN(signal.martingaleLevel)) {
    return Math.max(0, Math.floor(signal.martingaleLevel));
  }
  const raw = signal.martingale;
  if (typeof raw === 'number' && !Number.isNaN(raw)) return Math.max(0, Math.floor(raw));
  if (typeof raw === 'string') {
    const t = raw.trim();
    const n = Number(t.startsWith('M') || t.startsWith('m') ? t.slice(1) : t);
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return 0;
}

/**
 * Clasificación legible para resultados (WIN / LOSS / TIE).
 * @param {string} verdict
 */
export function classifyResultOutcome(verdict) {
  const v = String(verdict ?? '').toUpperCase();
  if (v === 'WIN') {
    return {
      type: 'WIN',
      label: 'Ganada',
      icon: '✅',
      color: 'green',
    };
  }
  if (v === 'LOSS') {
    return {
      type: 'LOSS',
      label: 'Pérdida',
      icon: '❌',
      color: 'red',
    };
  }
  if (v === 'TIE') {
    return {
      type: 'TIE',
      label: 'Empate',
      icon: '🤝',
      color: 'amber',
    };
  }
  return {
    type: 'UNKNOWN',
    label: '—',
    icon: '',
    color: 'slate',
  };
}
