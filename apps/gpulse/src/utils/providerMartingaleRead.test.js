import { describe, expect, it } from 'vitest';
import {
  coalesceSocketEventPayload,
  mergeCoalescedPayloadWithEnvelopeExtract,
  mergeResultEnvelopeForExtract,
  isInterimMartingaleStep,
  shouldMergeInterimLossIntoPendingRow,
} from './providerMartingaleRead.js';

function resultBody(vectorResultado) {
  return {
    mesa_info: {
      martingala: {
        vector_resultado: vectorResultado,
        vector_win: vectorResultado.map(() => false),
        contador_martingala: 1,
      },
    },
  };
}

describe('coalesceSocketEventPayload', () => {
  it('unwraps single-element object array (socket.io)', () => {
    const inner = { a: 1 };
    expect(coalesceSocketEventPayload([inner])).toBe(inner);
    expect(coalesceSocketEventPayload(inner)).toBe(inner);
  });
});

describe('mergeResultEnvelopeForExtract', () => {
  it('parses JSON string `data` and exposes fields at top level', () => {
    const inner = { scoreDetail: { cartas_player: ['A'], cartas_banker: ['K'] } };
    const flat = mergeResultEnvelopeForExtract({
      type: 'NEW_RESULT',
      data: JSON.stringify(inner),
    });
    expect(flat.scoreDetail).toEqual(inner.scoreDetail);
    expect(typeof flat.data).toBe('object');
  });

  it('unwraps multiple nested JSON string `data` layers', () => {
    const leaf = { scoreDetail: { cartas_player: ['2'], cartas_banker: ['3'] } };
    const mid = { data: JSON.stringify(leaf) };
    const flat = mergeResultEnvelopeForExtract({
      type: 'NEW_RESULT',
      data: JSON.stringify(mid),
    });
    expect(flat.scoreDetail).toEqual(leaf.scoreDetail);
  });

  it('accepts payload wrapped in single-element array', () => {
    const inner = { scoreDetail: { cartas_player: ['A'] } };
    const flat = mergeResultEnvelopeForExtract([{ type: 'NEW_RESULT', data: JSON.stringify(inner) }]);
    expect(flat.scoreDetail).toEqual(inner.scoreDetail);
  });

  it('unwraps JSON string on `payload` when `data` is absent', () => {
    const inner = { scoreDetail: { cartas_player: ['J'], cartas_banker: ['5'] } };
    const flat = mergeResultEnvelopeForExtract({
      type: 'NEW_RESULT',
      payload: JSON.stringify(inner),
    });
    expect(flat.scoreDetail).toEqual(inner.scoreDetail);
  });

  it('prefers richer scoreDetail when outer is ganador-only and inner `data` has cartas', () => {
    const rich = {
      ganador: 'PLAYER',
      cartas_player: ['4', 'K'],
      cartas_banker: ['9', '8'],
    };
    const flat = mergeResultEnvelopeForExtract({
      type: 'NEW_RESULT',
      winStatus: true,
      scoreDetail: { ganador: 'PLAYER' },
      data: JSON.stringify({ scoreDetail: rich }),
    });
    expect(flat.scoreDetail?.cartas_player?.length ?? 0).toBeGreaterThan(0);
    expect(flat.scoreDetail?.cartas_banker?.length ?? 0).toBeGreaterThan(0);
  });

  it('merges `providerPayload` (BFF relay) when top envelope is slim', () => {
    const flat = mergeResultEnvelopeForExtract({
      type: 'NEW_RESULT',
      winStatus: true,
      scoreDetail: { ganador: 'PLAYER' },
      providerPayload: {
        scoreDetail: {
          ganador: 'PLAYER',
          cartas_player: ['10', 'J'],
          cartas_banker: ['3', '4', '5'],
        },
      },
    });
    expect(flat.scoreDetail?.cartas_player?.length ?? 0).toBeGreaterThan(0);
    expect(flat.scoreDetail?.cartas_banker?.length ?? 0).toBeGreaterThan(0);
  });

  it('parses `providerPayload` string JSON', () => {
    const inner = {
      scoreDetail: { cartas_player: ['A'], cartas_banker: ['K', '2'], ganador: 'BANKER' },
    };
    const flat = mergeResultEnvelopeForExtract({
      type: 'NEW_RESULT',
      scoreDetail: { ganador: 'BANKER' },
      providerPayload: JSON.stringify(inner),
    });
    expect(flat.scoreDetail?.cartas_player?.length ?? 0).toBeGreaterThan(0);
  });
});

describe('mergeCoalescedPayloadWithEnvelopeExtract', () => {
  it('preserves base-only keys alongside merged envelope (store union)', () => {
    const m = mergeCoalescedPayloadWithEnvelopeExtract({
      type: 'NEW_RESULT',
      winStatus: true,
      scoreDetail: { ganador: 'PLAYER' },
      extraRelayOnly: { foo: 1 },
      providerPayload: {
        scoreDetail: {
          ganador: 'PLAYER',
          cartas_player: ['4', '5'],
          cartas_banker: ['6', '7'],
        },
      },
    });
    expect(m.extraRelayOnly).toEqual({ foo: 1 });
    expect(m.scoreDetail?.cartas_player?.length ?? 0).toBeGreaterThan(0);
  });
});

describe('shouldMergeInterimLossIntoPendingRow', () => {
  it('always false (FASE 4: store historiza cada paso; no merge oculto)', () => {
    const target = { martingale: 1, rawResult: resultBody(['P']) };
    const payload = resultBody(['P', 'B']);
    expect(shouldMergeInterimLossIntoPendingRow(payload, target, false)).toBe(false);
  });
});

describe('isInterimMartingaleStep', () => {
  it('returns true when vector_resultado length increases', () => {
    const target = { martingale: 1, rawResult: resultBody(['P']) };
    const payload = resultBody(['P', 'B']);
    expect(isInterimMartingaleStep(payload, target, false)).toBe(true);
  });

  it('returns true when same length but resultado cells changed (replaced ladder)', () => {
    const target = { martingale: 2, rawResult: resultBody(['P', 'B']) };
    const payload = resultBody(['P', 'P']);
    expect(isInterimMartingaleStep(payload, target, false)).toBe(true);
  });

  it('returns false when identical snapshot (duplicate delivery)', () => {
    const snap = resultBody(['P', 'B']);
    const target = { martingale: 2, rawResult: snap };
    expect(isInterimMartingaleStep(snap, target, false)).toBe(false);
  });

  it('returns true when relay winStatus is true but martingale ladder still progressed', () => {
    const target = { martingale: 2, rawResult: resultBody(['P', 'B']) };
    const payload = { winStatus: true, ...resultBody(['P', 'P']) };
    expect(isInterimMartingaleStep(payload, target, true)).toBe(true);
  });
});
