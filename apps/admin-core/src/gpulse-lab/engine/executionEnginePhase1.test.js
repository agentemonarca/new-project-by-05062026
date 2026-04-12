import { beforeEach, describe, expect, it } from 'vitest';
import { dispatchToEngine, resetExecutionEngineToIdle } from './executionEngineDispatch.js';
import { getEngine, useExecutionEngineStore } from '../store/useExecutionEngineStore.js';

describe('Phase 1 — NEW_SIGNAL initializes execution engine', () => {
  beforeEach(() => {
    resetExecutionEngineToIdle();
  });

  it('creates engine in engineMap with RUNNING, step 1, prediction, valid vector', () => {
    const ck = 'mesa:phase1|round:1';
    dispatchToEngine({
      type: 'NEW_SIGNAL',
      normalized: {
        correlationKey: ck,
        mesa: 'phase1',
        round: '1',
        vector_forecast: ['P', 'B', 'P', 'B', 'P', 'B'],
      },
    });

    const eng = getEngine(ck);
    expect(eng).toBeDefined();
    expect(useExecutionEngineStore.getState().engineMap[ck]).toBe(eng);

    expect(eng.status).toBe('RUNNING');
    expect(eng.currentStep).toBe(1);
    expect(eng.prediction).toBeTruthy();
    expect(Array.isArray(eng.vector)).toBe(true);
    expect(eng.vector.length).toBe(6);
    expect(eng.vector.every((c) => c != null && String(c).trim() !== '')).toBe(true);
  });

  it('uses martingale for initial step when provided', () => {
    const ck = 'mesa:phase1mg|round:2';
    dispatchToEngine({
      type: 'NEW_SIGNAL',
      normalized: {
        correlationKey: ck,
        mesa: 'phase1mg',
        round: '2',
        vector_forecast: ['P', 'B', 'P', 'B', 'P', 'B'],
        martingale: 1,
      },
    });

    const eng = getEngine(ck);
    expect(eng?.status).toBe('RUNNING');
    expect(eng?.currentStep).toBe(2);
    expect(eng?.prediction).toBe('BANKER');
  });
});
