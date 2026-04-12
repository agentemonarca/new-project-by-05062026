import { beforeEach, describe, expect, it } from 'vitest';
import { dispatchToEngine, resetExecutionEngineToIdle } from './executionEngineDispatch.js';
import { getEngine } from '../store/useExecutionEngineStore.js';

const signal = (ck, vector = ['P', 'B', 'P', 'B', 'P', 'B']) => ({
  type: 'NEW_SIGNAL',
  normalized: {
    correlationKey: ck,
    mesa: 'phase2',
    round: '1',
    vector_forecast: vector,
  },
});

const result = (ck, ganador, contador_martingala, vectorWin) => ({
  type: 'NEW_RESULT',
  normalized: {
    correlationKey: ck,
    mesa: 'phase2',
    ganador,
    ...(vectorWin != null ? { vector_win: vectorWin } : {}),
    ...(contador_martingala != null ? { contador_martingala } : {}),
  },
});

describe('Phase 2 — NEW_RESULT updates execution engine', () => {
  beforeEach(() => {
    resetExecutionEngineToIdle();
  });

  it('WIN: vector_win[last] → SUCCESS, history records WIN', () => {
    const ck = 'mesa:phase2-win|round:1';
    dispatchToEngine(signal(ck));
    expect(getEngine(ck)?.status).toBe('RUNNING');
    expect(getEngine(ck)?.prediction).toBe('PLAYER');

    dispatchToEngine(result(ck, 'P', undefined, ['W']));

    const eng = getEngine(ck);
    expect(eng?.status).toBe('SUCCESS');
    expect(eng?.history?.length).toBe(1);
    expect(eng?.history?.[0]?.status).toBe('WIN');
    expect(eng?.history?.[0]?.step).toBe(1);
  });

  it('LOSS: vector_win[last] → step advances, RUNNING, history records LOSS', () => {
    const ck = 'mesa:phase2-loss|round:1';
    dispatchToEngine(signal(ck));
    expect(getEngine(ck)?.currentStep).toBe(1);

    dispatchToEngine(result(ck, 'B', undefined, ['L']));

    const eng = getEngine(ck);
    expect(eng?.status).toBe('RUNNING');
    expect(eng?.currentStep).toBe(2);
    expect(eng?.history?.length).toBe(1);
    expect(eng?.history?.[0]?.status).toBe('LOSS');
    expect(eng?.history?.[0]?.step).toBe(1);
  });

  it('accumulates history on successive results', () => {
    const ck = 'mesa:phase2-hist|round:1';
    dispatchToEngine(signal(ck, ['P', 'B', 'P', 'B', 'P', 'B']));
    dispatchToEngine(result(ck, 'B', undefined, ['L']));
    // Step 2 prediction is BANKER; vector_win last → LOSS.
    dispatchToEngine(result(ck, 'P', undefined, ['L']));

    const eng = getEngine(ck);
    expect(eng?.history?.length).toBe(2);
    expect(eng?.history?.[0]?.status).toBe('LOSS');
    expect(eng?.history?.[1]?.status).toBe('LOSS');
  });
});
