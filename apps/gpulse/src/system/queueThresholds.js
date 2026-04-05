/**
 * Shared queue-depth thresholds: stress hint vs decision-engine mode escalation.
 * Keeps prediction + computeSystemMode aligned on the same scale.
 */

/** Above this: predictSystemStress → rising_load (unless already critical). */
export const QUEUE_WAITING_THRESHOLD_MEDIUM = 10;

/** Above this: predictSystemStress → critical_soon. */
export const QUEUE_WAITING_THRESHOLD_HIGH = 28;

/** Decision engine: nudge toward CAUTION before congestion. */
export const QUEUE_WAITING_MODE_CAUTION = 6;

/** Decision engine: backlog building — DELAYED. */
export const QUEUE_WAITING_MODE_DELAYED = 14;

/** Decision engine: align with stress “critical” band. */
export const QUEUE_WAITING_MODE_PROTECTION = QUEUE_WAITING_THRESHOLD_HIGH;
