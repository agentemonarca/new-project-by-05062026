import { describe, expect, it } from 'vitest';
import {
  buildNewResultBaseFingerprint,
  buildNewResultFingerprint,
  resolveResultTemporalId,
} from './newResultFingerprint.js';

describe('buildNewResultBaseFingerprint', () => {
  it('builds correlationKey-contador-vector_win_last (no temporal)', () => {
    const fp = buildNewResultBaseFingerprint({
      correlationKey: 'mesa:M|round:9',
      contador_martingala: 2,
      vector_win: ['L', 'W'],
      serverTs: 1700000000123,
    });
    expect(fp).toBe('mesa:M|round:9-2-W');
  });

  it('is identical when only serverTs differs', () => {
    const base = {
      correlationKey: 'mesa:X|round:1',
      contador_martingala: 2,
      vector_win: ['W'],
    };
    expect(buildNewResultBaseFingerprint({ ...base, serverTs: 100 })).toBe(
      buildNewResultBaseFingerprint({ ...base, serverTs: 101 }),
    );
  });

  it('uses fallbackContador when contador is absent', () => {
    const fp = buildNewResultBaseFingerprint({ correlationKey: 'k', vector_win: ['L'] }, { fallbackContador: 3 });
    expect(fp).toBe('k-3-L');
  });

  it('uses ganador when vector_win is missing', () => {
    expect(
      buildNewResultBaseFingerprint({
        correlationKey: 'mesa:A|round:1',
        contador_martingala: 1,
        ganador: 'B',
      }),
    ).toBe('mesa:A|round:1-1-B');
  });

  it('uses NA when vector_win and ganador are absent', () => {
    expect(
      buildNewResultBaseFingerprint({
        correlationKey: 'mesa:A|round:1',
        contador_martingala: 1,
      }),
    ).toBe('mesa:A|round:1-1-NA');
  });

  it('does not collide when only ganador differs and vector_win is missing', () => {
    const base = { correlationKey: 'k', contador_martingala: 2 };
    expect(buildNewResultBaseFingerprint({ ...base, ganador: 'P' })).not.toBe(
      buildNewResultBaseFingerprint({ ...base, ganador: 'B' }),
    );
  });
});

describe('resolveResultTemporalId', () => {
  it('prefers serverTs then createdAt then id', () => {
    expect(resolveResultTemporalId({ serverTs: 1 })).toBe('1');
    expect(resolveResultTemporalId({ createdAt: 99 })).toBe('99');
    expect(resolveResultTemporalId({ id: 'evt-42' })).toBe('evt-42');
    expect(resolveResultTemporalId({ serverTs: 1, createdAt: 99, id: 'x' })).toBe('1');
  });
});

describe('buildNewResultFingerprint', () => {
  it('full audit string = base + temporal segment', () => {
    const fp = buildNewResultFingerprint({
      correlationKey: 'mesa:M|round:9',
      contador_martingala: 2,
      vector_win: ['L', 'W'],
      serverTs: 1700000000123,
    });
    expect(fp).toBe('mesa:M|round:9-2-W-1700000000123');
  });

  it('uses fallbackContador when contador is absent', () => {
    const fp = buildNewResultFingerprint({ correlationKey: 'k', vector_win: ['L'], serverTs: 1 }, { fallbackContador: 3 });
    expect(fp).toBe('k-3-L-1');
  });

  it('prefers serverTs then createdAt then id then ts in full string', () => {
    expect(
      buildNewResultFingerprint({
        correlationKey: 'c',
        contador_martingala: 1,
        vector_win: ['L'],
        createdAt: 99,
      }),
    ).toBe('c-1-L-99');

    expect(
      buildNewResultFingerprint({
        correlationKey: 'c',
        contador_martingala: 1,
        vector_win: ['L'],
        id: 'evt-42',
      }),
    ).toBe('c-1-L-evt-42');

    expect(
      buildNewResultFingerprint({
        correlationKey: 'c',
        contador_martingala: 1,
        vector_win: ['L'],
        ts: 55,
      }),
    ).toBe('c-1-L-55');
  });

  it('full fingerprint differs when temporal differs; base stays equal', () => {
    const base = {
      correlationKey: 'mesa:X|round:1',
      contador_martingala: 2,
      vector_win: ['W'],
    };
    expect(buildNewResultFingerprint({ ...base, serverTs: 100 })).not.toBe(
      buildNewResultFingerprint({ ...base, serverTs: 101 }),
    );
  });
});
