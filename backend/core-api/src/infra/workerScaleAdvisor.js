/**
 * Hysteresis + cooldown for autoscaling hints from BullMQ depth (no orchestration side-effects here).
 */

export const WORKER_SCALE_SIGNAL = Object.freeze({
  HOLD: 'hold',
  SCALE_UP: 'scale_up',
  SCALE_DOWN: 'scale_down',
});

const COOLDOWN_MS = 65_000;
const UP_WAITING = 18;
const DOWN_WAITING = 5;
const DOWN_ACTIVE = 2;
const HI_TICKS = 2;
const LO_TICKS = 5;

let hiStreak = 0;
let loStreak = 0;
let locked = WORKER_SCALE_SIGNAL.HOLD;
let lastChange = 0;

/**
 * @param {{ waiting: number, active: number }} q
 * @returns {'hold' | 'scale_up' | 'scale_down'}
 */
export function computeWorkerScaleSignal({ waiting = 0, active = 0 } = {}) {
  const w = Math.max(0, Number(waiting) || 0);
  const a = Math.max(0, Number(active) || 0);
  const now = Date.now();

  if (w >= UP_WAITING) hiStreak += 1;
  else hiStreak = 0;

  if (w <= DOWN_WAITING && a <= DOWN_ACTIVE) loStreak += 1;
  else loStreak = 0;

  let want = WORKER_SCALE_SIGNAL.HOLD;
  if (hiStreak >= HI_TICKS) want = WORKER_SCALE_SIGNAL.SCALE_UP;
  else if (loStreak >= LO_TICKS) want = WORKER_SCALE_SIGNAL.SCALE_DOWN;

  if (want === WORKER_SCALE_SIGNAL.HOLD) {
    return locked;
  }

  if (want === locked) {
    return locked;
  }

  if (now - lastChange < COOLDOWN_MS) {
    return locked;
  }

  locked = want;
  lastChange = now;
  return locked;
}

export function resetWorkerScaleAdvisorForTests() {
  hiStreak = 0;
  loStreak = 0;
  locked = WORKER_SCALE_SIGNAL.HOLD;
  lastChange = 0;
}
