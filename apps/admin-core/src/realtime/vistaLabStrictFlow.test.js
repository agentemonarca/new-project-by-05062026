/**
 * Fase validación final: mismo pipeline que el socket store (`createLiveSignalEntry` / `createLiveResultEntry`)
 * + matcher VistaLab. Las fases React (SIGNAL_DETECTED → …) requieren prueba manual en UI con `full`.
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

  describe('5. Casos rechazados (no entran al buffer si strictOk === false)', () => {
    let warnSpy;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    function rejectSignalLikeStore(row) {
      const { formatted, strictOk } = createLiveSignalEntry(row, 't');
      if (!strictOk) console.warn('SIGNAL INVALIDA', formatted);
      return strictOk;
    }

    function rejectResultLikeStore(row, predicted) {
      const { formatted, strictOk } = createLiveResultEntry(row, predicted, 't');
      if (!strictOk) console.warn('RESULT INVALIDO', formatted);
      return strictOk;
    }

    it('mesa inválida → strictOk false, rejectReason y warn SIGNAL INVALIDA', () => {
      const { strictOk, rejectReason } = createLiveSignalEntry(
        { mesa: 'TEST', round: '1', recommendation: 'P', martingale: 0, vector_forecast: ['P', 'B', 'P', 'B', 'P', 'B'] },
        't',
      );
      expect(strictOk).toBe(false);
      expect(rejectReason).toBe('INVALID_MESA');
      expect(rejectSignalLikeStore({ mesa: 'TEST', round: '1', recommendation: 'P', martingale: 0 })).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith('SIGNAL INVALIDA', expect.any(Object));
    });

    it('mesa TEST sin nombre real → strictOk false', () => {
      expect(rejectSignalLikeStore(validSignalPayload('TEST', 1))).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith('SIGNAL INVALIDA', expect.any(Object));
    });

    it('round inválido (sin ronda resoluble) → strictOk false', () => {
      expect(
        rejectSignalLikeStore({
          mesa: 'Baccarat 5',
          round: '1775624340744',
          recommendation: 'P',
          martingale: 0,
          vector_forecast: ['P', 'B', 'P', 'B', 'P', 'B'],
        }),
      ).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith('SIGNAL INVALIDA', expect.any(Object));
    });

    it('forecast6: el formatter siempre rellena 6; fila con vector corto sigue siendo válida si mesa/round ok', () => {
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
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('resultado sin mesa_info válido → RESULT INVALIDO', () => {
      expect(
        rejectResultLikeStore(
          {
            mesa: 'Baccarat 5',
            round: '10',
          },
          'PLAYER',
        ),
      ).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith('RESULT INVALIDO', expect.any(Object));
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
