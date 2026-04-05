/** Binary compensation: match on weaker leg, 11% bonus on matched volume, monthly flash on carry. */
export const BINARY_BONUS_RATE = 0.11;

/**
 * @param {number} left
 * @param {number} right
 */
export function binaryMatchVolume(left, right) {
  const L = Math.max(0, Number(left) || 0);
  const R = Math.max(0, Number(right) || 0);
  return Math.min(L, R);
}

/**
 * @param {number} match
 */
export function binaryBonusFromMatch(match) {
  const m = Math.max(0, Number(match) || 0);
  return m * BINARY_BONUS_RATE;
}

/**
 * @param {number} left
 * @param {number} right
 * @param {number} match
 */
export function consumeMatchedVolume(left, right, match) {
  const L = Math.max(0, Number(left) || 0);
  const R = Math.max(0, Number(right) || 0);
  const mv = Math.max(0, Math.min(match, L, R));
  return { left: L - mv, right: R - mv, matched: mv };
}

/**
 * Monthly flash: each leg multiplied by 0.5 independently.
 * @param {number} left
 * @param {number} right
 */
export function applyBinaryFlash(left, right) {
  const L = Math.max(0, Number(left) || 0);
  const R = Math.max(0, Number(right) || 0);
  const leftAfter = L * 0.5;
  const rightAfter = R * 0.5;
  return {
    leftBefore: L,
    rightBefore: R,
    leftAfter,
    rightAfter,
    lostLeft: L - leftAfter,
    lostRight: R - rightAfter,
  };
}

/**
 * @param {number} left
 * @param {number} right
 */
export function flashRiskLevel(left, right) {
  const L = Math.max(0, Number(left) || 0);
  const R = Math.max(0, Number(right) || 0);
  const total = L + R;
  const heavier = Math.max(L, R);
  if (total >= 2500 || heavier >= 1800) return 'high';
  if (total >= 800 || heavier >= 600) return 'medium';
  return 'low';
}
