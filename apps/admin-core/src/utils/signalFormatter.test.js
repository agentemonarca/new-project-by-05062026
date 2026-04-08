import { describe, expect, it } from 'vitest';
import {
  correlationKeyFromResolvedContext,
  forecastSixFromSignal,
  formatResult,
  formatSignal,
  forecastTokenToLetter,
  isContractInvalidMesa,
  normalizeContractRound,
  resolveMesaFromPayload,
  resolveRoundFromPayload,
} from './signalFormatter.js';

describe('forecastTokenToLetter', () => {
  it('normaliza tokens habituales', () => {
    expect(forecastTokenToLetter('P')).toBe('P');
    expect(forecastTokenToLetter('BANKER')).toBe('B');
    expect(forecastTokenToLetter('PLAYER')).toBe('P');
    expect(forecastTokenToLetter('TIE')).toBe('T');
  });
});

describe('forecastSixFromSignal', () => {
  it('rellena a 6 con —', () => {
    expect(forecastSixFromSignal({})).toEqual(['—', '—', '—', '—', '—', '—']);
  });

  it('lee vector_forecast o forecast', () => {
    expect(forecastSixFromSignal({ vector_forecast: ['P', 'B'] })).toEqual(['P', 'B', '—', '—', '—', '—']);
    expect(forecastSixFromSignal({ forecast: ['BANKER', 'PLAYER', 'T', 'P', 'B', 'P'] })).toEqual([
      'B',
      'P',
      'T',
      'P',
      'B',
      'P',
    ]);
  });
});

describe('formatSignal', () => {
  it('expone algorithm y forecast6', () => {
    const row = formatSignal({
      mesa: 'T1',
      round: '10',
      recommendation: 'P',
      martingale: 0,
      nombre_algoritmo: 'Oracle-X',
      vector_forecast: ['P', 'B'],
    });
    expect(row.algorithm).toBe('Oracle-X');
    expect(row.forecast6).toEqual(['P', 'B', '—', '—', '—', '—']);
    expect(row.round).toBe(10);
  });

  it('mesa TEST u otro placeholder cede a tableName / nombre real (VistaLab)', () => {
    const row = formatSignal({
      mesa: 'TEST',
      tableName: 'Baccarat 7',
      round: '1775624340744',
      ronda_actual: '51',
      recommendation: 'P',
      martingale: 0,
    });
    expect(row.mesa).toBe('Baccarat 7');
    expect(row.round).toBe(51);
    expect(row.correlationKey).toBe('mesa:Baccarat 7|round:51');
  });

  it('con id prioriza correlationKey id: y aún resuelve mesa para UI', () => {
    const row = formatSignal({
      mesa: 'TEST',
      tableName: 'Baccarat 7',
      id: 'sig-1',
      round: '51',
      recommendation: 'B',
      martingale: 0,
    });
    expect(row.mesa).toBe('Baccarat 7');
    expect(row.round).toBe(51);
    expect(row.correlationKey).toBe('id:sig-1');
  });

  it('payload anidado data.signal (proveedor real)', () => {
    const row = formatSignal({
      mesa: 'TEST',
      round: 1775624340744,
      data: {
        signal: {
          nombre_mesa: 'Baccarat 7',
          ronda_actual: 51,
          recommendation: 'PLAYER',
        },
      },
      martingale: 0,
    });
    expect(row.mesa).toBe('Baccarat 7');
    expect(row.round).toBe(51);
    expect(row.correlationKey).toBe('mesa:Baccarat 7|round:51');
    expect(row.predictionLabel).toBe('PLAYER');
  });
});

describe('resolveMesaFromPayload / resolveRoundFromPayload', () => {
  it('resolveMesa ignora TEST si hay nombre_mesa', () => {
    expect(resolveMesaFromPayload({ mesa: 'TEST', nombre_mesa: 'Mesa Real' })).toBe('Mesa Real');
  });

  it('resolveRound usa ronda_actual si round parece epoch', () => {
    expect(
      resolveRoundFromPayload({ round: '1775624340744', ronda_actual: '51' }),
    ).toBe('51');
    expect(resolveRoundFromPayload({ round: 1775624340744, ronda_actual: 51 })).toBe('51');
  });

  it('solo placeholders de mesa → UNKNOWN', () => {
    expect(resolveMesaFromPayload({ mesa: 'TEST' })).toBe('UNKNOWN');
  });
});

describe('normalizeContractRound / isContractInvalidMesa', () => {
  it('normaliza rondas válidas a entero', () => {
    expect(normalizeContractRound('51')).toBe(51);
    expect(normalizeContractRound(12)).toBe(12);
  });

  it('rechaza ronda inválida o epoch', () => {
    expect(normalizeContractRound('-')).toBe(null);
    expect(normalizeContractRound(1_775_624_340_744)).toBe(null);
  });

  it('isContractInvalidMesa cubre UNKNOWN, TEST y placeholders', () => {
    expect(isContractInvalidMesa('UNKNOWN')).toBe(true);
    expect(isContractInvalidMesa('TEST')).toBe(true);
    expect(isContractInvalidMesa('Baccarat 5')).toBe(false);
  });
});

describe('correlationKeyFromResolvedContext', () => {
  it('sin id arma mesa|round', () => {
    expect(correlationKeyFromResolvedContext(null, 'A', '5')).toBe('mesa:A|round:5');
  });
});

describe('formatResult + resolve', () => {
  it('resultado alinea mesa/round como la señal cuando el payload trae placeholders', () => {
    const row = formatResult(
      {
        mesa: 'TEST',
        tableName: 'Baccarat 7',
        round: '1775624340744',
        ronda_actual: '51',
        ganador: 'PLAYER',
        winStatus: true,
      },
      'PLAYER',
    );
    expect(row.mesa).toBe('Baccarat 7');
    expect(row.round).toBe(51);
    expect(row.correlationKey).toBe('mesa:Baccarat 7|round:51');
    expect(row.mesa_info).toMatchObject({
      cartas_player: [],
      cartas_banker: [],
      ganador: 'PLAYER',
    });
  });
});
