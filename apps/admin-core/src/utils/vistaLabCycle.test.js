import { describe, expect, it } from 'vitest';
import { formatResult, formatSignal } from './signalFormatter.js';
import {
  evaluateWaitingHead,
  findMatchingResultForSignal,
  forecastStepMisalignedWithGanador,
  martingaleDataFromSignal,
  resultMatchesSignal,
} from './vistaLabCycle.js';

describe('resultMatchesSignal', () => {
  it('empareja por correlationKey cuando ambos existen e iguales', () => {
    const sig = { correlationKey: 'abc', mesa: '1', round: '9' };
    const res = { correlationKey: 'abc', mesa: '1', round: '10' };
    expect(resultMatchesSignal(sig, res)).toBe(true);
  });

  it('no empareja si correlationKey distinto aunque mesa coincida', () => {
    const sig = { correlationKey: 'a', mesa: '1', round: '1' };
    const res = { correlationKey: 'b', mesa: '1', round: '1' };
    expect(resultMatchesSignal(sig, res)).toBe(false);
  });

  it('si solo uno trae correlationKey → false (no mezclar con mesa/round)', () => {
    const sig = { correlationKey: 'only-here', mesa: '1', round: '1' };
    const res = { mesa: '1', round: '1' };
    expect(resultMatchesSignal(sig, res)).toBe(false);
  });

  it('empareja por signalId ↔ id cuando no hay correlationKey', () => {
    const sig = { id: 'sig-42', mesa: 'M1', round: 'R1' };
    const res = { signalId: 'sig-42', mesa: 'M1', round: 'R1' };
    expect(resultMatchesSignal(sig, res)).toBe(true);
  });

  it('con misma mesa y rounds explícitos iguales, empareja (camino mesa+round)', () => {
    const sig = { mesa: 'A', round: '5' };
    const res = { mesa: 'A', round: '5' };
    expect(resultMatchesSignal(sig, res)).toBe(true);
  });

  it('con misma mesa y rounds explícitos distintos, no empareja', () => {
    const sig = { mesa: 'A', round: '5' };
    const res = { mesa: 'A', round: '6' };
    expect(resultMatchesSignal(sig, res)).toBe(false);
  });

  it('mesa+round: si falta round en uno de los dos → false (fase 4)', () => {
    const sig = { mesa: 'A', round: '' };
    const res = { mesa: 'A', round: '99' };
    expect(resultMatchesSignal(sig, res)).toBe(false);
  });

  it('id coincide pero mesa distinta cuando ambas vienen → false', () => {
    const sig = { id: 'x', mesa: '1' };
    const res = { signalId: 'x', mesa: '2' };
    expect(resultMatchesSignal(sig, res)).toBe(false);
  });
});

describe('findMatchingResultForSignal', () => {
  it('devuelve el primer resultado que matchea', () => {
    const sig = { mesa: 'M', round: '1' };
    const rows = [
      { mesa: 'M', round: '2', recvId: 'a' },
      { mesa: 'M', round: '1', recvId: 'b' },
    ];
    expect(findMatchingResultForSignal(sig, rows)?.recvId).toBe('b');
  });

  it('respeta consumedRecvId', () => {
    const sig = { mesa: 'M', round: '1' };
    const rows = [{ mesa: 'M', round: '1', recvId: 'same' }];
    expect(findMatchingResultForSignal(sig, rows, 'same')).toBe(null);
  });
});

describe('evaluateWaitingHead', () => {
  it('sin cabeza → NO_HEAD', () => {
    expect(evaluateWaitingHead(null, { barrierRecvId: null })).toEqual({ ok: false, reason: 'NO_HEAD' });
    expect(evaluateWaitingHead({}, { barrierRecvId: null })).toEqual({ ok: false, reason: 'NO_HEAD' });
  });

  it('con recvId y sin barrera → ok', () => {
    expect(evaluateWaitingHead({ recvId: 'r1' }, { barrierRecvId: null })).toEqual({
      ok: true,
      headRecvId: 'r1',
    });
  });

  it('si cabeza es la misma recvId que la barrera (post-cooldown) → bloqueo', () => {
    expect(evaluateWaitingHead({ recvId: 'same' }, { barrierRecvId: 'same' })).toEqual({
      ok: false,
      reason: 'BARRIER_SAME_AS_LAST_CYCLE',
    });
  });

  it('nueva señal distinta barrera → ok', () => {
    expect(evaluateWaitingHead({ recvId: 'new' }, { barrierRecvId: 'old' })).toEqual({
      ok: true,
      headRecvId: 'new',
    });
  });
});

describe('formatSignal + formatResult (como adminSignalsLiveStore en vivo)', () => {
  it('id en señal y signalId en resultado generan correlationKey alineado y hacen match', () => {
    const rawSig = { mesa: 'Mesa1', recommendation: 'P', id: 'uuid-1', round: '12' };
    const rawRes = { mesa: 'Mesa1', signalId: 'uuid-1', round: '12', ganador: 'PLAYER', winStatus: true };
    const sig = { ...formatSignal(rawSig), recvId: 'synthetic-s' };
    const res = { ...formatResult(rawRes, 'PLAYER'), recvId: 'synthetic-r' };
    expect(resultMatchesSignal(sig, res)).toBe(true);
  });

  it('si el backend no envía ids alineados, mesa+round deben coincidir', () => {
    const rawSig = { mesa: 'T1', recommendation: 'B', round: '88' };
    const rawRes = { mesa: 'T1', round: '88', ganador: 'BANKER', winStatus: true };
    const sig = { ...formatSignal(rawSig), recvId: 's1' };
    const res = { ...formatResult(rawRes, 'BANKER'), recvId: 'r1' };
    expect(resultMatchesSignal(sig, res)).toBe(true);
  });
});

describe('forecastStepMisalignedWithGanador', () => {
  it('mismo lado en forecast6[0] y ganador → no desalineado', () => {
    const sig = { martingaleLevel: 0, forecast6: ['P', 'B', '—', '—', '—', '—'] };
    const res = { mesa_info: { ganador: 'PLAYER', cartas_player: [], cartas_banker: [] } };
    expect(forecastStepMisalignedWithGanador(sig, res)).toEqual({ misaligned: false });
  });

  it('forecast paso 0 P vs ganador BANKER → desalineado', () => {
    const sig = { martingaleLevel: 0, forecast6: ['P', 'B', '—', '—', '—', '—'] };
    const res = { mesa_info: { ganador: 'BANKER', cartas_player: [], cartas_banker: [] } };
    expect(forecastStepMisalignedWithGanador(sig, res)).toMatchObject({
      misaligned: true,
      step: 0,
      pred: 'P',
      win: 'B',
    });
  });

  it('empate real no marca desalineación', () => {
    const sig = { martingaleLevel: 0, forecast6: ['P', 'B', '—', '—', '—', '—'] };
    const res = { mesa_info: { ganador: 'TIE', cartas_player: [], cartas_banker: [] } };
    expect(forecastStepMisalignedWithGanador(sig, res).misaligned).toBe(false);
  });
});

describe('martingaleDataFromSignal', () => {
  it('level 0 → inactive', () => {
    expect(martingaleDataFromSignal({ martingaleLevel: 0 })).toEqual({ active: false, level: 0 });
  });

  it('level > 0 → active', () => {
    expect(martingaleDataFromSignal({ martingaleLevel: 2 })).toEqual({ active: true, level: 2 });
  });
});
