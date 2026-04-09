import { describe, expect, it } from 'vitest';
import { normalizeCorrelationKey } from './correlationKeyNormalize.js';

describe('normalizeCorrelationKey', () => {
  it('convierte mesa:|round: a Mesa|ronda', () => {
    expect(normalizeCorrelationKey('mesa:Baccarat 9|round:30')).toBe('Baccarat 9|30');
  });

  it('acepta mayúsculas en etiquetas', () => {
    expect(normalizeCorrelationKey('MESA:Table A|ROUND:12')).toBe('Table A|12');
  });

  it('deja pipe canónico igual', () => {
    expect(normalizeCorrelationKey('Baccarat 9|30')).toBe('Baccarat 9|30');
  });

  it('id: y cadenas sin mesa:/round: se devuelven recortadas', () => {
    expect(normalizeCorrelationKey('  id:abc  ')).toBe('id:abc');
  });

  it('null / vacío → null', () => {
    expect(normalizeCorrelationKey(null)).toBe(null);
    expect(normalizeCorrelationKey('')).toBe(null);
    expect(normalizeCorrelationKey('   ')).toBe(null);
  });
});
