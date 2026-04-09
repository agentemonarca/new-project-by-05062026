/**
 * Pipeline store + matcher VistaLab. La validación ya no rechaza filas; `strictOk` sigue siendo true
 * cuando `validation.ok` (siempre). Las fases React requieren prueba manual con `full`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_SIGNALS_STRICT_MODE } from '../utils/adminSignalPayloadValidators.js';
import { findMatchingResultForSignal, resultMatchesSignal } from '../utils/vistaLabCycle.js';
import { createLiveResultEntry, createLiveSignalEntry } from './adminSignalsLiveIngest.js';

function validSignalPayload(mesa = 'Baccarat 5', round = 51) {
  return {
    mesa,
    round: String(round),
    recommendation: 'PLAYER',
    martingale: 0,
    vector_forecast: ['P', 'B', 'P', 'B', 'P', 'B'],
  };
}

function validResultPayload(mesa = 'Baccarat 5', round = 51, ganador = 'BANKER') {
  return {
    mesa,
    round: String(round),
    ganador,
    winStatus: false,
    scoreDetail: {
      cartas_player: ['H7', 'H8'],
      cartas_banker: ['S9', 'ST', 'CJ'],
      ganador,
      puntaje_player: '5',
      puntaje_banker: '9',
    },
  };
}

describe('STRICT_MODE pipeline (ingesta = store)', () => {
  it('por defecto STRICT activo en tests', () => {
    expect(ADMIN_SIGNALS_STRICT_MODE).toBe(true);
  });

  describe('1. Señal válida', () => {
    it('Baccarat 5 / round 51 / forecast6', () => {
      const { formatted, strictOk } = createLiveSignalEntry(validSignalPayload('Baccarat 5', 51), 'recv-s1');
      expect(strictOk).toBe(true);
      expect(formatted.mesa).toBe('Baccarat 5');
      expect(formatted.round).toBe(51);
      expect(formatted.forecast6).toHaveLength(6);
    });

    it('Baccarat 7 aceptada', () => {
      const { strictOk, formatted } = createLiveSignalEntry(validSignalPayload('Baccarat 7', 52), 'recv-s2');
      expect(strictOk).toBe(true);
      expect(formatted.mesa).toBe('Baccarat 7');
      expect(formatted.round).toBe(52);
    });
  });

  describe('2. Resultado válido', () => {
    it('mesa, round, cartas y ganador (mesa_info)', () => {
      const { formatted, strictOk } = createLiveResultEntry(validResultPayload('Baccarat 5', 51, 'BANKER'), 'PLAYER', 'recv-r1');
      expect(strictOk).toBe(true);
      expect(formatted.mesa).toBe('Baccarat 5');
      expect(formatted.round).toBe(51);
      expect(formatted.mesa_info?.cartas_player?.length).toBeGreaterThan(0);
      expect(formatted.mesa_info?.cartas_banker?.length).toBeGreaterThan(0);
      expect(String(formatted.mesa_info?.ganador ?? '')).toMatch(/BANKER/i);
    });
  });

  describe('3. Match (sin falsos positivos básicos)', () => {
    it('✓ match misma mesa y round', () => {
      const sig = createLiveSignalEntry(validSignalPayload('Baccarat 5', 51), 's1').formatted;
      const res = createLiveResultEntry(validResultPayload('Baccarat 5', 51), 'PLAYER', 'r1').formatted;
      expect(resultMatchesSignal(sig, res)).toBe(true);
    });

    it('✗ misma mesa round distinto', () => {
      const sig = createLiveSignalEntry(validSignalPayload('Baccarat 5', 51), 's1').formatted;
      const res = createLiveResultEntry(validResultPayload('Baccarat 5', 52), 'PLAYER', 'r1').formatted;
      expect(resultMatchesSignal(sig, res)).toBe(false);
    });

    it('✗ mesa distinta aunque round coincida', () => {
      const sig = createLiveSignalEntry(validSignalPayload('Baccarat 5', 51), 's1').formatted;
      const res = createLiveResultEntry(validResultPayload('Baccarat 7', 51), 'PLAYER', 'r1').formatted;
      expect(resultMatchesSignal(sig, res)).toBe(false);
    });
  });

  describe('5. Casos incompletos (entran al buffer; solo warns [INCOMPLETE_*])', () => {
    let warnSpy;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('mesa TEST → strictOk true y warn INVALID_MESA', () => {
      const { strictOk, rejectReason } = createLiveSignalEntry(
        { mesa: 'TEST', round: '1', recommendation: 'P', martingale: 0, vector_forecast: ['P', 'B', 'P', 'B', 'P', 'B'] },
        't',
      );
      expect(strictOk).toBe(true);
      expect(rejectReason).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith('[INCOMPLETE_SIGNAL_INVALID_MESA]', expect.any(Object));
    });

    it('mesa TEST vía validSignalPayload → entra al buffer', () => {
      const { strictOk } = createLiveSignalEntry(validSignalPayload('TEST', 1), 't');
      expect(strictOk).toBe(true);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('round epoch (timestamp) → entra; formatter puede dejar ronda sin correlación clara', () => {
      const { strictOk } = createLiveSignalEntry(
        {
          mesa: 'Baccarat 5',
          round: '1775624340744',
          recommendation: 'P',
          martingale: 0,
          vector_forecast: ['P', 'B', 'P', 'B', 'P', 'B'],
        },
        't',
      );
      expect(strictOk).toBe(true);
    });

    it('vector corto: formatter rellena forecast6; strictOk true', () => {
      const { strictOk } = createLiveSignalEntry(
        {
          mesa: 'Baccarat 5',
          round: '10',
          recommendation: 'P',
          martingale: 0,
          vector_forecast: ['P'],
        },
        't',
      );
      expect(strictOk).toBe(true);
    });

    it('resultado mínimo sin scoreDetail → strictOk true y warns', () => {
      const { strictOk } = createLiveResultEntry(
        {
          mesa: 'Baccarat 5',
          round: '10',
        },
        'PLAYER',
        't',
      );
      expect(strictOk).toBe(true);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('8. Resultado válido sin match → no hay fila para runAfterResult', () => {
    it('findMatchingResultForSignal devuelve null; el panel no debe avanzar de fase con este par', () => {
      const sig = createLiveSignalEntry(validSignalPayload('Baccarat 5', 51), 's1').formatted;
      const orphan = createLiveResultEntry(validResultPayload('Baccarat 7', 51, 'PLAYER'), 'PLAYER', 'r-orphan').formatted;
      expect(resultMatchesSignal(sig, orphan)).toBe(false);
      expect(findMatchingResultForSignal(sig, [orphan], null)).toBe(null);
    });
  });
});
