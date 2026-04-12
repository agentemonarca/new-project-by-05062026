import { describe, expect, it } from 'vitest';
import { correlationKeysLooselyEqual, normalizeCorrelationKey } from './correlationKeyNormalize.js';

describe('normalizeCorrelationKey', () => {
  it('conserva canónico mesa:|round:', () => {
    expect(normalizeCorrelationKey('mesa:Baccarat 9|round:30')).toBe('mesa:Baccarat 9|round:30');
  });

  it('acepta mayúsculas en etiquetas', () => {
    expect(normalizeCorrelationKey('MESA:Table A|ROUND:12')).toBe('MESA:Table A|ROUND:12');
  });

  it('actualiza legacy Mesa|número a mesa:|round:', () => {
    expect(normalizeCorrelationKey('Baccarat 9|30')).toBe('mesa:Baccarat 9|round:30');
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

describe('correlationKeysLooselyEqual', () => {
  it('iguala round 019 y 19', () => {
    expect(
      correlationKeysLooselyEqual('mesa:Baccarat 6|round:019', 'mesa:Baccarat 6|round:19'),
    ).toBe(true);
  });

  it('no iguala mesas distintas', () => {
    expect(correlationKeysLooselyEqual('mesa:A|round:1', 'mesa:B|round:1')).toBe(false);
  });
});
