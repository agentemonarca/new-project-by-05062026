import { describe, expect, it } from 'vitest';
import { createInitialState, reduce } from './executionEngine.js';
import { replayFold } from './executionReplay.js';

describe('replayFold', () => {
  it('matches sequential reduce for signal + two results', () => {
    const events = [
      {
        type: 'NEW_SIGNAL',
        payload: {
          correlationKey: 'k',
          mesa: 'M',
          round: '1',
          vector_forecast: ['P', 'B'],
        },
      },
      { type: 'NEW_RESULT', payload: { correlationKey: 'k', ganador: 'B', contador_martingala: 2, vector_win: ['L'] } },
      { type: 'NEW_RESULT', payload: { correlationKey: 'k', ganador: 'B', contador_martingala: 3, vector_win: ['L'] } },
    ];

    let s = createInitialState();
    for (let i = 0; i < events.length; i += 1) {
      s = reduce(s, events[i]);
      const a = replayFold(events, i);
      expect({ ...a, startedAt: null }).toEqual({ ...s, startedAt: null });
    }
  });

  it('endInclusive -1 yields idle', () => {
    const events = [
      {
        type: 'NEW_SIGNAL',
        payload: {
          correlationKey: 'k',
          mesa: 'M',
          round: '1',
          vector_forecast: ['P'],
        },
      },
    ];
    expect(replayFold(events, -1)).toEqual(createInitialState());
  });
});
