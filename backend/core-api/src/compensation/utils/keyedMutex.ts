/**
 * Serializes async work per key (e.g. one payout or one user at a time).
 */
export function createKeyedMutex() {
  const tails = new Map<string, Promise<unknown>>();

  return {
    runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
      const prev = tails.get(key) ?? Promise.resolve();
      const run = prev.then(() => fn());
      tails.set(key, run.then(() => undefined, () => undefined));
      return run;
    },
  };
}
