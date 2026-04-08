import { describe, expect, it } from 'vitest';
import { formatResult, formatSignal } from './signalFormatter.js';
import { validateResult, validateSignal } from './adminSignalPayloadValidators.js';

describe('validateSignal', () => {
  it('acepta fila formatSignal válida', () => {
    const s = formatSignal({
      mesa: 'M1',
      round: '5',
      recommendation: 'P',
      martingale: 0,
      vector_forecast: ['P', 'B', 'P', 'B', 'P', 'B'],
    });
    expect(validateSignal(s)).toEqual({ ok: true });
  });

  it('rechaza con razón NOT_OBJECT / INVALID_MESA / INVALID_ROUND / INVALID_FORECAST6', () => {
    expect(validateSignal(null)).toEqual({ ok: false, reason: 'NOT_OBJECT' });
    expect(
      validateSignal({
        mesa: 'UNKNOWN',
        round: 1,
        forecast6: ['P', 'B', '—', '—', '—', '—'],
      }),
    ).toEqual({ ok: false, reason: 'INVALID_MESA' });
    expect(
      validateSignal({
        mesa: 'Baccarat 1',
        round: null,
        forecast6: ['P', 'B', '—', '—', '—', '—'],
      }),
    ).toEqual({ ok: false, reason: 'INVALID_ROUND' });
    expect(
      validateSignal({
        mesa: 'Baccarat 1',
        round: 3,
        forecast6: ['P', 'B'],
      }),
    ).toEqual({ ok: false, reason: 'INVALID_FORECAST6' });
  });
});

describe('validateResult', () => {
  it('acepta fila formatResult con ganador y mesa_info', () => {
    const r = formatResult(
      {
        mesa: 'T1',
        round: '8',
        ganador: 'BANKER',
        winStatus: false,
        scoreDetail: {
          cartas_player: ['H1'],
          cartas_banker: ['S2', 'S3'],
          ganador: 'BANKER',
        },
      },
      'PLAYER',
    );
    expect(validateResult(r)).toEqual({ ok: true });
  });

  it('rechaza sin mesa_info o ganador vacío', () => {
    const r = formatResult(
      {
        mesa: 'T1',
        round: '1',
        scoreDetail: { cartas_player: [], cartas_banker: [], ganador: '—' },
      },
      null,
    );
    expect(validateResult(r)).toEqual({ ok: false, reason: 'NO_MESA_INFO' });
  });
});
