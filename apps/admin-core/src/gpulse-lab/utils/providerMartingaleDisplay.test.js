import { describe, expect, it } from 'vitest';
import { buildMartingaleStepRows } from './providerMartingaleDisplay.js';

describe('buildMartingaleStepRows', () => {
  it('aligns display length to shortest of forecast, resultado, win', () => {
    const m = buildMartingaleStepRows({
      vector_forecast: ['P', 'B', 'P', 'B', 'P', 'B'],
      vector_resultado: ['B', 'P'],
      vector_win: ['L', 'W'],
      martingala: 1,
    });
    expect(m.rows).toHaveLength(2);
    expect(m.paddedForecast).toHaveLength(2);
    expect(m.rows[0].predLabel).toBeTruthy();
    expect(m.rows[1].winLabel).toBe('WIN');
  });

  it('caps at 6 steps when all vectors are long', () => {
    const vf = Array.from({ length: 10 }, () => 'P');
    const m = buildMartingaleStepRows({
      vector_forecast: vf,
      vector_resultado: vf,
      vector_win: vf,
      martingala: 2,
    });
    expect(m.rows).toHaveLength(6);
    expect(m.paddedForecast).toHaveLength(6);
  });
});
