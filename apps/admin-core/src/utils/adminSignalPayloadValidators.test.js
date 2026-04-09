import { describe, expect, it, vi } from 'vitest';
import { formatResult, formatSignal } from './signalFormatter.js';
import {
  computeResultRowIncomplete,
  computeSignalRowIncomplete,
  validateResult,
  validateSignal,
} from './adminSignalPayloadValidators.js';

describe('validateSignal', () => {
  it('siempre ok: true; fila formatSignal válida sin warns críticos', () => {
    const s = formatSignal({
      mesa: 'M1',
      round: '5',
      recommendation: 'P',
      martingale: 0,
      vector_forecast: ['P', 'B', 'P', 'B', 'P', 'B'],
    });
    expect(validateSignal(s)).toEqual({ ok: true });
  });

  it('incompletos: ok true y warn etiquetado (no rechazo)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(validateSignal(null)).toEqual({ ok: true });
    expect(warn).toHaveBeenCalledWith('[INCOMPLETE_SIGNAL_NOT_OBJECT]', null);

    warn.mockClear();
    expect(
      validateSignal({
        mesa: 'UNKNOWN',
        round: 1,
        forecast6: ['P', 'B', '—', '—', '—', '—'],
      }),
    ).toEqual({ ok: true });
    expect(warn).toHaveBeenCalledWith('[INCOMPLETE_SIGNAL_INVALID_MESA]', expect.any(Object));

    warn.mockClear();
    expect(
      validateSignal({
        mesa: 'Baccarat 1',
        round: null,
        forecast6: ['P', 'B', '—', '—', '—', '—'],
      }),
    ).toEqual({ ok: true });
    expect(warn).toHaveBeenCalledWith('[INCOMPLETE_SIGNAL_NO_ROUND]', expect.any(Object));

    warn.mockClear();
    expect(
      validateSignal({
        mesa: 'Baccarat 1',
        round: null,
        correlationKey: 'id:provider-stable-id',
        forecast6: ['P', 'B', '—', '—', '—', '—'],
      }),
    ).toEqual({ ok: true });
    expect(warn).not.toHaveBeenCalledWith('[INCOMPLETE_SIGNAL_NO_ROUND]', expect.any(Object));

    warn.mockClear();
    expect(
      validateSignal({
        mesa: 'Baccarat 1',
        round: null,
        correlationKey: 'id:1775677483956',
        forecast6: ['P', 'B', '—', '—', '—', '—'],
      }),
    ).toEqual({ ok: true });
    expect(warn).toHaveBeenCalledWith('[INCOMPLETE_SIGNAL_NO_ROUND]', expect.any(Object));

    warn.mockClear();
    expect(
      validateSignal({
        mesa: 'Baccarat 1',
        round: 3,
        forecast6: ['P', 'B'],
      }),
    ).toEqual({ ok: true });
    expect(warn).toHaveBeenCalledWith('[INCOMPLETE_SIGNAL_FORECAST6]', expect.any(Object));

    warn.mockRestore();
  });
});

describe('computeSignalRowIncomplete', () => {
  it('detecta falta de ronda correlacionable o dirección', () => {
    expect(computeSignalRowIncomplete({ mesa: 'A', round: 1, recommendation: 'PLAYER' })).toBe(false);
    expect(computeSignalRowIncomplete({ mesa: 'A', correlationKey: 'id:x', recommendation: 'PLAYER' })).toBe(false);
    expect(
      computeSignalRowIncomplete({ mesa: 'A', correlationKey: 'id:1775677483956', recommendation: 'PLAYER' }),
    ).toBe(true);
    expect(computeSignalRowIncomplete({ mesa: 'A', round: null, recommendation: 'PLAYER' })).toBe(true);
    expect(computeSignalRowIncomplete({ mesa: 'A', round: 1, recommendation: 'UNKNOWN' })).toBe(true);
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

  it('incompleto: ok true y warn (no rechazo)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = formatResult(
      {
        mesa: 'T1',
        round: '1',
        scoreDetail: { cartas_player: [], cartas_banker: [], ganador: '—' },
      },
      null,
    );
    expect(validateResult(r)).toEqual({ ok: true });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('computeResultRowIncomplete', () => {
  it('sin mesa_info o ganador útil → incomplete', () => {
    expect(computeResultRowIncomplete({ mesa: 'A', round: 1, mesa_info: { cartas_player: [], cartas_banker: [], ganador: 'BANKER' } })).toBe(false);
    expect(computeResultRowIncomplete({ mesa: 'A', round: 1 })).toBe(true);
  });
});
