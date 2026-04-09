import { describe, expect, it, vi } from 'vitest';

describe('correlationKeyStats', () => {
  it('clasifica id vs round vs other y expone snapshot', async () => {
    vi.resetModules();
    const {
      recordCorrelationKeyObservation,
      getCorrelationKeyStatsSnapshot,
    } = await import('./correlationKeyStats.js');

    recordCorrelationKeyObservation('signal', { correlationKey: 'id:abc', round: null }, { source: 't1' });
    recordCorrelationKeyObservation('signal', { correlationKey: 'Baccarat 1|51', round: 51 }, { source: 't1' });
    recordCorrelationKeyObservation('result', { correlationKey: 'id:x' }, { source: 't2' });
    recordCorrelationKeyObservation('result', { correlationKey: 'solo' }, { source: 't2' });

    const s = getCorrelationKeyStatsSnapshot();
    expect(s.signals.idBased).toBe(1);
    expect(s.signals.roundBased).toBe(1);
    expect(s.results.idBased).toBe(1);
    expect(s.results.other).toBe(1);
    expect(s.combined.idBased).toBe(2);
    expect(s.combined.roundBased).toBe(1);
    expect(s.signalIdWithMissingRound).toBe(1);
    expect(s.bySource['signal:t1']).toEqual({ id: 1, round: 1, other: 0 });
  });
});
