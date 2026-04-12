import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchToEngine, resetExecutionEngineToIdle } from './executionEngineDispatch.js';
import { getEngine } from '../store/useExecutionEngineStore.js';
import * as middleware from '../middleware/useSignalMiddleware.js';

describe('NEW_RESULT dedupe by fingerprint', () => {
  beforeEach(() => {
    resetExecutionEngineToIdle();
    vi.spyOn(middleware, 'labApplyResult').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips duplicate NEW_RESULT with identical fingerprint', () => {
    const ck = 'mesa:dedupe|round:1';
    dispatchToEngine({
      type: 'NEW_SIGNAL',
      normalized: {
        correlationKey: ck,
        mesa: 'dedupe',
        round: '1',
        vector_forecast: ['P', 'B', 'P', 'B', 'P', 'B'],
      },
    });
    const payload = {
      correlationKey: ck,
      mesa: 'dedupe',
      ganador: 'B',
      contador_martingala: 1,
      vector_win: ['L'],
      serverTs: 17_000_000_000_123,
    };
    dispatchToEngine({ type: 'NEW_RESULT', normalized: payload });
    const h1 = getEngine(ck)?.history?.length ?? 0;
    dispatchToEngine({ type: 'NEW_RESULT', normalized: { ...payload } });
    const h2 = getEngine(ck)?.history?.length ?? 0;
    expect(h2).toBe(h1);
    expect(middleware.labApplyResult).toHaveBeenCalledTimes(1);
  });

  it('dedupes when only serverTs differs (same base fingerprint; no second apply)', () => {
    const ck = 'mesa:dedupe-ts|round:1';
    dispatchToEngine({
      type: 'NEW_SIGNAL',
      normalized: {
        correlationKey: ck,
        mesa: 'dedupe-ts',
        round: '1',
        vector_forecast: ['P', 'B', 'P', 'B', 'P', 'B'],
      },
    });
    const base = {
      correlationKey: ck,
      mesa: 'dedupe-ts',
      ganador: 'B',
      contador_martingala: 1,
      vector_win: ['L'],
    };
    dispatchToEngine({ type: 'NEW_RESULT', normalized: { ...base, serverTs: 111 } });
    dispatchToEngine({ type: 'NEW_RESULT', normalized: { ...base, serverTs: 222 } });
    expect(middleware.labApplyResult).toHaveBeenCalledTimes(1);
  });
});
