import { canExecuteMultiPair } from '../wallet/index.js';
import { getDefaultEngineRng } from '../../utils/gpulseRngPolicy.js';

export const PHASES = {
  STANDBY: 'STANDBY',
  ANALISIS: 'ANALISIS',
  DETECCION: 'DETECCION',
  SEÑAL: 'SEÑAL',
  RESULTADO: 'RESULTADO',
  REINICIO: 'REINICIO',
};

/** Phase transition helpers (pure): return delay ms for timers. */
export function analysisStepSchedule(speedFactor = 1) {
  const steps = ['VARIANZA', 'PROBABILIDAD', 'MUESTREO', 'SINC_AZAR'];
  return steps.map((name, idx) => ({
    name,
    enginesReady: idx + 1,
    delayMs: (idx + 1) * 800 * speedFactor,
    // App previously transitions to DETECCION after the last step (idx === 3)
    toPhase: idx === steps.length - 1 ? PHASES.DETECCION : null,
  }));
}

export function detectionDelayMs(speedFactor = 1) {
  return 1500 * speedFactor;
}

export function resultDelayMs(speedFactor = 1) {
  return 3500 * speedFactor;
}

export function restartDelayMs(speedFactor = 1) {
  return 1200 * speedFactor;
}

/** Guards */
export function canStartCycle({ isProcessingSequence, isRunning, ignitionBlocked }) {
  if (isProcessingSequence) return { ok: false, reason: 'processing' };
  if (isRunning) return { ok: true, reason: 'stop' };
  if (ignitionBlocked) return { ok: false, reason: 'blocked' };
  return { ok: true, reason: 'start' };
}

export function shouldTriggerSequence(isSequenceTriggered) {
  const resultado = !Boolean(isSequenceTriggered);
  console.log('CHECK shouldTriggerSequence', resultado);
  return resultado;
}

/** Random generators (pure given rng) */
export function generatePattern(length = 6, rng = getDefaultEngineRng()) {
  const n = Math.max(0, Math.floor(Number(length) || 0));
  return Array.from({ length: n }, () => (rng() > 0.5 ? 'banker' : 'player'));
}

export function pickMesa(tables, rng = getDefaultEngineRng()) {
  const list = Array.isArray(tables) ? tables : [];
  if (list.length === 0) return null;
  return list[Math.floor(rng() * list.length)];
}

export function pickRonda(rng = getDefaultEngineRng()) {
  return Math.floor(rng() * 80) + 1;
}

/** Progression helpers */
export function computeBetForStep(stake, stepIndex1) {
  const i = Math.max(1, Math.floor(Number(stepIndex1) || 1));
  return Number(stake) * Math.pow(2, i - 1);
}

export function computeTotalLoss(stake, levels) {
  const L = Math.max(1, Math.floor(Number(levels) || 1));
  return Array.from({ length: L }, (_, idx) => Number(stake) * Math.pow(2, idx)).reduce((a, b) => a + b, 0);
}

export function computeWinAt(levels, rng = getDefaultEngineRng()) {
  const L = Math.max(1, Math.floor(Number(levels) || 1));
  return rng() > 0.2 ? Math.floor(rng() * L) + 1 : 0;
}

export function isWinningStep(stepIndex1, winAt) {
  return Number(stepIndex1) === Number(winAt);
}

export function canExecuteShot({ activeCycleMode, activeTradingWallet, walletModeAigConst = 'AIG', aig, usdt, bet }) {
  if (activeCycleMode !== 'IA_REAL') return { ok: true };
  if (activeTradingWallet === walletModeAigConst) {
    if (Number(aig) < Number(bet)) return { ok: false, reason: 'INSUFFICIENT_AIG' };
    return { ok: true };
  }
  if (!canExecuteMultiPair(aig, usdt, bet)) return { ok: false, reason: 'INSUFFICIENT_MULTI' };
  return { ok: true };
}

/**
 * Declarative execution planner.
 *
 * Returns a plan describing phase transitions and timed actions.
 * - Pure: no side effects, no React, no IO.
 *
 * Plan shape:
 * {
 *   nextPhase: string | null,
 *   delay: number,                // ms until nextPhase should be applied (0 = no transition)
 *   actions: Array<{ type: string, at?: number, payload?: any }>,
 *   conditions: Array<{ type: string, payload?: any }>
 * }
 */
export function nextPhasePlan(currentPhase, context = {}) {
  const phase = String(currentPhase || PHASES.STANDBY);
  const speedFactor = Number(context.speedFactor ?? 1) || 1;
  const rng = typeof context.rng === 'function' ? context.rng : getDefaultEngineRng();

  if (phase === PHASES.ANALISIS) {
    const schedule = analysisStepSchedule(speedFactor);
    const actions = schedule.map((s) => ({
      type: 'ENGINE_READY_STEP',
      at: s.delayMs,
      payload: { enginesReady: s.enginesReady },
    }));
    const delay = schedule.length ? schedule[schedule.length - 1].delayMs : 0;
    const plan = {
      nextPhase: PHASES.DETECCION,
      delay,
      actions,
      conditions: [],
    };
    console.log('PLAN GENERADO:', plan);
    return plan;
  }

  if (phase === PHASES.DETECCION) {
    const delay = detectionDelayMs(speedFactor);
    const mesa = pickMesa(context.tables, rng);
    const ronda = pickRonda(rng);
    const plan = {
      nextPhase: PHASES.SEÑAL,
      delay,
      actions: [
        { type: 'SPEAK', at: 0, payload: { kind: 'DETECCION' } },
        { type: 'SET_MESA_RONDA', at: delay, payload: { mesa, ronda } },
      ],
      conditions: [],
    };
    console.log('PLAN GENERADO:', plan);
    return plan;
  }

  if (phase === PHASES.SEÑAL) {
    const alreadyTriggered = Boolean(context.isSequenceTriggered);
    if (alreadyTriggered) {
      const plan = {
        nextPhase: PHASES.SEÑAL,
        delay: 0,
        actions: [],
        conditions: [{ type: 'SEQUENCE_ALREADY_TRIGGERED' }],
      };
      console.log('PLAN GENERADO:', plan);
      return plan;
    }
    const pattern = generatePattern(6, rng);
    const plan = {
      nextPhase: PHASES.SEÑAL,
      delay: 0,
      actions: [{ type: 'TRIGGER_SEQUENCE', at: 0, payload: { pattern } }],
      conditions: [{ type: 'IF_NOT_SEQUENCE_TRIGGERED' }],
    };
    console.log('PLAN GENERADO:', plan);
    return plan;
  }

  if (phase === PHASES.RESULTADO) {
    const delay = resultDelayMs(speedFactor);
    const plan = {
      nextPhase: PHASES.REINICIO,
      delay,
      actions: [{ type: 'SET_NOISE', at: 0, payload: { active: false } }],
      conditions: [],
    };
    console.log('PLAN GENERADO:', plan);
    return plan;
  }

  if (phase === PHASES.REINICIO) {
    const delay = restartDelayMs(speedFactor);
    const plan = {
      nextPhase: PHASES.ANALISIS,
      delay,
      actions: [
        { type: 'SPEAK', at: 0, payload: { kind: 'REINICIO' } },
        { type: 'RESET_SEQUENCE_TRIGGER', at: 0, payload: {} },
        { type: 'RESET_ROUND_VISUALS', at: delay, payload: {} },
      ],
      conditions: [],
    };
    console.log('PLAN GENERADO:', plan);
    return plan;
  }

  // STANDBY or unknown: no plan
  const plan = { nextPhase: null, delay: 0, actions: [], conditions: [] };
  console.log('PLAN GENERADO:', plan);
  return plan;
}

