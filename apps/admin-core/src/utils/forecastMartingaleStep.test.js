import { describe, expect, it } from 'vitest';
import {
  forecastStepIndexFromContador,
  mapForecastAtStep,
  recommendationFromForecastCell,
} from './forecastMartingaleStep.js';

describe('forecastStepIndexFromContador', () => {
  it('contador ausente / vacío / ≤0 → índice 0', () => {
    expect(forecastStepIndexFromContador(undefined)).toBe(0);
    expect(forecastStepIndexFromContador(null)).toBe(0);
    expect(forecastStepIndexFromContador('')).toBe(0);
    expect(forecastStepIndexFromContador(0)).toBe(0);
    expect(forecastStepIndexFromContador(-1)).toBe(0);
  });

  it('contador 1 → idx 0; 2..6 → 1..5', () => {
    expect(forecastStepIndexFromContador(1)).toBe(0);
    expect(forecastStepIndexFromContador(2)).toBe(1);
    expect(forecastStepIndexFromContador(3)).toBe(2);
    expect(forecastStepIndexFromContador(6)).toBe(5);
  });

  it('contador > 6 se clamp a 5', () => {
    expect(forecastStepIndexFromContador(7)).toBe(5);
    expect(forecastStepIndexFromContador(99)).toBe(5);
  });

  it('acepta strings numéricas', () => {
    expect(forecastStepIndexFromContador('3')).toBe(2);
  });
});

describe('mapForecastAtStep', () => {
  const v = ['B', 'P', 'E'];

  it('devuelve celda cruda por índice', () => {
    expect(mapForecastAtStep(v, 0)).toBe('B');
    expect(mapForecastAtStep(v, 1)).toBe('P');
    expect(mapForecastAtStep(v, 2)).toBe('E');
  });

  it('celda vacía o fuera de rango → null', () => {
    expect(mapForecastAtStep(['P', '', 'B'], 1)).toBe(null);
    expect(mapForecastAtStep(['P'], 3)).toBe(null);
    expect(mapForecastAtStep([], 0)).toBe(null);
  });
});

describe('recommendationFromForecastCell', () => {
  it('normaliza P/B/E a PLAYER/BANKER/TIE', () => {
    expect(recommendationFromForecastCell('P')).toBe('PLAYER');
    expect(recommendationFromForecastCell('B')).toBe('BANKER');
    expect(recommendationFromForecastCell('E')).toBe('TIE');
  });
});

describe('validación vector fijo × contador (Winx)', () => {
  const vector = ['B', 'B', 'P', 'P', 'B', 'B'];
  const expected = ['B', 'B', 'P', 'P', 'B', 'B'];

  it('contador 1..6 → letra en vector[idx]', () => {
    for (let c = 1; c <= 6; c += 1) {
      const idx = forecastStepIndexFromContador(c);
      expect(mapForecastAtStep(vector, idx)).toBe(expected[idx]);
    }
  });
});
