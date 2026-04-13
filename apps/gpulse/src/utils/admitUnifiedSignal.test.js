import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  admitUnifiedSignal,
  UNIFIED_SIGNAL_NEAR_MS,
  UNIFIED_SOURCE,
} from './applySignalToUnifiedUI.js';

describe('admitUnifiedSignal', () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('allows when lastAppliedSignalRef is omitted', () => {
    expect(admitUnifiedSignal({ source: UNIFIED_SOURCE.IA, ts: 1 }, null)).toEqual({ ok: true });
  });

  it('accepts first candidate and stores ref', () => {
    const ref = { current: null };
    const r = admitUnifiedSignal({ source: UNIFIED_SOURCE.VISOR, ts: 1000 }, ref);
    expect(r).toEqual({ ok: true });
    expect(ref.current).toEqual({ source: UNIFIED_SOURCE.VISOR, ts: 1000 });
  });

  it('rejects stale ts (incoming < last)', () => {
    const ref = { current: { source: UNIFIED_SOURCE.IA, ts: 200 } };
    const r = admitUnifiedSignal({ source: UNIFIED_SOURCE.IA, ts: 100 }, ref);
    expect(r).toEqual({ ok: false, reason: 'stale_ts' });
    expect(ref.current.ts).toBe(200);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('rejects invalid ts', () => {
    const ref = { current: null };
    const r = admitUnifiedSignal({ source: UNIFIED_SOURCE.IA, ts: NaN }, ref);
    expect(r).toEqual({ ok: false, reason: 'invalid_ts' });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('accepts when dt > NEAR_MS regardless of priority', () => {
    const ref = { current: { source: UNIFIED_SOURCE.IA, ts: 100 } };
    const r = admitUnifiedSignal({ source: UNIFIED_SOURCE.SIM, ts: 100 + UNIFIED_SIGNAL_NEAR_MS + 1 }, ref);
    expect(r).toEqual({ ok: true });
    expect(ref.current.source).toBe(UNIFIED_SOURCE.SIM);
  });

  it('within near window: IA beats SIM', () => {
    const ref = { current: { source: UNIFIED_SOURCE.SIM, ts: 1000 } };
    const r = admitUnifiedSignal({ source: UNIFIED_SOURCE.IA, ts: 1000 + 10 }, ref);
    expect(r).toEqual({ ok: true });
    expect(ref.current.source).toBe(UNIFIED_SOURCE.IA);
  });

  it('within near window: SIM loses to IA', () => {
    const ref = { current: { source: UNIFIED_SOURCE.IA, ts: 1000 } };
    const r = admitUnifiedSignal({ source: UNIFIED_SOURCE.SIM, ts: 1000 + 10 }, ref);
    expect(r).toEqual({ ok: false, reason: 'priority' });
    expect(ref.current.source).toBe(UNIFIED_SOURCE.IA);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('within near window: equal rank accepts incoming', () => {
    const ref = { current: { source: UNIFIED_SOURCE.VISOR, ts: 1000 } };
    const r = admitUnifiedSignal({ source: UNIFIED_SOURCE.VISOR, ts: 1000 + 20 }, ref);
    expect(r).toEqual({ ok: true });
    expect(ref.current.ts).toBe(1020);
  });

  it('same ts: higher priority wins', () => {
    const ref = { current: { source: UNIFIED_SOURCE.SIM, ts: 500 } };
    const r = admitUnifiedSignal({ source: UNIFIED_SOURCE.IA, ts: 500 }, ref);
    expect(r).toEqual({ ok: true });
    expect(ref.current.source).toBe(UNIFIED_SOURCE.IA);
  });

  it('same ts: equal priority rejects incoming', () => {
    const ref = { current: { source: UNIFIED_SOURCE.VISOR, ts: 500 } };
    const r = admitUnifiedSignal({ source: UNIFIED_SOURCE.VISOR, ts: 500 }, ref);
    expect(r).toEqual({ ok: false, reason: 'same_ts' });
    expect(ref.current.source).toBe(UNIFIED_SOURCE.VISOR);
    expect(warnSpy).toHaveBeenCalled();
  });
});
