import { describe, expect, it } from 'vitest';
import {
  findSignalRowMatchingPeel,
  oracleResultMatchesActiveCycle,
  peelIdsFromRow,
  pickPendingForResult,
  resolveAugmentSourceRow,
} from './signalRowCorrelation.js';

describe('pickPendingForResult', () => {
  it('matches by correlationKey first', () => {
    const pending = [
      { id: 'a', correlationKey: 'k1', providerSignalId: null, mesa: 'M1', round: '1' },
      { id: 'b', correlationKey: 'k2', providerSignalId: null, mesa: 'M1', round: '2' },
    ];
    const pick = { correlationKey: 'k2', providerSignalId: null, mesa: '', round: '' };
    expect(pickPendingForResult(pending, pick)).toBe(pending[1]);
  });

  it('matches by providerSignalId when correlation misses', () => {
    const pending = [
      { id: 'a', correlationKey: 'x', providerSignalId: 'p99', mesa: 'M1', round: '1' },
    ];
    const pick = { correlationKey: '', providerSignalId: 'p99', mesa: '', round: '' };
    expect(pickPendingForResult(pending, pick)).toBe(pending[0]);
  });

  it('matches mesa+round scanning from end', () => {
    const pending = [
      { id: 'a', correlationKey: 'ka', providerSignalId: null, mesa: 'M1', round: '1' },
      { id: 'b', correlationKey: 'kb', providerSignalId: null, mesa: 'M1', round: '2' },
    ];
    const pick = { correlationKey: 'nomatch', providerSignalId: null, mesa: 'M1', round: '2' };
    expect(pickPendingForResult(pending, pick)).toBe(pending[1]);
  });

  it('falls back to last pending when mesa matches but round empty', () => {
    const pending = [
      { id: 'a', correlationKey: 'ka', providerSignalId: null, mesa: 'M1', round: '1' },
      { id: 'b', correlationKey: 'kb', providerSignalId: null, mesa: 'M1', round: '2' },
    ];
    const pick = { correlationKey: 'nomatch', providerSignalId: null, mesa: 'M1', round: '' };
    expect(pickPendingForResult(pending, pick)).toBe(pending[1]);
  });

  it('falls back to last pending element when no mesa/round', () => {
    const pending = [{ id: 'x', correlationKey: 'kx', mesa: '', round: '' }];
    const pick = { correlationKey: 'nomatch', providerSignalId: null, mesa: '', round: '' };
    expect(pickPendingForResult(pending, pick)).toBe(pending[0]);
  });
});

describe('peelIdsFromRow', () => {
  it('reads top-level ids', () => {
    expect(peelIdsFromRow({ id: '1', correlationKey: 'ck', providerSignalId: 'pid' })).toEqual({
      oid: '1',
      ock: 'ck',
      opid: 'pid',
    });
  });

  it('fills from rawResult when missing on row', () => {
    expect(
      peelIdsFromRow({
        rawResult: { id: 'rid', correlationKey: 'rck', providerSignalId: 'rpid' },
      }),
    ).toEqual({ oid: 'rid', ock: 'rck', opid: 'rpid' });
  });
});

describe('findSignalRowMatchingPeel', () => {
  const hist = [{ id: 'h1', correlationKey: 'c1' }];
  const act = [{ id: 'a1', providerSignalId: 'p1' }];
  it('finds in history first', () => {
    expect(findSignalRowMatchingPeel({ oid: 'h1', ock: '', opid: '' }, hist, act)).toBe(hist[0]);
  });
  it('finds in activeSignals', () => {
    expect(findSignalRowMatchingPeel({ oid: '', ock: '', opid: 'p1' }, [], act)).toBe(act[0]);
  });
});

describe('oracleResultMatchesActiveCycle', () => {
  const open = { status: null, mesa: 'M', round: '1', correlationKey: 'ck' };

  it('returns false when cycle closed', () => {
    expect(oracleResultMatchesActiveCycle({ ...open, status: 'WIN' }, { correlationKey: 'ck' })).toBe(false);
  });

  it('returns false on correlation conflict', () => {
    expect(
      oracleResultMatchesActiveCycle(open, { correlationKey: 'other', mesa: 'M', round: '1' }),
    ).toBe(false);
  });

  it('returns true on correlation match', () => {
    expect(oracleResultMatchesActiveCycle(open, { correlationKey: 'ck', mesa: 'M', round: '1' })).toBe(true);
  });

  it('returns true on permissive fallback when keys absent', () => {
    expect(oracleResultMatchesActiveCycle({ status: null, mesa: 'M' }, { mesa: 'M', round: '' })).toBe(true);
  });
});

describe('resolveAugmentSourceRow', () => {
  it('returns null when relay shell off', () => {
    expect(
      resolveAugmentSourceRow({
        isRelayShell: false,
        simReplay: false,
        simReplayIndex: 0,
        extHistory: [],
        extActiveSignals: [],
        relayEngine: {},
        lastProviderSignalId: null,
      }),
    ).toBe(null);
  });

  it('sim replay uses history index', () => {
    const h = [{ id: 'a' }, { id: 'b' }];
    expect(
      resolveAugmentSourceRow({
        isRelayShell: true,
        simReplay: true,
        simReplayIndex: 1,
        extHistory: h,
        extActiveSignals: [],
        relayEngine: { status: 'IDLE', activeRow: null, outcomeRow: null },
        lastProviderSignalId: null,
      }),
    ).toBe(h[1]);
  });

  it('result phase prefers store row aligned with outcome ids', () => {
    const aligned = { id: 'row1', correlationKey: 'ck1', rawSignal: {} };
    const hist = [aligned];
    expect(
      resolveAugmentSourceRow({
        isRelayShell: true,
        simReplay: false,
        simReplayIndex: 0,
        extHistory: hist,
        extActiveSignals: [],
        relayEngine: {
          status: 'RESULT',
          activeRow: { id: 'stale' },
          outcomeRow: { id: 'row1', correlationKey: 'ck1' },
        },
        lastProviderSignalId: null,
      }),
    ).toBe(aligned);
  });

  it('uses activeRow when no outcome alignment', () => {
    const ar = { id: 'only', martingale: 2 };
    expect(
      resolveAugmentSourceRow({
        isRelayShell: true,
        simReplay: false,
        simReplayIndex: 0,
        extHistory: [],
        extActiveSignals: [],
        relayEngine: { status: 'WAITING_RESULT', activeRow: ar, outcomeRow: null },
        lastProviderSignalId: null,
      }),
    ).toBe(ar);
  });
});
