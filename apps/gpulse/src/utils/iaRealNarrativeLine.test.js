import { describe, expect, it } from 'vitest';
import { buildIaRealNarrativeLine } from './iaRealNarrativeLine.js';

describe('buildIaRealNarrativeLine', () => {
  it('IDLE: mensaje de espera sin relay', () => {
    const s = buildIaRealNarrativeLine({ status: 'IDLE', connectionMeta: { status: 'connected' } });
    expect(s).toContain('esperando');
  });

  it('IDLE: relay reconectando', () => {
    const s = buildIaRealNarrativeLine({
      status: 'IDLE',
      connectionMeta: { status: 'reconnecting', reconnectAttempt: 2 },
    });
    expect(s).toContain('Relay reconectando');
    expect(s).toContain('2');
  });

  it('WAITING_RESULT: incluye mesa, ronda y paso', () => {
    const s = buildIaRealNarrativeLine({
      status: 'WAITING_RESULT',
      activeRow: {
        mesa: 'M1',
        round: 12,
        martingale: 1,
        rawSignal: { vector_forecast: ['P', 'B', 'P', 'B', 'P', 'B'] },
      },
      visualStepIndex: 0,
      sessionSnapshot: { wins: 1, losses: 0, rewardsNet: 0 },
    });
    expect(s).toContain('M1');
    expect(s).toContain('12');
    expect(s).toMatch(/T1\/6/);
  });

  it('SYNC: pide sincronización', () => {
    const s = buildIaRealNarrativeLine({
      status: 'SYNC',
      activeRow: {
        mesa: 'T7',
        round: 3,
        martingale: 2,
        rawSignal: { vector_forecast: ['P', 'B'] },
      },
      visualStepIndex: 1,
      sessionSnapshot: {},
    });
    expect(s).toContain('Sincronización pendiente');
    expect(s).toContain('T7');
  });

  it('SUCCESS: acierto y variación neta', () => {
    const s = buildIaRealNarrativeLine({
      status: 'SUCCESS',
      outcomeRow: {
        id: 'x',
        winStatus: true,
        rawResult: { data: { data: { results: { mesa_info: { ganador: 'Player' } } } } },
      },
      sessionSnapshot: { wins: 2, losses: 1, rewardsNet: 1.5 },
    });
    expect(s).toContain('acertada');
    expect(s).toContain('+1.50');
  });

  it('FAILED: cierre sin acierto', () => {
    const s = buildIaRealNarrativeLine({
      status: 'FAILED',
      outcomeRow: {
        id: 'y',
        winStatus: false,
        rawResult: { data: { data: { results: { mesa_info: { ganador: 'Banker' } } } } },
      },
      sessionSnapshot: { wins: 0, losses: 3, rewardsNet: -2 },
    });
    expect(s).toContain('sin acierto');
    expect(s).toContain('-2.00');
  });
});
