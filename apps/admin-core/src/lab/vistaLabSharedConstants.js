/**
 * Constantes compartidas entre VistaLab y /admin (sin duplicar lógica de ciclo).
 * @type {'phase1' | 'phase2' | 'phase3' | 'phase4' | 'full'}
 */

/** @typedef {typeof LAB_PHASE[keyof typeof LAB_PHASE]} LabPhase */

export const LAB_PHASE = {
  WAITING: 'WAITING',
  SIGNAL_DETECTED: 'SIGNAL_DETECTED',
  READY: 'READY',
  IN_PROGRESS: 'IN_PROGRESS',
  LOCKED: 'LOCKED',
  CARD_REVEAL: 'CARD_REVEAL',
  RESULT: 'RESULT',
  EVALUATION_WIN: 'EVALUATION_WIN',
  EVALUATION_LOSS: 'EVALUATION_LOSS',
  MARTINGALE: 'MARTINGALE',
  PAUSE: 'PAUSE',
  CLOSED: 'CLOSED',
  COOLDOWN: 'COOLDOWN',
};

// Timings por defecto (legacy / fases diagnósticas).
export const SIGNAL_DETECTED_TO_IN_PROGRESS_MS = 300;
export const PRE_IN_PROGRESS_DWELL_MS = 700;

// Timings human-friendly (emulador ritmo baccarat).
export const HUMAN_SIGNAL_DETECTED_MS = 2000;
export const HUMAN_BETTING_MS = 10000;
export const HUMAN_LOCKED_MS = 2000;
export const HUMAN_RESULT_MS = 3000;
export const HUMAN_PAUSE_BETWEEN_SHOTS_MS = 10000;
export const HUMAN_FORECAST_MAX_SHOTS = 6;

const PHASE_ORDER = [
  LAB_PHASE.WAITING,
  LAB_PHASE.SIGNAL_DETECTED,
  LAB_PHASE.READY,
  LAB_PHASE.IN_PROGRESS,
  LAB_PHASE.LOCKED,
  LAB_PHASE.CARD_REVEAL,
  LAB_PHASE.RESULT,
  LAB_PHASE.EVALUATION_WIN,
  LAB_PHASE.EVALUATION_LOSS,
  LAB_PHASE.MARTINGALE,
  LAB_PHASE.PAUSE,
  LAB_PHASE.CLOSED,
  LAB_PHASE.COOLDOWN,
];

const PHASE1_ORDER = [LAB_PHASE.WAITING, LAB_PHASE.SIGNAL_DETECTED];
const PHASE2_ORDER = [LAB_PHASE.WAITING, LAB_PHASE.SIGNAL_DETECTED, LAB_PHASE.IN_PROGRESS];

/**
 * @param {'phase1' | 'phase2' | 'phase3' | 'phase4' | 'full'} mode
 * @param {LabPhase} phase
 */
export function phaseStripOrderFor(mode, phase) {
  if (mode === 'phase1') return PHASE1_ORDER;
  if (mode === 'phase3') return [];
  if (mode === 'full') return PHASE_ORDER;
  const early = [LAB_PHASE.WAITING, LAB_PHASE.SIGNAL_DETECTED, LAB_PHASE.IN_PROGRESS];
  return early.includes(phase) ? PHASE2_ORDER : PHASE_ORDER;
}
