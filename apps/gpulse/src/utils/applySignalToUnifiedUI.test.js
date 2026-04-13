import { describe, expect, it, vi } from 'vitest';
import {
  applySignalToUnifiedUI,
  buildSimulatedSignalRowFromEnginePattern,
  computeUnifiedSignalUiPatch,
} from './applySignalToUnifiedUI.js';

describe('applySignalToUnifiedUI', () => {
  it('buildSimulatedSignalRowFromEnginePattern maps RNG pattern to vector_forecast + contador 1', () => {
    const row = buildSimulatedSignalRowFromEnginePattern(['player', 'banker', 'player'], 'VIP', 42);
    expect(row.rawSignal.vector_forecast).toEqual(['P', 'B', 'P']);
    expect(row.rawSignal.contador_martingala).toBe(1);
    expect(row.martingale).toBe(1);
    expect(row.round).toBe(42);
  });

  it('computeUnifiedSignalUiPatch uses vector index from store martingale', () => {
    const row = {
      mesa: 'M1',
      round: 7,
      martingale: 2,
      rawSignal: {
        vector_forecast: ['P', 'B', 'P', 'B', 'P', 'B'],
        contador_martingala: 99,
      },
    };
    const patch = computeUnifiedSignalUiPatch(row);
    expect(patch.pattern[1]).toBe('banker');
    expect(patch.activeShot).toBe(2);
    expect(patch.visualStepIndex).toBe(1);
  });

  it('applySignalToUnifiedUI invokes setters with patch', () => {
    const setCurrentMesa = vi.fn();
    const setCurrentRonda = vi.fn();
    const setPattern = vi.fn();
    const setActiveShot = vi.fn();
    const setWinnerSide = vi.fn();
    const setScores = vi.fn();
    const row = buildSimulatedSignalRowFromEnginePattern(['banker'], 'T', 3);
    applySignalToUnifiedUI(row, {
      setCurrentMesa,
      setCurrentRonda,
      setPattern,
      setActiveShot,
      setWinnerSide,
      setScores,
    });
    expect(setCurrentMesa).toHaveBeenCalledWith('T');
    expect(setCurrentRonda).toHaveBeenCalledWith(3);
    expect(setPattern).toHaveBeenCalled();
    expect(setActiveShot).toHaveBeenCalledWith(1);
    expect(setWinnerSide).toHaveBeenCalledWith(null);
    expect(setScores).toHaveBeenCalledWith({ player: 0, banker: 0, rolling: false });
  });
});
