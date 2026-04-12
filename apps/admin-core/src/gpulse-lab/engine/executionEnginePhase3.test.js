import { beforeEach, describe, expect, it } from 'vitest';
import { dispatchToEngine, resetExecutionEngineToIdle } from './executionEngineDispatch.js';
import { getEngine } from '../store/useExecutionEngineStore.js';

describe('Phase 3 — NEW_RESULT deduplication', () => {
  beforeEach(() => {
    resetExecutionEngineToIdle();
  });

  it('first NEW_RESULT is applied; duplicate same step+ganador is ignored (no extra history)', () => {
    const ck = 'mesa:phase3-dedup|round:1';
    dispatchToEngine({
      type: 'NEW_SIGNAL',
      normalized: {
        correlationKey: ck,
        mesa: 'phase3',
        round: '1',
        vector_forecast: ['P', 'B', 'P', 'B', 'P', 'B'],
      },
    });

    const r = {
      type: 'NEW_RESULT',
      normalized: { correlationKey: ck, mesa: 'phase3', ganador: 'P' },
    };

    dispatchToEngine(r);
    const afterFirst = getEngine(ck);
    expect(afterFirst?.status).toBe('SUCCESS');
    expect(afterFirst?.history?.length).toBe(1);

    dispatchToEngine(r);
    const afterDup = getEngine(ck);

    expect(afterDup).toBe(afterFirst);
    expect(afterDup?.history?.length).toBe(1);
  });
});
