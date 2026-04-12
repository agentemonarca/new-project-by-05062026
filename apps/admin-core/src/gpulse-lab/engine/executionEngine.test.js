import { describe, expect, it } from 'vitest';
import { createInitialState, reduce } from './executionEngine.js';

describe('executionEngine', () => {
  it('NEW_SIGNAL starts RUNNING with step 1', () => {
    const s0 = createInitialState();
    const s1 = reduce(s0, {
      type: 'NEW_SIGNAL',
      payload: {
        correlationKey: 'mesa:A|round:1',
        mesa: 'A',
        round: '1',
        vector_forecast: ['P', 'B', 'P', 'B', 'P', 'B'],
      },
    });
    expect(s1.status).toBe('RUNNING');
    expect(s1.currentStep).toBe(1);
    expect(s1.prediction).toBe('PLAYER');
    expect(s1.vector.length).toBe(6);
  });

  it('loss advances step; win ends SUCCESS', () => {
    let s = reduce(createInitialState(), {
      type: 'NEW_SIGNAL',
      payload: {
        correlationKey: 'k1',
        mesa: 'M',
        round: '1',
        vector_forecast: ['P', 'B'],
      },
    });
    s = reduce(s, { type: 'NEW_RESULT', payload: { correlationKey: 'k1', ganador: 'B' } });
    expect(s.status).toBe('RUNNING');
    expect(s.currentStep).toBe(2);
    s = reduce(s, { type: 'NEW_RESULT', payload: { correlationKey: 'k1', ganador: 'B' } });
    expect(s.status).toBe('SUCCESS');
  });

  it('ignores NEW_SIGNAL without correlationKey', () => {
    const s0 = createInitialState();
    const s1 = reduce(s0, { type: 'NEW_SIGNAL', payload: { mesa: 'x', round: '1', vector_forecast: ['P'] } });
    expect(s1.status).toBe('IDLE');
  });

  it('NEW_SIGNAL uses martingale for cell index (not always vector[0])', () => {
    const s1 = reduce(createInitialState(), {
      type: 'NEW_SIGNAL',
      payload: {
        correlationKey: 'k-mg',
        mesa: 'M',
        round: '1',
        vector_forecast: ['P', 'B', 'P', 'B', 'P', 'B'],
        martingale: 1,
      },
    });
    expect(s1.status).toBe('RUNNING');
    expect(s1.prediction).toBe('BANKER');
    expect(s1.currentStep).toBe(2);
  });

  it('ignores NEW_SIGNAL with empty vector_forecast', () => {
    const s1 = reduce(createInitialState(), {
      type: 'NEW_SIGNAL',
      payload: {
        correlationKey: 'k-empty',
        mesa: 'M',
        round: '1',
        vector_forecast: [],
      },
    });
    expect(s1.status).toBe('IDLE');
  });

  it('ignores NEW_RESULT with invalid ganador', () => {
    let s = reduce(createInitialState(), {
      type: 'NEW_SIGNAL',
      payload: {
        correlationKey: 'k-bad',
        mesa: 'M',
        round: '1',
        vector_forecast: ['P', 'B'],
      },
    });
    expect(s.status).toBe('RUNNING');
    const before = s;
    s = reduce(s, { type: 'NEW_RESULT', payload: { correlationKey: 'k-bad', ganador: 'INVALID' } });
    expect(s).toBe(before);
  });

  it('after loss, next prediction follows contador_martingala', () => {
    let s = reduce(createInitialState(), {
      type: 'NEW_SIGNAL',
      payload: {
        correlationKey: 'k-cm',
        mesa: 'M',
        round: '1',
        vector_forecast: ['P', 'B', 'P', 'B', 'P', 'B'],
      },
    });
    expect(s.prediction).toBe('PLAYER');
    s = reduce(s, {
      type: 'NEW_RESULT',
      payload: { correlationKey: 'k-cm', ganador: 'B', contador_martingala: 3 },
    });
    expect(s.status).toBe('RUNNING');
    expect(s.currentStep).toBe(3);
    expect(s.prediction).toBe('PLAYER');
  });
});
