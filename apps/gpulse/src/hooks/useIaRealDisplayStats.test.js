import { describe, it, expect } from 'vitest';

/** Pure mirror of distribution logic (read-only aggregate from settled rows). */
function distributionFromHistory(history) {
  const settled = Array.isArray(history) ? history.filter((h) => h.status === 'won' || h.status === 'lost') : [];
  const distribution = Array(8).fill(0);
  let wins = 0;
  let losses = 0;
  for (const row of settled) {
    if (row.status === 'won') {
      wins += 1;
      const mg = Math.max(1, Math.min(6, Number(row.martingale) || 1));
      distribution[mg] += 1;
    } else if (row.status === 'lost') {
      losses += 1;
      distribution[7] += 1;
    }
  }
  return { wins, losses, total: wins + losses, distribution };
}

describe('useIaRealDisplayStats distribution (UI parity)', () => {
  it('buckets wins at martingale slots 1–6 and losses at 7', () => {
    const h = [
      { status: 'won', martingale: 1 },
      { status: 'won', martingale: 3 },
      { status: 'lost', martingale: 4 },
    ];
    const out = distributionFromHistory(h);
    expect(out.wins).toBe(2);
    expect(out.losses).toBe(1);
    expect(out.distribution[1]).toBe(1);
    expect(out.distribution[3]).toBe(1);
    expect(out.distribution[7]).toBe(1);
  });
});
