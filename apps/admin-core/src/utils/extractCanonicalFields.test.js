import { describe, expect, it } from 'vitest';
import { extractCanonicalFields } from './extractCanonicalFields.js';

describe('extractCanonicalFields', () => {
  it('extrae mesa/round/direction/algorithm desde data.data.signal', () => {
    const ex = extractCanonicalFields({
      id: '99',
      data: {
        mesa: 'Baccarat 5',
        data: {
          signal: {
            nombre_mesa: 'Baccarat 5',
            ronda_actual: 38,
            nombre_algoritmo: 'SIMETRIA_DIRECTA',
            vector_forecast: ['P', 'B'],
          },
        },
      },
    });
    expect(ex.sourceUsed).toBe('data.data.signal');
    expect(ex.mesa).toBe('Baccarat 5');
    expect(ex.round).toBe(38);
    expect(ex.direction).toBe('P');
    expect(ex.algorithm).toBe('SIMETRIA_DIRECTA');
    expect(ex.correlationKey).toBe('Baccarat 5|38');
    expect(ex.sourcePaths.mesa).toBe('payload.data.mesa');
  });

  it('resultado desde mesa_info.ganador', () => {
    const ex = extractCanonicalFields({
      data: {
        data: {
          results: {
            mesa_info: { ganador: 'PLAYER', nombre_mesa: 'T1', ronda_actual: 1 },
          },
        },
      },
    });
    expect(ex.result).toBe('PLAYER');
    expect(ex.mesa).toBe('T1');
  });

  it('payload inválido: missing payload', () => {
    const ex = extractCanonicalFields(null);
    expect(ex.diagnostics.missing).toContain('payload');
  });

  it('detecta conflicto mesa sig2 vs data.mesa', () => {
    const ex = extractCanonicalFields({
      data: {
        mesa: 'A',
        data: {
          signal: { nombre_mesa: 'B' },
        },
      },
    });
    expect(ex.diagnostics.conflicts).toContain(
      'mesa mismatch between sig2 (data.data.signal) and payload.data.mesa',
    );
  });
});
