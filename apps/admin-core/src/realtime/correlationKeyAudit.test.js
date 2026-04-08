import { describe, expect, it } from 'vitest';
import { auditMesaRoundCorrelationKey } from './correlationKeyAudit.js';

describe('auditMesaRoundCorrelationKey', () => {
  it('ok si CK es id:', () => {
    expect(auditMesaRoundCorrelationKey({ mesa: 'A', round: 1, correlationKey: 'id:x' })).toEqual({ ok: true });
  });

  it('ok si alinea mesa|round', () => {
    expect(
      auditMesaRoundCorrelationKey({ mesa: 'Baccarat 5', round: 51, correlationKey: 'mesa:Baccarat 5|round:51' }),
    ).toEqual({ ok: true });
  });

  it('falla si CK mesa|round no coincide', () => {
    const r = auditMesaRoundCorrelationKey({
      mesa: 'Baccarat 5',
      round: 51,
      correlationKey: 'mesa:Baccarat 5|round:50',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.expected).toBe('mesa:Baccarat 5|round:51');
      expect(r.actual).toBe('mesa:Baccarat 5|round:50');
    }
  });
});
