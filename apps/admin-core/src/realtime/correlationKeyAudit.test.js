import { describe, expect, it } from 'vitest';
import {
  auditMesaRoundCorrelationKey,
  formatMesaRoundCorrelationKey,
  parseMesaRoundCorrelationKey,
} from './correlationKeyAudit.js';

describe('auditMesaRoundCorrelationKey', () => {
  it('ok si CK es id:', () => {
    expect(auditMesaRoundCorrelationKey({ mesa: 'A', round: 1, correlationKey: 'id:x' })).toEqual({ ok: true });
  });

  it('ok si alinea mesa|round', () => {
    expect(
      auditMesaRoundCorrelationKey({ mesa: 'Baccarat 5', round: 51, correlationKey: 'Baccarat 5|51' }),
    ).toEqual({ ok: true });
  });

  it('falla si CK mesa|round no coincide', () => {
    const r = auditMesaRoundCorrelationKey({
      mesa: 'Baccarat 5',
      round: 51,
      correlationKey: 'Baccarat 5|50',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.expected).toBe('Baccarat 5|51');
      expect(r.actual).toBe('Baccarat 5|50');
    }
  });
});

describe('formatMesaRoundCorrelationKey / parseMesaRoundCorrelationKey', () => {
  it('formatea mesa|roundId', () => {
    expect(formatMesaRoundCorrelationKey('M1', 9)).toBe('M1|9');
  });

  it('parse usa último | como separador de ronda', () => {
    expect(parseMesaRoundCorrelationKey('A|B|12')).toEqual({ mesa: 'A|B', roundId: '12' });
  });

  it('parse rechaza id: y vacío', () => {
    expect(parseMesaRoundCorrelationKey('id:x')).toBeNull();
    expect(parseMesaRoundCorrelationKey('')).toBeNull();
  });
});
