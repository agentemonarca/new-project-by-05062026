import { describe, expect, it, vi, afterEach } from 'vitest';
import { applyCanonicalModeToPayload, extractCanonicalFields } from './extractCanonicalFields.js';
import { resetPhaseActiveLogForTests } from './canonicalFlowFlags.js';
import { resultMatchesSignal } from './vistaLabCycle.js';

afterEach(() => {
  vi.unstubAllEnvs();
  resetPhaseActiveLogForTests();
});

describe('canonical mode merge (flag off = no mutation)', () => {
  it('applyCanonicalModeToPayload deja payload igual si VITE_CANONICAL_MODE no está activo', () => {
    const raw = { data: { mesa: 'T1' }, round: 5 };
    const { payload, canonical } = applyCanonicalModeToPayload(raw);
    expect(payload).toBe(raw);
    expect(canonical.mesa).toBe('T1');
  });
});

describe('match V2', () => {
  it('empareja por correlationKey igual', () => {
    vi.stubEnv('VITE_MATCH_V2', '1');
    expect(
      resultMatchesSignal(
        { correlationKey: 'A|1', mesa: 'A', round: 1 },
        { correlationKey: 'A|1', mesa: 'A', round: 1 },
      ),
    ).toBe(true);
  });

  it('empareja por mesa+round', () => {
    vi.stubEnv('VITE_MATCH_V2', '1');
    expect(
      resultMatchesSignal({ mesa: 'Baccarat 9', round: 38 }, { mesa: 'Baccarat 9', round: 38 }),
    ).toBe(true);
  });

  it('sin match si mesa distinta', () => {
    vi.stubEnv('VITE_MATCH_V2', '1');
    expect(
      resultMatchesSignal({ mesa: 'A', round: 1, correlationKey: 'x' }, { mesa: 'B', round: 1, correlationKey: 'y' }),
    ).toBe(false);
  });
});

describe('round ronda_objetivo (VITE_ROUND_TARGET_MODE)', () => {
  it('prioriza ronda_objetivo cuando el flag está activo', async () => {
    vi.stubEnv('VITE_ROUND_TARGET_MODE', '1');
    vi.resetModules();
    const { extractCanonicalFields: extract } = await import('./extractCanonicalFields.js');
    const ex = extract({
      data: {
        data: {
          results: {
            mesa_info: {
              ronda_objetivo: 99,
              ronda_actual: 1,
            },
          },
          signal: { ronda_actual: 5 },
        },
      },
    });
    expect(ex.round).toBe(99);
    expect(ex.diagnostics.warnings.some((w) => w.includes('ronda_objetivo'))).toBe(true);
  });
});
