import { describe, expect, it } from 'vitest';
import {
  computeFullCardRevealBeforeResultMs,
  extractMesaCardsFromResult,
  VISTALAB_CARD_REVEAL_TICK_MS,
} from './VistaLabCardReveal.jsx';

describe('extractMesaCardsFromResult', () => {
  it('lee cartas desde scoreDetail cuando no hay mesa_info', () => {
    const row = {
      scoreDetail: {
        cartas_player: ['A', 'B'],
        cartas_banker: ['C'],
        puntaje_player: '5',
        puntaje_banker: '7',
        ganador: 'BANKER',
      },
    };
    const x = extractMesaCardsFromResult(row);
    expect(x.player).toEqual(['A', 'B']);
    expect(x.banker).toEqual(['C']);
    expect(x.puntaje_player).toBe('5');
    expect(x.puntaje_banker).toBe('7');
    expect(x.ganador).toBe('BANKER');
  });

  it('prioriza mesa_info sobre scoreDetail', () => {
    const row = {
      mesa_info: { cartas_player: ['X'], cartas_banker: ['Y'], ganador: 'PLAYER' },
      scoreDetail: { cartas_player: ['A'], cartas_banker: ['B'], ganador: 'BANKER' },
    };
    const x = extractMesaCardsFromResult(row);
    expect(x.player).toEqual(['X']);
    expect(x.banker).toEqual(['Y']);
    expect(x.ganador).toBe('PLAYER');
  });
});

describe('computeFullCardRevealBeforeResultMs', () => {
  it('coincide con pasos: pSlots+bSlots+2 ticks + pad', () => {
    const row = { scoreDetail: { cartas_player: ['1', '2'], cartas_banker: ['3', '4'] } };
    const steps = 2 + 2 + 2;
    expect(computeFullCardRevealBeforeResultMs(row)).toBe(steps * VISTALAB_CARD_REVEAL_TICK_MS + 200);
  });

  it('manos vacías usan un slot cada una', () => {
    const row = { scoreDetail: { cartas_player: [], cartas_banker: [] } };
    const steps = 1 + 1 + 2;
    expect(computeFullCardRevealBeforeResultMs(row)).toBe(steps * VISTALAB_CARD_REVEAL_TICK_MS + 200);
  });
});
