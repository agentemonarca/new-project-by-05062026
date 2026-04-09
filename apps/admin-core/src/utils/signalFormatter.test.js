import { describe, expect, it } from 'vitest';
import {
  correlationKeyFromResolvedContext,
  displayRoundForLiveRow,
  displayRoundOrIdHintForLiveRow,
  extractRoundFromPipeCorrelationKey,
  forecastSixFromSignal,
  formatResult,
  formatSignal,
  forecastTokenToLetter,
  isContractInvalidMesa,
  normalizeContractRound,
  resolveMesaFromPayload,
  resolveRoundFromPayload,
} from './signalFormatter.js';

describe('displayRoundForLiveRow', () => {
  it('usa round numérico si existe', () => {
    expect(displayRoundForLiveRow({ round: 38, correlationKey: 'id:x' })).toBe('38');
  });

  it('si round es null y CK es mesa|n, muestra n (VistaLab con id: + pipe en otro campo)', () => {
    expect(displayRoundForLiveRow({ round: null, correlationKey: 'Baccarat 5|38' })).toBe('38');
  });

  it('sin ronda ni CK útil → —', () => {
    expect(displayRoundForLiveRow({ round: null, correlationKey: 'id:only' })).toBe('—');
  });
});

describe('displayRoundOrIdHintForLiveRow', () => {
  it('prioriza ronda numérica o mesa|n igual que displayRoundForLiveRow', () => {
    expect(displayRoundOrIdHintForLiveRow({ round: 5 })).toBe('5');
    expect(displayRoundOrIdHintForLiveRow({ round: null, correlationKey: 'Baccarat 5|38' })).toBe('38');
  });

  it('con correlationKey id:corta muestra id · tail', () => {
    expect(displayRoundOrIdHintForLiveRow({ round: '', correlationKey: 'id:abc' })).toBe('id · abc');
  });

  it('con id larga muestra sufijo acortado', () => {
    expect(displayRoundOrIdHintForLiveRow({ round: null, correlationKey: 'id:1775684033582' })).toBe('id · …033582');
  });
});

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
    expect(row.correlationKey).toBe('Baccarat 7|51');
  });

  it('lee Ronda desde data_evento en bloque signal (Winxplay)', () => {
    const row = formatSignal({
      mesa: 'Baccarat 3',
      id: '1775674655128',
      data: {
        signal: {
          nombre_mesa: 'Baccarat 3',
          data_evento: { mesa: 'Baccarat 3', Ronda: 88, Apuesta: 'PLAYER' },
        },
      },
      recommendation: 'PLAYER',
      martingale: 0,
      vector_forecast: ['P', 'B'],
    });
    expect(row.round).toBe(88);
    expect(row.correlationKey).toBe('Baccarat 3|88');
  });

  it('lee ronda en raíz (proveedor Winxplay) sin round inglés', () => {
    const row = formatSignal({
      mesa: 'Baccarat 1',
      id: '1775674412640',
      ronda: 42,
      recommendation: 'PLAYER',
      martingale: 0,
      vector_forecast: ['P', 'B'],
    });
    expect(row.mesa).toBe('Baccarat 1');
    expect(row.round).toBe(42);
    expect(row.correlationKey).toBe('Baccarat 1|42');
  });

  it('con mesa y round resueltos usa mesa|round (no id:) como correlationKey', () => {
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
    expect(row.correlationKey).toBe('Baccarat 7|51');
  });

  it('correlationKey del servidor (pipe) gana sobre id en payload', () => {
    const row = formatSignal({
      mesa: 'TEST',
      tableName: 'Baccarat 7',
      id: 'sig-1',
      correlationKey: 'Baccarat 7|51',
      round: '51',
      recommendation: 'B',
      martingale: 0,
      vector_forecast: ['P', 'B', 'P', 'B', 'P', 'B'],
    });
    expect(row.correlationKey).toBe('Baccarat 7|51');
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
    expect(row.correlationKey).toBe('Baccarat 7|51');
    expect(row.predictionLabel).toBe('PLAYER');
  });

  it('signal en raíz sin capa data (relay que solo desanida inner)', () => {
    const row = formatSignal({
      mesa: 'Baccarat 2',
      round: 88,
      signal: {
        nombre_mesa: 'Baccarat 2',
        ronda_actual: 88,
      },
      recommendation: 'BANKER',
      martingale: 0,
    });
    expect(row.mesa).toBe('Baccarat 2');
    expect(row.round).toBe(88);
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

  it('resolveRound extrae ronda desde correlationKey mesa|ronda (sin round plano)', () => {
    expect(resolveRoundFromPayload({ correlationKey: 'Baccarat 5|142', mesa: 'Baccarat 5' })).toBe('142');
    expect(formatSignal({ mesa: 'Baccarat 5', correlationKey: 'Baccarat 5|142', recommendation: 'P', martingale: 0 }).round).toBe(
      142,
    );
  });

  it('formatSignal: fallback CK en salida si round quedara null (defensa UI)', () => {
    const row = formatSignal({
      mesa: 'Mesa X',
      round: null,
      correlationKey: 'Mesa X|55',
      recommendation: 'B',
      martingale: 0,
    });
    expect(row.round).toBe(55);
  });

  it('no interpreta id: como clave pipe', () => {
    expect(extractRoundFromPipeCorrelationKey('id:1775674655128')).toBe(null);
  });

  it('resolveRound lee ronda desde mesa_info anidado (resultados proveedor)', () => {
    expect(
      resolveRoundFromPayload({
        mesa: 'Baccarat 3',
        data: { data: { results: { mesa_info: { ronda_objetivo: 77, ganador: 'PLAYER' } } } },
      })
    ).toBe('77');
  });

  it('mesa_info: ronda_objetivo gana sobre ronda_actual', () => {
    expect(
      resolveRoundFromPayload({
        data: {
          data: {
            results: {
              mesa_info: { ronda_objetivo: 38, ronda_actual: 39 },
            },
          },
        },
      }),
    ).toBe('38');
  });

  it('mesa_info: data_evento.Ronda antes que ronda_actual si falta objetivo', () => {
    expect(
      resolveRoundFromPayload({
        data: {
          results: {
            mesa_info: {
              ronda_actual: 99,
              data_evento: { Ronda: 38 },
            },
          },
        },
      }),
    ).toBe('38');
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
  it('sin servidor ni id arma mesa|round', () => {
    expect(correlationKeyFromResolvedContext(null, null, 'A', '5')).toBe('A|5');
  });

  it('prioriza correlationKey del servidor si contiene |', () => {
    expect(
      correlationKeyFromResolvedContext({ correlationKey: 'Baccarat 5|51' }, 'sig-1', 'X', '1'),
    ).toBe('Baccarat 5|51');
  });

  it('prioriza mesa|round sobre id del proveedor', () => {
    expect(correlationKeyFromResolvedContext({}, 'sig-1', 'M', '9')).toBe('M|9');
  });

  it('sin mesa/ronda resuelta usa id estable del proveedor', () => {
    expect(correlationKeyFromResolvedContext({}, 'sig-1', '', '')).toBe('id:sig-1');
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
    expect(row.correlationKey).toBe('Baccarat 7|51');
    expect(row.mesa_info).toMatchObject({
      cartas_player: [],
      cartas_banker: [],
      ganador: 'PLAYER',
    });
  });
});
