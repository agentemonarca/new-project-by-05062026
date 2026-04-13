/**
 * Simulated AIG/USD tick — smooth random walk clamped to [23, 24].
 */

import { isGpulseRealProviderExecution } from './gpulseRngPolicy.js';

let _aigTick = 0;

export function getNextAigPrice(prev) {
  const MIN = 23;
  const MAX = 24;

  _aigTick += 1;
  const delta = isGpulseRealProviderExecution()
    ? Math.sin(_aigTick * 0.17) * 0.04
    : (Math.random() - 0.5) * 0.08;

  let next = prev + delta;

  if (next < MIN) next = MIN;
  if (next > MAX) next = MAX;

  return Number(next.toFixed(2));
}
