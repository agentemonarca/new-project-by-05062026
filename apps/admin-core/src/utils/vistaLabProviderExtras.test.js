import { describe, expect, it } from 'vitest';
import {
  buildVistaLabExtras,
  martingaleStepLabel,
  mergeMesaInfoFromNestedIntoRow,
  parseProviderTiempoActual,
  pickMesaInfoRawFromPayload,
} from './vistaLabProviderExtras.js';

describe('vistaLabProviderExtras', () => {
  it('martingaleStepLabel ENTRADA / MG1 / MG2 / MGn', () => {
    expect(martingaleStepLabel(0)).toBe('ENTRADA');
    expect(martingaleStepLabel(1)).toBe('MG1');
    expect(martingaleStepLabel(2)).toBe('MG2');
    expect(martingaleStepLabel(3)).toBe('MG3');
  });

  it('parseProviderTiempoActual parsea timestamp proveedor', () => {
    const t = parseProviderTiempoActual('2026-04-07 19:17:28.340037-04:00');
    expect(t).toBeTypeOf('number');
    expect(Number.isNaN(t)).toBe(false);
  });

  it('buildVistaLabExtras lee martingala y trayecto', () => {
    const mi = {
      data_evento: { tiempo_actual: '2026-04-07 19:17:28.340037-04:00' },
      martingala: {
        active: false,
        contador_martingala: 0,
        vector_forecast: ['B', 'B', 'P', 'B', 'P', 'B'],
        vector_resultado: ['B'],
        vector_win: ['W'],
      },
    };
    const x = buildVistaLabExtras(mi, null);
    expect(x.martingaleStepLabel).toBe('ENTRADA');
    expect(x.martingaleActive).toBe(false);
    expect(x.shotCurrent).toBe(1);
    expect(x.shotTotal).toBe(6);
    expect(x.vectorResultado).toEqual(['B']);
    expect(x.vectorWin).toEqual(['W']);
    expect(x.tiempoActualIso).toContain('2026-04-07');
  });

  it('mergeMesaInfoFromNestedIntoRow rellena mesa_info desde data.data.results', () => {
    const row = {
      data: {
        data: {
          results: {
            mesa_info: {
              ganador: 'BANKER',
              martingala: { contador_martingala: 1, active: true, vector_resultado: [], vector_win: [] },
            },
          },
        },
      },
    };
    mergeMesaInfoFromNestedIntoRow(row);
    expect(pickMesaInfoRawFromPayload(row)?.martingala?.contador_martingala).toBe(1);
  });
});
