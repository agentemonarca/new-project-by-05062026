import { describe, it, expect } from 'vitest';
import { normalizeNewResultPayload } from './externalSignalsTypes.js';
import { extractMesaInfoFlexible } from '../../utils/iaRealEngineUi.js';

describe('normalizeNewResultPayload', () => {
  it('stores merged envelope in raw (unwraps string data) so history rows keep cartas', () => {
    const inner = {
      scoreDetail: {
        ganador: 'PLAYER',
        cartas_player: ['4', 'K'],
        cartas_banker: ['9', '8'],
      },
    };
    const wire = { type: 'NEW_RESULT', data: JSON.stringify(inner) };
    const n = normalizeNewResultPayload(wire);
    expect(typeof n.raw.data).not.toBe('string');
    const m = extractMesaInfoFlexible(n.raw);
    expect(m.cartas_player?.length ?? 0).toBeGreaterThan(0);
    expect(m.cartas_banker?.length ?? 0).toBeGreaterThan(0);
  });
});
