import { PHASES, nextPhasePlan } from './index.js';

const ALLOWED_PHASES = new Set(Object.values(PHASES));

const ALLOWED_TRANSITIONS = {
  [PHASES.ANALISIS]: new Set([PHASES.DETECCION]),
  [PHASES.DETECCION]: new Set([PHASES.SEÑAL]),
  // Engine planner keeps SEÑAL until external execution sets RESULTADO
  [PHASES.SEÑAL]: new Set([PHASES.SEÑAL, PHASES.RESULTADO]),
  [PHASES.RESULTADO]: new Set([PHASES.REINICIO]),
  [PHASES.REINICIO]: new Set([PHASES.ANALISIS]),
  [PHASES.STANDBY]: new Set([PHASES.ANALISIS, PHASES.STANDBY]),
};

function isAllowedTransition(from, to) {
  const s = ALLOWED_TRANSITIONS[String(from)] || new Set();
  return s.has(String(to));
}

function cloneContext(ctx) {
  // Context should be serializable/pure; keep it shallow by design.
  return { ...(ctx || {}) };
}

/**
 * Simulate engine planning without timers/UI.
 *
 * @param {object} args
 * @param {string} args.initialPhase
 * @param {object} args.context - passed to nextPhasePlan; simulator may update a few fields (e.g. isSequenceTriggered).
 * @param {number} args.steps - max iterations to run
 * @returns {{ timeline: Array, errors: Array, warnings: Array, finalPhase: string, finalContext: object }}
 */
export function simulate({ initialPhase = PHASES.STANDBY, context = {}, steps = 20 }) {
  const errors = [];
  const warnings = [];
  const timeline = [];

  let phase = String(initialPhase || PHASES.STANDBY);
  if (!ALLOWED_PHASES.has(phase)) {
    errors.push({ kind: 'invalid_initial_phase', message: `Invalid initial phase: ${phase}` });
    phase = PHASES.STANDBY;
  }

  const ctx = cloneContext(context);
  // Provide deterministic default RNG if caller supplied rngSeeded fn.
  if (typeof ctx.rng !== 'function' && typeof ctx.rngSeeded === 'function') ctx.rng = ctx.rngSeeded;

  const maxSteps = Math.max(1, Math.floor(Number(steps) || 0));
  const seen = new Map(); // phase -> count (simple loop detector)

  for (let i = 0; i < maxSteps; i++) {
    const plan = nextPhasePlan(phase, ctx);
    if (!plan || typeof plan !== 'object') {
      errors.push({ kind: 'missing_plan', step: i, phase, message: 'nextPhasePlan returned no plan' });
      break;
    }

    const nextPhase = plan.nextPhase ? String(plan.nextPhase) : null;
    const delay = Number(plan.delay || 0);

    timeline.push({
      step: i,
      phase,
      plan: {
        nextPhase,
        delay,
        actions: Array.isArray(plan.actions) ? plan.actions.map((a) => ({ type: a?.type, at: a?.at })) : [],
        conditions: Array.isArray(plan.conditions) ? plan.conditions : [],
      },
    });

    // Minimal simulated context updates based on declared actions.
    const actions = Array.isArray(plan.actions) ? plan.actions : [];
    for (const a of actions) {
      if (!a || !a.type) continue;
      if (a.type === 'TRIGGER_SEQUENCE') ctx.isSequenceTriggered = true;
    }

    // Validation: nextPhase must be known if provided.
    if (nextPhase && !ALLOWED_PHASES.has(nextPhase)) {
      errors.push({ kind: 'invalid_next_phase', step: i, phase, nextPhase, message: `Invalid nextPhase: ${nextPhase}` });
      break;
    }

    // Validation: phases that should advance must have a plan.
    if ((phase === PHASES.ANALISIS || phase === PHASES.DETECCION || phase === PHASES.RESULTADO || phase === PHASES.REINICIO) && !nextPhase) {
      errors.push({ kind: 'missing_transition', step: i, phase, message: 'Expected a nextPhase transition but got null' });
      break;
    }

    // Advance rules: if planner provides a delayed nextPhase, we treat it as the next simulated phase.
    // SEÑAL typically has delay 0 and nextPhase stays SEÑAL; the external executor sets RESULTADO.
    let advanced = false;
    if (nextPhase && delay > 0) {
      if (!isAllowedTransition(phase, nextPhase)) {
        errors.push({ kind: 'invalid_transition', step: i, from: phase, to: nextPhase, message: `Invalid transition ${phase} -> ${nextPhase}` });
        break;
      }
      phase = nextPhase;
      advanced = true;
    } else if (nextPhase && delay === 0 && nextPhase !== phase) {
      // zero-delay transition (rare, but validate)
      if (!isAllowedTransition(phase, nextPhase)) {
        errors.push({ kind: 'invalid_transition', step: i, from: phase, to: nextPhase, message: `Invalid transition ${phase} -> ${nextPhase}` });
        break;
      }
      phase = nextPhase;
      advanced = true;
    } else {
      // no transition
      advanced = false;
    }

    // Optional: simulate that a signal immediately leads to result (debug convenience).
    if (!advanced && phase === PHASES.SEÑAL && ctx.forceResultAfterSignal) {
      phase = PHASES.RESULTADO;
      advanced = true;
    }

    const count = (seen.get(phase) || 0) + 1;
    seen.set(phase, count);
    if (count > 6) {
      warnings.push({ kind: 'loop_suspected', step: i, phase, message: `Phase ${phase} repeated ${count} times (possible stall/loop)` });
      // don't break; allow the caller to decide
    }

    // If we are stuck in SEÑAL with no external result, stop early.
    if (phase === PHASES.SEÑAL && !ctx.forceResultAfterSignal) {
      warnings.push({ kind: 'signal_waits_external', step: i, phase, message: 'SEÑAL has no internal transition; requires external execution to set RESULTADO.' });
      break;
    }
  }

  return { timeline, errors, warnings, finalPhase: phase, finalContext: ctx };
}

