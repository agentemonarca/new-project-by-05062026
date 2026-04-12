import { describe, expect, it } from 'vitest';
import {
  clampArrayToMaxSteps,
  clampProviderMartingaleVectors,
  safeForecastVectorIndex,
  PROVIDER_MARTINGALE_MAX_STEPS,
} from './clampProviderMartingaleVectors.js';

describe('clampProviderMartingaleVectors', () => {
  it('slices to maxSteps and trims resultado/win to forecast length', () => {
    const vf = Array.from({ length: 10 }, (_, i) => i);
    const vr = Array.from({ length: 10 }, (_, i) => `R${i}`);
    const vw = ['W', 'L'];
    const out = clampProviderMartingaleVectors({ vector_forecast: vf, vector_resultado: vr, vector_win: vw });
    expect(out.vector_forecast).toHaveLength(PROVIDER_MARTINGALE_MAX_STEPS);
    expect(out.vector_resultado).toHaveLength(PROVIDER_MARTINGALE_MAX_STEPS);
    expect(out.vector_win).toHaveLength(2);
  });

  it('clips resultado when longer than forecast after maxSteps slice', () => {
    const out = clampProviderMartingaleVectors({
      vector_forecast: ['P', 'B', 'P'],
      vector_resultado: ['a', 'b', 'c', 'd', 'e'],
      vector_win: ['W', 'W', 'W', 'W'],
    });
    expect(out.vector_forecast).toEqual(['P', 'B', 'P']);
    expect(out.vector_resultado).toEqual(['a', 'b', 'c']);
    expect(out.vector_win).toEqual(['W', 'W', 'W']);
  });

  it('preserves undefined for missing resultado/win (no fake empty arrays)', () => {
    const out = clampProviderMartingaleVectors({
      vector_forecast: ['P', 'B'],
    });
    expect(out.vector_forecast).toEqual(['P', 'B']);
    expect(out.vector_resultado).toBeUndefined();
    expect(out.vector_win).toBeUndefined();
  });

  it('safeForecastVectorIndex clamps to vector bounds', () => {
    const v = ['A', 'B', 'C', 'D', 'E', 'F'];
    expect(safeForecastVectorIndex(99, v)).toBe(5);
    expect(safeForecastVectorIndex(-1, v)).toBe(0);
    expect(safeForecastVectorIndex(2, v)).toBe(2);
  });
});

describe('clampArrayToMaxSteps', () => {
  it('returns [] for non-array', () => {
    expect(clampArrayToMaxSteps(null)).toEqual([]);
  });
});
