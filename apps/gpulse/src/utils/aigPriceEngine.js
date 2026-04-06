/**
 * Simulated AIG/USD tick — smooth random walk clamped to [23, 24].
 */

export function getNextAigPrice(prev) {
  const MIN = 23;
  const MAX = 24;

  const delta = (Math.random() - 0.5) * 0.08;

  let next = prev + delta;

  if (next < MIN) next = MIN;
  if (next > MAX) next = MAX;

  return Number(next.toFixed(2));
}
