import { describe, it, expect } from 'vitest';
import {
  augmentOutcomePayloadFromAdminRaw,
  extractMesaInfoFlexible,
  extractMesaInfoFromDataDataResults,
  extractMesaInfoFromResultRaw,
  extractVectorForecastFromActiveRow,
  forecastStepIndexFromProviderRow,
  liveScoresFromOutcomeRow,
  mergeSettledResultPayloadPreferringCards,
  resolveOutcomeRowResultPayload,
} from './iaRealEngineUi.js';
import {
  forecastCellToSide,
  mergeResultEnvelopeForExtract,
  predictionSideFromVectorAndContador,
} from './providerMartingaleRead.js';

describe('extractMesaInfoFromResultRaw', () => {
  it('merges cartas from scoreDetail when mesa_info path is empty', () => {
    const raw = {
      scoreDetail: {
        ganador: 'PLAYER',
        cartas_player: ['K', '8'],
        cartas_banker: ['Q', '6'],
        puntaje_player: '8',
        puntaje_banker: '6',
      },
    };
    const m = extractMesaInfoFromResultRaw(raw);
    expect(m.ganador).toBe('PLAYER');
    expect(m.cartas_player).toEqual(['K', '8']);
    expect(m.cartas_banker).toEqual(['Q', '6']);
    expect(m.puntaje_player).toBe('8');
    expect(m.puntaje_banker).toBe('6');
  });

  it('accepts player_cards / banker_cards aliases on scoreDetail', () => {
    const raw = {
      scoreDetail: {
        ganador: 'BANKER',
        player_cards: ['9'],
        banker_cards: ['10', '7'],
      },
    };
    const m = extractMesaInfoFromResultRaw(raw);
    expect(m.cartas_player).toEqual(['9']);
    expect(m.cartas_banker).toEqual(['10', '7']);
  });
});

describe('extractMesaInfoFromDataDataResults', () => {
  it('reads only payload.data.data.results.mesa_info', () => {
    const raw = {
      data: {
        data: {
          results: {
            mesa_info: {
              ganador: 'PLAYER',
              cartas_player: ['A', '8'],
              cartas_banker: ['K', '7'],
            },
          },
        },
      },
    };
    const m = extractMesaInfoFromDataDataResults(raw);
    expect(m.ganador).toBe('PLAYER');
    expect(m.cartas_player).toEqual(['A', '8']);
    expect(m.cartas_banker).toEqual(['K', '7']);
  });

  it('does not fall back to scoreDetail', () => {
    const raw = {
      scoreDetail: { ganador: 'BANKER', cartas_player: ['9'], cartas_banker: ['8'] },
    };
    const m = extractMesaInfoFromDataDataResults(raw);
    expect(m.cartas_player).toEqual([]);
    expect(m.cartas_banker).toEqual([]);
  });

  it('reads data.results.mesa_info (un solo `data`) y tablero si faltan cartas_*', () => {
    const raw = {
      data: {
        results: {
          mesa_info: {
            ganador: 'PLAYER',
            tablero: ['10♠', 'K♥', '8♦', '6♣'],
          },
        },
      },
    };
    const m = extractMesaInfoFromDataDataResults(raw);
    expect(m.cartas_player).toEqual(['10♠', '8♦']);
    expect(m.cartas_banker).toEqual(['K♥', '6♣']);
  });

  it('acepta `data` como string JSON', () => {
    const inner = {
      results: {
        mesa_info: {
          ganador: 'BANKER',
          cartas_player: ['J'],
          cartas_banker: ['2', '3'],
        },
      },
    };
    const raw = { data: JSON.stringify(inner) };
    const m = extractMesaInfoFromDataDataResults(raw);
    expect(m.cartas_player).toEqual(['J']);
    expect(m.cartas_banker).toEqual(['2', '3']);
  });
});

describe('resolveOutcomeRowResultPayload', () => {
  it('parses string JSON rawResult then extract finds cartas', () => {
    const inner = {
      scoreDetail: { cartas_player: ['2', '3'], cartas_banker: ['K', '4'] },
    };
    const row = {
      id: 't1',
      rawResult: JSON.stringify({ type: 'NEW_RESULT', data: JSON.stringify(inner) }),
    };
    const payload = resolveOutcomeRowResultPayload(row);
    expect(payload).not.toBeNull();
    const m = extractMesaInfoFlexible(payload);
    expect(m.cartas_player.length).toBeGreaterThan(0);
    expect(m.cartas_banker.length).toBeGreaterThan(0);
  });

  it('lee raw_result (snake_case) si rawResult falta', () => {
    const inner = { scoreDetail: { cartas_player: ['3'], cartas_banker: ['4', '5'] } };
    const row = { id: 't3', raw_result: JSON.stringify({ type: 'NEW_RESULT', data: JSON.stringify(inner) }) };
    const payload = resolveOutcomeRowResultPayload(row);
    expect(payload).not.toBeNull();
    expect(extractMesaInfoFlexible(payload).cartas_player.length).toBeGreaterThan(0);
  });

  it('lee `raw` (alias normalize) si rawResult falta', () => {
    const row = {
      id: 't-raw',
      raw: { type: 'NEW_RESULT', scoreDetail: { cartas_player: ['10'], cartas_banker: ['J', '3'], ganador: 'B' } },
    };
    const payload = resolveOutcomeRowResultPayload(row);
    expect(payload).not.toBeNull();
    expect(extractMesaInfoFlexible(payload).cartas_banker.length).toBeGreaterThan(0);
  });

  it('unwraps doble JSON.stringify sobre el mismo payload', () => {
    const inner = { scoreDetail: { cartas_player: ['A'], cartas_banker: ['K', '2'] } };
    const once = JSON.stringify(inner);
    const row = { id: 't2', rawResult: JSON.stringify(once) };
    const payload = resolveOutcomeRowResultPayload(row);
    expect(payload).toEqual(inner);
    const m = extractMesaInfoFlexible(payload);
    expect(m.cartas_player.length).toBeGreaterThan(0);
  });
});

describe('extractMesaInfoFlexible', () => {
  it('prefers nested data.data.results.mesa_info when present', () => {
    const raw = {
      scoreDetail: { ganador: 'BANKER', cartas_player: ['9'], cartas_banker: ['8'] },
      data: {
        data: {
          results: {
            mesa_info: {
              ganador: 'PLAYER',
              cartas_player: ['A', '2'],
              cartas_banker: ['K', '3'],
            },
          },
        },
      },
    };
    const m = extractMesaInfoFlexible(raw);
    expect(m.ganador).toBe('PLAYER');
    expect(m.cartas_player).toEqual(['A', '2']);
    expect(m.cartas_banker).toEqual(['K', '3']);
  });

  it('uses scoreDetail when nested path is empty', () => {
    const raw = {
      scoreDetail: { ganador: 'BANKER', cartas_player: ['9'], cartas_banker: ['8', '7'] },
    };
    const m = extractMesaInfoFlexible(raw);
    expect(m.ganador).toBe('BANKER');
    expect(m.cartas_player).toEqual(['9']);
    expect(m.cartas_banker).toEqual(['8', '7']);
  });

  it('uses root mesa_info when nested and scoreDetail are absent', () => {
    const raw = {
      mesa_info: { ganador: 'PLAYER', cartas_player: ['Q'], cartas_banker: ['J', '5'] },
    };
    const m = extractMesaInfoFlexible(raw);
    expect(m.ganador).toBe('PLAYER');
    expect(m.cartas_player).toEqual(['Q']);
    expect(m.cartas_banker).toEqual(['J', '5']);
  });

  it('reads flat.results.mesa_info after merge when only data.results exists (no data.data)', () => {
    const raw = {
      data: {
        results: {
          mesa_info: {
            ganador: 'PLAYER',
            cartas_player: ['4', '5'],
            cartas_banker: ['6', '7'],
          },
        },
      },
    };
    const m = extractMesaInfoFlexible(raw);
    expect(m.ganador).toBe('PLAYER');
    expect(m.cartas_player).toEqual(['4', '5']);
    expect(m.cartas_banker).toEqual(['6', '7']);
  });

  it('fallback: scoreDetail.player and scoreDetail.banker when canonical card arrays empty', () => {
    const raw = {
      scoreDetail: {
        player: ['10', 'Q'],
        banker: ['4', '5', '6'],
      },
    };
    const m = extractMesaInfoFlexible(raw);
    expect(m.cartas_player).toEqual(['10', 'Q']);
    expect(m.cartas_banker).toEqual(['4', '5', '6']);
  });

  it('NEW_RESULT: varias capas `data` string JSON → cartas vía merge iterativo', () => {
    const leaf = {
      scoreDetail: {
        ganador: 'BANKER',
        cartas_player: ['9', '8'],
        cartas_banker: ['K', '7'],
      },
    };
    const mid = { data: JSON.stringify(leaf) };
    const raw = { type: 'NEW_RESULT', data: JSON.stringify(mid) };
    const m = extractMesaInfoFlexible(raw);
    expect(m.cartas_player.length).toBeGreaterThan(0);
    expect(m.cartas_banker.length).toBeGreaterThan(0);
  });

  it('NEW_RESULT: payload como array de un elemento (socket.io) + data string', () => {
    const inner = {
      scoreDetail: { ganador: 'PLAYER', cartas_player: ['4'], cartas_banker: ['5', '6'] },
    };
    const raw = [{ type: 'NEW_RESULT', data: JSON.stringify(inner) }];
    const m = extractMesaInfoFlexible(raw);
    expect(m.cartas_player.length).toBeGreaterThan(0);
    expect(m.cartas_banker.length).toBeGreaterThan(0);
  });

  it('NEW_RESULT: cartas en `payload` string (sin `data`)', () => {
    const inner = {
      scoreDetail: { ganador: 'BANKER', cartas_player: ['10'], cartas_banker: ['4', '3'] },
    };
    const raw = { type: 'NEW_RESULT', payload: JSON.stringify(inner) };
    const m = extractMesaInfoFlexible(raw);
    expect(m.cartas_player.length).toBeGreaterThan(0);
    expect(m.cartas_banker.length).toBeGreaterThan(0);
  });

  it('NEW_RESULT: `data` como string JSON (solo claves top type+data en relay) → cartas vía merge', () => {
    const inner = {
      scoreDetail: {
        ganador: 'PLAYER',
        cartas_player: ['4', '5'],
        cartas_banker: ['6', '7'],
      },
    };
    const raw = { type: 'NEW_RESULT', data: JSON.stringify(inner) };
    const m = extractMesaInfoFlexible(raw);
    expect(m.cartas_player).toEqual(['4', '5']);
    expect(m.cartas_banker).toEqual(['6', '7']);
  });

  it('NEW_RESULT: cartas en `signal` (doc BFF / Mongo; runtime mergedKeys incluía `signal`)', () => {
    const raw = {
      type: 'NEW_RESULT',
      mesa: 'mesa-1',
      tipo: 'NEW_RESULT',
      win: true,
      ronda: 12,
      signal: {
        _id: '507f1f77bcf86cd799439011',
        scoreDetail: {
          ganador: 'PLAYER',
          cartas_player: ['4', 'K'],
          cartas_banker: ['9', '8', '7'],
        },
      },
    };
    const m = extractMesaInfoFlexible(raw);
    expect(m.ganador).toBe('PLAYER');
    expect(m.cartas_player).toEqual(['4', 'K']);
    expect(m.cartas_banker).toEqual(['9', '8', '7']);
  });

  it('NEW_RESULT: `signal` como string JSON (no objeto) → mismas cartas', () => {
    const inner = {
      scoreDetail: {
        ganador: 'BANKER',
        cartas_player: ['10', 'J'],
        cartas_banker: ['3', '4', '5'],
      },
    };
    const raw = {
      type: 'NEW_RESULT',
      signal: JSON.stringify(inner),
    };
    const m = extractMesaInfoFlexible(raw);
    expect(m.ganador).toBe('BANKER');
    expect(m.cartas_player).toEqual(['10', 'J']);
    expect(m.cartas_banker).toEqual(['3', '4', '5']);
  });

  it('reads mesa_info inside data.martingalaData (clave típica en payload cliente / admin)', () => {
    const raw = {
      type: 'NEW_RESULT',
      winStatus: true,
      data: {
        martingalaData: {
          mesa_info: {
            ganador: 'BANKER',
            cartas_player: ['2', '3'],
            cartas_banker: ['K', '7'],
          },
        },
      },
    };
    const m = extractMesaInfoFlexible(raw);
    expect(m.ganador).toBe('BANKER');
    expect(m.cartas_player).toEqual(['2', '3']);
    expect(m.cartas_banker).toEqual(['K', '7']);
  });

  it('nested ganador-only no impide leer cartas desde scoreDetail en raíz', () => {
    const raw = {
      data: {
        data: {
          results: {
            mesa_info: {
              ganador: 'PLAYER',
              cartas_player: [],
              cartas_banker: [],
            },
          },
        },
      },
      scoreDetail: {
        ganador: 'PLAYER',
        cartas_player: ['4'],
        cartas_banker: ['5', '6'],
      },
    };
    const m = extractMesaInfoFlexible(raw);
    expect(m.cartas_player).toEqual(['4']);
    expect(m.cartas_banker).toEqual(['5', '6']);
  });

  it('coerces comma-separated string cartas in scoreDetail (relay string shape)', () => {
    const raw = {
      scoreDetail: {
        ganador: 'PLAYER',
        cartas_player: 'K♠,8♠',
        cartas_banker: 'Q♠,6♠',
      },
    };
    const m = extractMesaInfoFlexible(raw);
    expect(m.cartas_player).toEqual(['K♠', '8♠']);
    expect(m.cartas_banker).toEqual(['Q♠', '6♠']);
  });

  it('NEW_RESULT: scoreDetail solo `tablero` (BFF/WinX; sin cartas_*) → orden P,B,P,B', () => {
    const raw = {
      type: 'NEW_RESULT',
      winStatus: true,
      scoreDetail: {
        ganador: 'PLAYER',
        puntaje_player: '8',
        puntaje_banker: '6',
        tablero: ['10♠', 'K♥', '8♦', '6♣'],
      },
    };
    const m = extractMesaInfoFlexible(raw);
    expect(m.cartas_player).toEqual(['10♠', '8♦']);
    expect(m.cartas_banker).toEqual(['K♥', '6♣']);
  });

  it('NEW_RESULT: `scoreDetail` como string JSON (relay)', () => {
    const inner = {
      ganador: 'PLAYER',
      tablero: ['4♠', '9♥', 'K♦', '2♣'],
    };
    const raw = {
      type: 'NEW_RESULT',
      winStatus: true,
      scoreDetail: JSON.stringify(inner),
    };
    const m = extractMesaInfoFlexible(raw);
    expect(m.cartas_player.length).toBeGreaterThan(0);
    expect(m.cartas_banker.length).toBeGreaterThan(0);
  });

  it('NEW_RESULT: `tablero` como string JSON de array', () => {
    const raw = {
      type: 'NEW_RESULT',
      scoreDetail: {
        ganador: 'BANKER',
        tablero: '["J♠","10♥","7♦","8♣"]',
      },
    };
    const m = extractMesaInfoFlexible(raw);
    expect(m.cartas_player).toEqual(['J♠', '7♦']);
    expect(m.cartas_banker).toEqual(['10♥', '8♣']);
  });

  it('findMesaInfo path: data.results.mesa_info sin data.data (paridad core-api)', () => {
    const raw = {
      data: {
        results: {
          mesa_info: {
            ganador: 'BANKER',
            cartas_player: ['2', '3'],
            cartas_banker: ['A', '4'],
          },
        },
      },
    };
    const m = extractMesaInfoFlexible(raw);
    expect(m.cartas_player).toEqual(['2', '3']);
    expect(m.cartas_banker).toEqual(['A', '4']);
  });

  it('no acorta por nested mesa_info solo-ganador: usa cartas desde martingalaData', () => {
    const raw = {
      type: 'NEW_RESULT',
      data: {
        data: {
          results: {
            mesa_info: {
              ganador: 'PLAYER',
              cartas_player: [],
              cartas_banker: [],
            },
          },
        },
        martingalaData: {
          mesa_info: {
            ganador: 'PLAYER',
            cartas_player: ['Q', '6'],
            cartas_banker: ['9', '8'],
          },
        },
      },
    };
    const m = extractMesaInfoFlexible(raw);
    expect(m.cartas_player).toEqual(['Q', '6']);
    expect(m.cartas_banker).toEqual(['9', '8']);
  });
});

describe('augmentOutcomePayloadFromAdminRaw', () => {
  it('merges admin NEW_RESULT body when history rawResult is BFF-minimal (same correlationKey)', () => {
    const slim = {
      type: 'NEW_RESULT',
      correlationKey: 'ck-abc',
      scoreDetail: { ganador: 'PLAYER' },
      winStatus: true,
    };
    const full = {
      type: 'NEW_RESULT',
      correlationKey: 'ck-abc',
      mesa: 'M1',
      round: '42',
      data: {
        data: {
          results: {
            mesa_info: {
              ganador: 'PLAYER',
              cartas_player: ['K', '8'],
              cartas_banker: ['Q', '6'],
            },
          },
        },
      },
    };
    const row = {
      id: 'r1',
      correlationKey: 'ck-abc',
      rawResult: slim,
    };
    const feed = [{ type: 'NEW_RESULT', raw: full }];
    const merged = augmentOutcomePayloadFromAdminRaw(row, feed);
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_player?.length ?? 0).toBeGreaterThan(0);
    expect(m.cartas_banker?.length ?? 0).toBeGreaterThan(0);
  });

  it('matches by mesa+round with different mesa casing', () => {
    const slim = { type: 'NEW_RESULT', scoreDetail: { ganador: 'PLAYER' } };
    const full = {
      type: 'NEW_RESULT',
      mesa: 'Baccarat 9',
      round: '2',
      scoreDetail: {
        ganador: 'PLAYER',
        cartas_player: ['4', '5'],
        cartas_banker: ['6'],
      },
    };
    const row = { id: 'r-case', mesa: 'baccarat 9', round: '2', rawResult: slim };
    const feed = [{ type: 'NEW_RESULT', raw: full }];
    const merged = augmentOutcomePayloadFromAdminRaw(row, feed);
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_player?.length ?? 0).toBeGreaterThan(0);
  });

  it('matches by providerSignalId when correlationKey differs between row and feed', () => {
    const slim = { type: 'NEW_RESULT', scoreDetail: { ganador: 'PLAYER' } };
    const full = {
      type: 'NEW_RESULT',
      correlationKey: 'feed-only-ck',
      providerSignalId: 'pid-unified',
      mesa: 'M5',
      round: '8',
      scoreDetail: {
        ganador: 'PLAYER',
        cartas_player: ['J'],
        cartas_banker: ['2', '3'],
      },
    };
    const row = {
      id: 'r-pid',
      correlationKey: 'history-ck-other',
      providerSignalId: 'pid-unified',
      mesa: 'M5',
      round: '8',
      rawResult: slim,
    };
    const feed = [{ type: 'NEW_RESULT', raw: full }];
    const merged = augmentOutcomePayloadFromAdminRaw(row, feed);
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_banker?.length ?? 0).toBeGreaterThan(0);
  });

  it('matches by mesa+round when correlationKey missing on row', () => {
    const slim = {
      type: 'NEW_RESULT',
      scoreDetail: { ganador: 'BANKER' },
    };
    const full = {
      type: 'NEW_RESULT',
      mesa: 'T7',
      round: '99',
      scoreDetail: {
        ganador: 'BANKER',
        cartas_player: ['9'],
        cartas_banker: ['10', '7'],
      },
    };
    const row = { id: 'r2', mesa: 'T7', round: '99', rawResult: slim };
    const feed = [{ type: 'NEW_RESULT', raw: full }];
    const merged = augmentOutcomePayloadFromAdminRaw(row, feed);
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_banker?.length ?? 0).toBeGreaterThan(0);
  });

  it('matches when history row has only providerSignalId (no correlationKey) and feed uses providerSignalId', () => {
    const slim = { type: 'NEW_RESULT', scoreDetail: { ganador: 'BANKER' } };
    const full = {
      type: 'NEW_RESULT',
      providerSignalId: 'prov-abc',
      mesa: 'T1',
      round: '5',
      scoreDetail: {
        ganador: 'BANKER',
        cartas_player: ['A'],
        cartas_banker: ['K', '3'],
      },
    };
    const row = {
      id: 'row-z',
      mesa: 'T1',
      round: '5',
      providerSignalId: 'prov-abc',
      rawResult: slim,
    };
    const feed = [{ type: 'NEW_RESULT', raw: full }];
    const merged = augmentOutcomePayloadFromAdminRaw(row, feed);
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_banker?.length ?? 0).toBeGreaterThan(0);
  });

  it('matches by id nested under data when wantCk/providerSignalId align but mesa|round differ (runtime NDJSON)', () => {
    const slim = { type: 'NEW_RESULT', scoreDetail: { ganador: 'PLAYER' } };
    const full = {
      type: 'NEW_RESULT',
      mesa: 'Baccarat 1',
      round: '23',
      data: {
        id: '1776036626015',
        data: {
          results: {
            mesa_info: {
              ganador: 'PLAYER',
              cartas_player: ['2'],
              cartas_banker: ['3', '4'],
            },
          },
        },
      },
    };
    const row = {
      correlationKey: 'id:1776036626015',
      providerSignalId: '1776036626015',
      mesa: 'Baccarat 1',
      round: '21',
      rawResult: slim,
    };
    const feed = [{ type: 'NEW_RESULT', raw: full }];
    const merged = augmentOutcomePayloadFromAdminRaw(row, feed);
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_banker?.length ?? 0).toBeGreaterThan(0);
  });

  it('matches by signal id when wantCk is id:… and feed buildCorrelationKey is mesa|round (NDJSON id:sig-777 vs M2|12)', () => {
    const slim = { type: 'NEW_RESULT', id: 'sig-777', scoreDetail: { ganador: 'PLAYER' } };
    const full = {
      type: 'NEW_RESULT',
      id: 'sig-777',
      mesa: 'M2',
      round: '12',
      data: {
        data: {
          results: {
            mesa_info: {
              ganador: 'PLAYER',
              cartas_player: ['2', '3'],
              cartas_banker: ['4', '5'],
            },
          },
        },
      },
    };
    const row = { id: 'row-x', correlationKey: 'id:sig-777', rawResult: slim };
    const feed = [{ type: 'NEW_RESULT', raw: full }];
    const merged = augmentOutcomePayloadFromAdminRaw(row, feed);
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_player?.length ?? 0).toBeGreaterThan(0);
  });

  it('unwraps signal_stream_frame shape (layers.raw) in admin feed', () => {
    const slim = { type: 'NEW_RESULT', scoreDetail: { ganador: 'PLAYER' } };
    const inner = {
      type: 'NEW_RESULT',
      scoreDetail: {
        ganador: 'PLAYER',
        cartas_player: ['5', '5'],
        cartas_banker: ['9', 'K'],
      },
    };
    const row = { rawResult: slim };
    const feed = [{ type: 'NEW_RESULT', raw: { v: 1, eventName: 'NEW_RESULT', layers: { raw: inner } } }];
    const merged = augmentOutcomePayloadFromAdminRaw(row, feed);
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_player?.length ?? 0).toBeGreaterThan(0);
  });

  it('unwraps admin feed when layers.raw is a JSON string (relay string serialization)', () => {
    const slim = { type: 'NEW_RESULT', scoreDetail: { ganador: 'PLAYER' } };
    const inner = {
      type: 'NEW_RESULT',
      data: {
        data: {
          results: {
            mesa_info: {
              ganador: 'PLAYER',
              cartas_player: ['Q', '2'],
              cartas_banker: ['3', '4'],
            },
          },
        },
      },
    };
    const row = { id: 'row-str-layers', rawResult: slim };
    const feed = [
      {
        type: 'NEW_RESULT',
        raw: { eventName: 'NEW_RESULT', layers: { raw: JSON.stringify(inner) } },
      },
    ];
    const merged = augmentOutcomePayloadFromAdminRaw(row, feed);
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_player?.length ?? 0).toBeGreaterThan(0);
    expect(m.cartas_banker?.length ?? 0).toBeGreaterThan(0);
  });

  it('unwraps admin feed _primitive JSON string', () => {
    const slim = { type: 'NEW_RESULT', scoreDetail: { ganador: 'BANKER' } };
    const inner = {
      type: 'NEW_RESULT',
      mesa: 'T9',
      round: '1',
      scoreDetail: {
        ganador: 'BANKER',
        cartas_player: ['K'],
        cartas_banker: ['8', '9'],
      },
    };
    const row = { mesa: 'T9', round: '1', rawResult: slim };
    const feed = [{ type: 'NEW_RESULT', raw: { _primitive: JSON.stringify(inner) } }];
    const merged = augmentOutcomePayloadFromAdminRaw(row, feed);
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_banker?.length ?? 0).toBeGreaterThan(0);
  });

  it('unwraps _primitive that nests layers.raw JSON string (double-wrap in admin buffer)', () => {
    const slim = { type: 'NEW_RESULT', scoreDetail: { ganador: 'PLAYER' } };
    const inner = {
      type: 'NEW_RESULT',
      data: {
        data: {
          results: {
            mesa_info: {
              ganador: 'PLAYER',
              cartas_player: ['8', '9'],
              cartas_banker: ['10', 'J'],
            },
          },
        },
      },
    };
    const wrapped = { layers: { raw: JSON.stringify(inner) } };
    const row = { rawResult: slim };
    const feed = [{ type: 'NEW_RESULT', raw: { _primitive: JSON.stringify(wrapped) } }];
    const merged = augmentOutcomePayloadFromAdminRaw(row, feed);
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_player?.length ?? 0).toBeGreaterThan(0);
    expect(m.cartas_banker?.length ?? 0).toBeGreaterThan(0);
  });

  it('matches by buildCorrelationKey when NEW_RESULT raw has no correlationKey but has id (same as store)', () => {
    const slim = { type: 'NEW_RESULT', scoreDetail: { ganador: 'PLAYER' } };
    const full = {
      type: 'NEW_RESULT',
      id: 'sig-777',
      mesa: 'M2',
      round: '12',
      data: {
        data: {
          results: {
            mesa_info: {
              ganador: 'PLAYER',
              cartas_player: ['5', '6'],
              cartas_banker: ['J', '4'],
            },
          },
        },
      },
    };
    const row = {
      id: 'hist-1',
      correlationKey: 'id:sig-777',
      rawResult: slim,
    };
    const feed = [{ type: 'NEW_RESULT', raw: full }];
    const merged = augmentOutcomePayloadFromAdminRaw(row, feed);
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_player?.length ?? 0).toBeGreaterThan(0);
  });

  it('matches when admin raw is BFF-wrapped (few top-level keys; ids under data)', () => {
    const slim = {
      type: 'NEW_RESULT',
      correlationKey: 'bff-ck',
      scoreDetail: { ganador: 'PLAYER' },
    };
    const wrapped = {
      type: 'NEW_RESULT',
      data: {
        correlationKey: 'bff-ck',
        mesa: 'M9',
        round: '3',
        data: {
          data: {
            results: {
              mesa_info: {
                ganador: 'PLAYER',
                cartas_player: ['2', '3'],
                cartas_banker: ['4', '5'],
              },
            },
          },
        },
      },
    };
    const row = { id: 'r-bff', correlationKey: 'bff-ck', mesa: 'M9', round: '3', rawResult: slim };
    const feed = [{ type: 'NEW_RESULT', raw: wrapped }];
    const merged = augmentOutcomePayloadFromAdminRaw(row, feed);
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_player?.length ?? 0).toBeGreaterThan(0);
    expect(m.cartas_banker?.length ?? 0).toBeGreaterThan(0);
  });

  it('singleton feed when keys are trivial "|" and row has no mesa/round/pid (NDJSON H-augment-miss class)', () => {
    const slim = { type: 'NEW_RESULT', scoreDetail: { ganador: 'PLAYER' } };
    const full = {
      type: 'NEW_RESULT',
      data: {
        data: {
          results: {
            mesa_info: {
              ganador: 'PLAYER',
              cartas_player: ['A', '2'],
              cartas_banker: ['K', '7'],
            },
          },
        },
      },
    };
    const row = { id: 'singleton-row', rawResult: slim };
    const feed = [{ type: 'NEW_RESULT', raw: full }];
    const merged = augmentOutcomePayloadFromAdminRaw(row, feed);
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_player?.length ?? 0).toBeGreaterThan(0);
    expect(m.cartas_banker?.length ?? 0).toBeGreaterThan(0);
  });

  it('singleton when store correlationKey is mesa| with empty round (relay NDJSON e.g. Baccarat 9|) and feed ck is "|"', () => {
    const slim = { type: 'NEW_RESULT', scoreDetail: { ganador: 'PLAYER' } };
    const full = {
      type: 'NEW_RESULT',
      data: {
        data: {
          results: {
            mesa_info: {
              ganador: 'PLAYER',
              cartas_player: ['4', '5'],
              cartas_banker: ['6', '7'],
            },
          },
        },
      },
    };
    const row = {
      id: 'row-b9',
      correlationKey: 'Baccarat 9|',
      rawResult: slim,
    };
    const feed = [{ type: 'NEW_RESULT', raw: full }];
    const merged = augmentOutcomePayloadFromAdminRaw(row, feed);
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_player?.length ?? 0).toBeGreaterThan(0);
    expect(m.cartas_banker?.length ?? 0).toBeGreaterThan(0);
  });

  it('returns slim payload when feed has no matching NEW_RESULT', () => {
    const slim = { type: 'NEW_RESULT', correlationKey: 'x', scoreDetail: { ganador: 'PLAYER' } };
    const row = { rawResult: slim };
    const merged = augmentOutcomePayloadFromAdminRaw(row, [
      { type: 'NEW_RESULT', raw: { type: 'NEW_RESULT', correlationKey: 'other' } },
    ]);
    expect(merged).toEqual(slim);
  });

  it('uses activeRow.rawResult when rawSignal has vectors but no mesa_info (NDJSON slotsFromFallback 0)', () => {
    const slim = { type: 'NEW_RESULT', scoreDetail: { ganador: 'PLAYER' } };
    const full = {
      type: 'NEW_RESULT',
      data: {
        data: {
          results: {
            mesa_info: {
              ganador: 'PLAYER',
              cartas_player: ['9'],
              cartas_banker: ['10', 'J'],
            },
          },
        },
      },
    };
    const outcome = { id: 'o', rawResult: slim };
    const active = {
      id: 'a',
      rawResult: full,
      rawSignal: { vector_forecast: ['P', 'B'], contador_martingala: 1 },
    };
    const merged = augmentOutcomePayloadFromAdminRaw(
      outcome,
      [{ type: 'NEW_RESULT', raw: { type: 'NEW_RESULT', winStatus: true, scoreDetail: { ganador: 'PLAYER' } } }],
      active,
    );
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_banker?.length ?? 0).toBeGreaterThan(0);
  });

  it('merges signalFallbackRow.rawSignal when outcome row has no rawSignal (active row fallback)', () => {
    const slim = { type: 'NEW_RESULT', scoreDetail: { ganador: 'PLAYER' } };
    const outcomeOnly = { id: 'hist-only', rawResult: slim };
    const active = {
      id: 'live',
      rawResult: slim,
      rawSignal: {
        data: {
          data: {
            results: {
              mesa_info: {
                ganador: 'PLAYER',
                cartas_player: ['10'],
                cartas_banker: ['J', 'Q'],
              },
            },
          },
        },
      },
    };
    const merged = augmentOutcomePayloadFromAdminRaw(
      outcomeOnly,
      [{ type: 'NEW_RESULT', raw: { type: 'NEW_RESULT', winStatus: true, scoreDetail: { ganador: 'PLAYER' } } }],
      active,
    );
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_banker?.length ?? 0).toBeGreaterThan(0);
  });

  it('uses fallback correlationKey + rowHints when outcome has no correlationKey (feed byCk)', () => {
    const slim = { type: 'NEW_RESULT', scoreDetail: { ganador: 'PLAYER' } };
    const full = {
      type: 'NEW_RESULT',
      correlationKey: 'bff-ck-match',
      mesa: 'M1',
      round: '2',
      data: {
        data: {
          results: {
            mesa_info: {
              ganador: 'PLAYER',
              cartas_player: ['A'],
              cartas_banker: ['K', 'Q'],
            },
          },
        },
      },
    };
    const minimalOutcome = { id: 'x1', rawResult: slim };
    const fallback = { id: 'x1', correlationKey: 'bff-ck-match', mesa: 'M1', round: '2' };
    const merged = augmentOutcomePayloadFromAdminRaw(
      minimalOutcome,
      [{ type: 'NEW_RESULT', raw: full }],
      fallback,
    );
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_player?.length ?? 0).toBeGreaterThan(0);
  });

  it('resolves base from signalFallbackRow when outcomeRow has no rawResult (BFF-minimal)', () => {
    const full = {
      type: 'NEW_RESULT',
      data: {
        data: {
          results: {
            mesa_info: {
              ganador: 'PLAYER',
              cartas_player: ['2'],
              cartas_banker: ['3', '4'],
            },
          },
        },
      },
    };
    const minimalOutcome = { id: 'sig-1775968136050-2osufu8i', correlationKey: 'Baccarat 9|', winStatus: true };
    const storeRow = { id: 'sig-1775968136050-2osufu8i', rawResult: full };
    const merged = augmentOutcomePayloadFromAdminRaw(minimalOutcome, [], storeRow);
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_banker?.length ?? 0).toBeGreaterThan(0);
  });

  it('matches feed entry by id substring in raw JSON when first entry is other mesa (NDJSON Baccarat 9 vs firstFeed Baccarat 2)', () => {
    const slim = {
      type: 'NEW_RESULT',
      mesa: 'Baccarat 9',
      round: '37',
      scoreDetail: { ganador: 'PLAYER' },
    };
    const nestedBody = {
      type: 'NEW_RESULT',
      id: '1776040338905',
      mesa: 'Baccarat 9',
      round: '37',
      data: {
        data: {
          results: {
            mesa_info: {
              ganador: 'PLAYER',
              cartas_player: ['2'],
              cartas_banker: ['3', '4'],
            },
          },
        },
      },
    };
    const row = {
      id: '1776040338905',
      providerSignalId: '1776040338905',
      rawResult: slim,
    };
    const feedWrong = {
      type: 'NEW_RESULT',
      raw: { mesa: 'Baccarat 2', round: '41', correlationKey: 'Baccarat 2|41' },
    };
    const feedRight = {
      type: 'NEW_RESULT',
      raw: { eventName: 'dashboardUpdate', layers: { raw: JSON.stringify(nestedBody) } },
    };
    const merged = augmentOutcomePayloadFromAdminRaw(row, [feedWrong, feedRight]);
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_banker?.length ?? 0).toBeGreaterThan(0);
  });

  it('accepts admin feed when raw is top-level JSON string (same as object drift case)', () => {
    const slim = {
      type: 'NEW_RESULT',
      mesa: 'Baccarat 1',
      round: '53',
      scoreDetail: { ganador: 'PLAYER' },
    };
    const full = {
      type: 'NEW_RESULT',
      mesa: 'Baccarat 1',
      round: '55',
      data: {
        data: {
          results: {
            mesa_info: {
              ganador: 'PLAYER',
              cartas_player: ['9'],
              cartas_banker: ['8', '7'],
            },
          },
        },
      },
    };
    const row = { rawResult: slim };
    const merged = augmentOutcomePayloadFromAdminRaw(row, [{ type: 'NEW_RESULT', raw: JSON.stringify(full) }]);
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_banker?.length ?? 0).toBeGreaterThan(0);
  });

  it('unwraps admin feed when raw.signal is JSON string (BFF frame; NDJSON wantCk "|")', () => {
    const slim = { type: 'NEW_RESULT', scoreDetail: { ganador: 'PLAYER' } };
    const inner = {
      type: 'NEW_RESULT',
      data: {
        data: {
          results: {
            mesa_info: {
              ganador: 'PLAYER',
              cartas_player: ['2'],
              cartas_banker: ['3', '4'],
            },
          },
        },
      },
    };
    const row = { rawResult: slim };
    const feed = [
      { type: 'NEW_RESULT', raw: { eventName: 'dashboardUpdate', origin: 'provider', signal: JSON.stringify(inner) } },
    ];
    const merged = augmentOutcomePayloadFromAdminRaw(row, feed);
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_banker?.length ?? 0).toBeGreaterThan(0);
  });

  it('matches NEW_RESULT when mesa aligns and round drifts (NDJSON wantRound 53 vs feed Baccarat 1|55)', () => {
    const slim = {
      type: 'NEW_RESULT',
      mesa: 'Baccarat 1',
      round: '53',
      scoreDetail: { ganador: 'PLAYER' },
    };
    const full = {
      type: 'NEW_RESULT',
      mesa: 'Baccarat 1',
      round: '55',
      data: {
        data: {
          results: {
            mesa_info: {
              ganador: 'PLAYER',
              cartas_player: ['9'],
              cartas_banker: ['8', '7'],
            },
          },
        },
      },
    };
    const row = { rawResult: slim };
    const merged = augmentOutcomePayloadFromAdminRaw(row, [{ type: 'NEW_RESULT', raw: full }]);
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_banker?.length ?? 0).toBeGreaterThan(0);
  });

  it('uses row.rawSignal when admin feed is empty', () => {
    const slim = { type: 'NEW_RESULT', scoreDetail: { ganador: 'PLAYER' } };
    const rawSignal = {
      data: {
        data: {
          results: {
            mesa_info: {
              ganador: 'BANKER',
              cartas_player: ['2'],
              cartas_banker: ['3', '4'],
            },
          },
        },
      },
    };
    const row = { id: 'r-rs', rawResult: slim, rawSignal };
    const merged = augmentOutcomePayloadFromAdminRaw(row, []);
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_banker?.length ?? 0).toBeGreaterThan(0);
  });

  it('singleton scans all NEW_RESULT buffer entries when first is minimal and later has mesa_info', () => {
    const slim = { type: 'NEW_RESULT', scoreDetail: { ganador: 'PLAYER' } };
    const minimal = { type: 'NEW_RESULT', winStatus: true, scoreDetail: { ganador: 'PLAYER' } };
    const full = {
      type: 'NEW_RESULT',
      data: {
        data: {
          results: {
            mesa_info: {
              ganador: 'PLAYER',
              cartas_player: ['A'],
              cartas_banker: ['K', 'Q'],
            },
          },
        },
      },
    };
    const row = { rawResult: slim };
    const feed = [
      { type: 'NEW_RESULT', raw: minimal },
      { type: 'NEW_RESULT', raw: full },
    ];
    const merged = augmentOutcomePayloadFromAdminRaw(row, feed);
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_player?.length ?? 0).toBeGreaterThan(0);
  });
});

describe('mergeSettledResultPayloadPreferringCards', () => {
  it('no deja que el cierre final (scoreDetail sin cartas) borre el merge LOSS previo', () => {
    const prev = mergeResultEnvelopeForExtract({
      type: 'NEW_RESULT',
      scoreDetail: {
        ganador: 'PLAYER',
        cartas_player: ['4', '5'],
        cartas_banker: ['6', '7'],
      },
    });
    const fresh = mergeResultEnvelopeForExtract({
      type: 'NEW_RESULT',
      winStatus: true,
      scoreDetail: { ganador: 'PLAYER' },
    });
    const merged = mergeSettledResultPayloadPreferringCards(prev, fresh);
    const m = extractMesaInfoFlexible(merged);
    expect(m.cartas_player?.length ?? 0).toBeGreaterThan(0);
    expect(m.cartas_banker?.length ?? 0).toBeGreaterThan(0);
  });
});

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

describe('liveScoresFromOutcomeRow (Live Control)', () => {
  it('reads puntajes from object rawResult (scoreDetail)', () => {
    const row = {
      id: 't1',
      rawResult: {
        scoreDetail: { puntaje_player: '6', puntaje_banker: '0' },
      },
    };
    const s = liveScoresFromOutcomeRow(row);
    expect(s.player).toBe(6);
    expect(s.banker).toBe(0);
  });

  it('unwraps JSON string rawResult to puntajes', () => {
    const inner = JSON.stringify({
      scoreDetail: { puntaje_player: '7', puntaje_banker: '8' },
    });
    const row = { id: 't2', rawResult: inner };
    const s = liveScoresFromOutcomeRow(row);
    expect(s.player).toBe(7);
    expect(s.banker).toBe(8);
  });

  it('returns nulls when raw is empty (fallback path uses 0/0 in App)', () => {
    const row = { id: 't3', rawResult: null };
    const s = liveScoresFromOutcomeRow(row);
    expect(s.player).toBeNull();
    expect(s.banker).toBeNull();
  });

  it('reads puntajes from nested relay envelope (data.data.results.mesa_info)', () => {
    const row = {
      id: 't-nested',
      rawResult: {
        type: 'NEW_RESULT',
        data: {
          data: {
            results: {
              mesa_info: {
                puntaje_player: '5',
                puntaje_banker: '4',
              },
            },
          },
        },
      },
    };
    const s = liveScoresFromOutcomeRow(row);
    expect(s.player).toBe(5);
    expect(s.banker).toBe(4);
  });
});
