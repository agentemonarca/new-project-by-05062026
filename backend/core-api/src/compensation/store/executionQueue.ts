/**
 * Serializes async work so compensation mutations never overlap (no lost updates).
 */
export function createExecutionQueue() {
  let chain: Promise<unknown> = Promise.resolve();

  return function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(() => fn());
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}

/**
 * Runs mutations serially and persists after each successful mutation (for durable ledger).
 */
export function createPersistingExecutionQueue(onAfterSuccess: () => Promise<void>) {
  let chain: Promise<unknown> = Promise.resolve();

  return function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(async () => {
      const out = await fn();
      await onAfterSuccess();
      return out;
    });
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
