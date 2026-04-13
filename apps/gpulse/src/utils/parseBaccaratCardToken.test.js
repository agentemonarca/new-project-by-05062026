import { describe, expect, it } from 'vitest';
import { parseBaccaratCardToken } from './parseBaccaratCardToken.js';

describe('parseBaccaratCardToken', () => {
  it('parses rank-only K', () => {
    const p = parseBaccaratCardToken('K', 0);
    expect(p.displayRank).toBe('K');
    expect(p.raw).toBe('K');
    expect(p.suit).toMatch(/[♥♦♠♣]/);
  });

  it('parses 10', () => {
    const p = parseBaccaratCardToken('10', 1);
    expect(p.displayRank).toBe('10');
  });

  it('handles empty', () => {
    const p = parseBaccaratCardToken('', 0);
    expect(p.displayRank).toBe('?');
  });
});
