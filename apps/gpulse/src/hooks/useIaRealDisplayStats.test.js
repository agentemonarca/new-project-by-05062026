import { describe, it, expect } from 'vitest';
import { buildStatsFromHistory } from '../utils/buildStatsFromHistory.js';

describe('buildStatsFromHistory / useIaRealDisplayStats distribution (UI parity)', () => {
  it('buckets wins at martingale slots 1–6 and losses at 7', () => {
    const h = [
      { status: 'won', martingale: 1 },
      { status: 'won', martingale: 3 },
      { status: 'lost', martingale: 4 },
    ];
    const out = buildStatsFromHistory(h);
    expect(out.wins).toBe(2);
    expect(out.losses).toBe(1);
    expect(out.distribution[1]).toBe(1);
    expect(out.distribution[3]).toBe(1);
    expect(out.distribution[7]).toBe(1);
  });
});
