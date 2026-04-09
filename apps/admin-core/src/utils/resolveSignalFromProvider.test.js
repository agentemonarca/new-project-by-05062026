import { describe, expect, it } from 'vitest';
import { mapForecast, resolveSignalFromProvider } from './resolveSignalFromProvider.js';
import { formatSignal } from './signalFormatter.js';

describe('mapForecast', () => {
  it('primera celda P/B/E', () => {
    expect(mapForecast(['P'])).toBe('PLAYER');
    expect(mapForecast(['B'])).toBe('BANKER');
    expect(mapForecast(['E'])).toBe('TIE');
  });

  it('vacío → null', () => {
    expect(mapForecast([])).toBe(null);
    expect(mapForecast(null)).toBe(null);
  });
});

describe('resolveSignalFromProvider', () => {
  it('lee data.data.signal (nombre + vector)', () => {
    const payload = {
      recommendation: 'UNKNOWN',
      data: {
        data: {
          signal: {
            nombre_algoritmo: 'SIMETRIA_DIRECTA',
            vector_forecast: ['P', 'B'],
          },
        },
      },
    };
    expect(resolveSignalFromProvider(payload)).toEqual({
      signalName: 'SIMETRIA_DIRECTA',
      direction: 'PLAYER',
    });
  });

  it('payload plano con vector_forecast sin anidar', () => {
    expect(
      resolveSignalFromProvider({
        vector_forecast: ['B'],
        nombre_algoritmo: 'X',
      }),
    ).toEqual({ signalName: 'X', direction: 'BANKER' });
  });
});

describe('formatSignal + provider', () => {
  it('recommendation UNKNOWN pero vector define PLAYER', () => {
    const row = formatSignal({
      mesa: 'T1',
      round: 1,
      recommendation: 'UNKNOWN',
      data: {
        data: {
          signal: {
            nombre_algoritmo: 'SIMETRIA_DIRECTA',
            vector_forecast: ['P'],
          },
        },
      },
    });
    expect(row.recommendation).toBe('PLAYER');
    expect(row.algorithm).toBe('SIMETRIA_DIRECTA');
  });
});
