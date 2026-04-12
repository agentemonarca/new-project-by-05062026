import { describe, expect, it } from 'vitest';
import { mapForecast, resolveSignalFromProvider } from './resolveSignalFromProvider.js';
import { formatSignal } from './signalFormatter.js';

describe('mapForecast', () => {
  it('primera celda P/B/E', () => {
    expect(mapForecast(['P'])).toBe('PLAYER');
    expect(mapForecast(['B'])).toBe('BANKER');
    expect(mapForecast(['E'])).toBe('TIE');
  });

  it('segundo argumento: índice de celda 0..5', () => {
    const vec = ['B', 'P', 'B', 'P', 'B', 'P'];
    expect(mapForecast(vec, 0)).toBe('BANKER');
    expect(mapForecast(vec, 1)).toBe('PLAYER');
    expect(mapForecast(vec, 5)).toBe('PLAYER');
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

  it('martingale 1-based: contador 2 → segunda celda del vector', () => {
    expect(
      resolveSignalFromProvider({
        recommendation: 'UNKNOWN',
        vector_forecast: ['B', 'P', 'B'],
        nombre_algoritmo: 'SIM',
        martingale: 2,
      }),
    ).toEqual({ signalName: 'SIM', direction: 'PLAYER' });
  });

  it('data.data.signal: martingala.contador_martingala gana sobre vector[0]', () => {
    const payload = {
      recommendation: 'UNKNOWN',
      data: {
        data: {
          signal: {
            nombre_algoritmo: 'SIMETRIA_DIRECTA',
            vector_forecast: ['P', 'B', 'P'],
            martingala: { contador_martingala: 2 },
          },
        },
      },
    };
    expect(resolveSignalFromProvider(payload)).toEqual({
      signalName: 'SIMETRIA_DIRECTA',
      direction: 'BANKER',
    });
  });

  it('contador 0 → primera celda', () => {
    expect(
      resolveSignalFromProvider({
        vector_forecast: ['P', 'B'],
        martingale: 0,
        nombre_algoritmo: 'X',
      }),
    ).toEqual({ signalName: 'X', direction: 'PLAYER' });
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
