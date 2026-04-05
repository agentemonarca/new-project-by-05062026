/**
 * Minimal circuit breaker for queue / flaky dependencies.
 */
export function createCircuitBreaker({ name, threshold = 5, coolDownMs = 30_000, logger } = {}) {
  let failures = 0;
  let openedUntil = 0;

  return {
    isOpen() {
      if (Date.now() < openedUntil) return true;
      if (openedUntil > 0 && Date.now() >= openedUntil) {
        failures = 0;
        openedUntil = 0;
      }
      return false;
    },
    async exec(fn) {
      if (this.isOpen()) {
        throw new Error(`CIRCUIT_OPEN_${name}`);
      }
      try {
        const out = await fn();
        failures = 0;
        return out;
      } catch (e) {
        failures += 1;
        if (failures >= threshold) {
          openedUntil = Date.now() + coolDownMs;
          logger?.warn?.('circuit_breaker_opened', { name, failures, coolDownMs });
        }
        throw e;
      }
    },
  };
}
