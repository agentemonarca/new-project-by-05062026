import { describe, it, expect } from 'vitest';
import {
  extractVectorForecastFromActiveRow,
  forecastStepIndexFromProviderRow,
} from './iaRealEngineUi.js';
import {
  forecastCellToSide,
  predictionSideFromVectorAndContador,
} from './providerMartingaleRead.js';

describe('IA Real — martingale step vs vector_forecast (stream merge / store)', () => {
  it('forecastStepIndexFromProviderRow prefers row.martingale over stale rawSignal contador', () => {
    const vf = ['P', 'B', 'P', 'B', 'P', 'B'];
    const row = {
      martingale: 3,
      rawSignal: {
        vector_forecast: vf,
        contador_martingala: 1,
      },
    };
    const len = extractVectorForecastFromActiveRow(row).length;
    expect(forecastStepIndexFromProviderRow(row, len)).toBe(2);
  });

  it('prediction uses vector_forecast at the same step as forecastStepIndexFromProviderRow (store martingale)', () => {
    const vf = ['P', 'B', 'P', 'B', 'P', 'B'];
    const row = {
      martingale: 2,
      rawSignal: { vector_forecast: vf, contador_martingala: 99 },
    };
    const len = extractVectorForecastFromActiveRow(row).length;
    const idx = forecastStepIndexFromProviderRow(row, len);
    const side = predictionSideFromVectorAndContador(vf, row.martingale);
    expect(idx).toBe(1);
    expect(side).toBe(forecastCellToSide(vf[idx]));
  });

  it('T1→T2: martingale 1→2 advances index 0→1 without changing rawSignal shape', () => {
    const rawSignal = { vector_forecast: ['P', 'B', 'P', 'B', 'P', 'B'], contador_martingala: 1 };
    const len = 6;
    expect(forecastStepIndexFromProviderRow({ martingale: 1, rawSignal }, len)).toBe(0);
    expect(forecastStepIndexFromProviderRow({ martingale: 2, rawSignal }, len)).toBe(1);
  });
});
