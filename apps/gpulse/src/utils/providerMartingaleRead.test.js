import { describe, expect, it } from 'vitest';
import { shouldMergeInterimLossIntoPendingRow } from './providerMartingaleRead.js';

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

describe('shouldMergeInterimLossIntoPendingRow', () => {
  it('returns true when vector_resultado length increases', () => {
    const target = { martingale: 1, rawResult: resultBody(['P']) };
    const payload = resultBody(['P', 'B']);
    expect(shouldMergeInterimLossIntoPendingRow(payload, target, false)).toBe(true);
  });

  it('returns true when same length but resultado cells changed (replaced ladder)', () => {
    const target = { martingale: 2, rawResult: resultBody(['P', 'B']) };
    const payload = resultBody(['P', 'P']);
    expect(shouldMergeInterimLossIntoPendingRow(payload, target, false)).toBe(true);
  });

  it('returns false when identical snapshot (duplicate delivery)', () => {
    const snap = resultBody(['P', 'B']);
    const target = { martingale: 2, rawResult: snap };
    expect(shouldMergeInterimLossIntoPendingRow(snap, target, false)).toBe(false);
  });

  it('merges when relay winStatus is true but martingale ladder still progressed', () => {
    const target = { martingale: 2, rawResult: resultBody(['P', 'B']) };
    const payload = { winStatus: true, ...resultBody(['P', 'P']) };
    expect(shouldMergeInterimLossIntoPendingRow(payload, target, true)).toBe(true);
  });
});
