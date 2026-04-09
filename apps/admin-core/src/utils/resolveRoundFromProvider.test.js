import { describe, expect, it } from 'vitest';
import { resolveRoundFromProvider } from './resolveRoundFromProvider.js';
import { resolveRoundFromPayload } from './signalFormatter.js';

describe('resolveRoundFromProvider', () => {
  it('ignora round raíz vacío y usa data.data.signal.ronda_actual', () => {
    const payload = {
      round: '',
      data: {
        data: {
          signal: { ronda_actual: 38 },
        },
      },
    };
    expect(resolveRoundFromProvider(payload)).toBe('38');
  });

  it('usa data.signal.ronda_actual', () => {
    const payload = {
      round: '',
      data: { signal: { ronda_actual: '12' } },
    };
    expect(resolveRoundFromProvider(payload)).toBe('12');
  });

  it('usa data.data.results.mesa_info.ronda_objetivo antes que round vacío', () => {
    const payload = {
      round: '',
      data: {
        data: {
          results: {
            mesa_info: { ronda_objetivo: 99 },
          },
        },
      },
    };
    expect(resolveRoundFromProvider(payload)).toBe('99');
  });

  it('data_evento.Ronda en mesa_info', () => {
    const payload = {
      data: {
        data: {
          results: {
            mesa_info: {
              data_evento: { Ronda: 7 },
            },
          },
        },
      },
    };
    expect(resolveRoundFromProvider(payload)).toBe('7');
  });
});

describe('resolveRoundFromPayload + provider', () => {
  it('formateador ve la ronda anidada con round plano vacío', () => {
    const row = {
      round: '',
      data: { data: { signal: { ronda_actual: 38 } } },
    };
    expect(resolveRoundFromPayload(row)).toBe('38');
  });
});
