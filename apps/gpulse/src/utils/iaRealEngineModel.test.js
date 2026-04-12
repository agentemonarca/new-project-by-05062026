import { describe, it, expect } from 'vitest';
import { PHASES } from '../domain/engine/index.js';
import {
  createIdleIaRealVisualState,
  iaRealStateAfterNewSignal,
  iaRealStateAfterProviderRowRefresh,
  iaRealStateAfterSettledResult,
  iaRealStatusToPresentationFase,
  idleHasNoMesaVisible,
} from './iaRealEngineModel.js';

const FASES = PHASES;

describe('IA Real — Phase 3D validation (deterministic, provider-driven)', () => {
  describe('1. No signal', () => {
    it('UI model = IDLE and no mesa row', () => {
      const s = createIdleIaRealVisualState();
      expect(s.status).toBe('IDLE');
      expect(idleHasNoMesaVisible(s)).toBe(true);
      expect(s.activeRow).toBeNull();
      expect(iaRealStatusToPresentationFase(s.status)).toBe(FASES.STANDBY);
    });
  });

  describe('2. New signal', () => {
    it('immediate WAITING_RESULT (sync object, no timers in model)', () => {
      const row = {
        id: 'sig-1',
        mesa: 'M1',
        round: '10',
        recommendation: 'PLAYER',
        martingale: 1,
        rawSignal: {
          vector_forecast: ['P', 'B', 'P', 'B', 'P', 'B'],
          contador_martingala: 1,
        },
      };
      const next = iaRealStateAfterNewSignal(row, { startedAt: 1_700_000_000_000 });
      expect(next.status).toBe('WAITING_RESULT');
      expect(next.activeRow).toBe(row);
      expect(next.outcomeRow).toBeNull();
      expect(next.visualProgress).toBe(0);
    });

    it('SYNC when sync guard would block (still waiting on provider)', () => {
      const row = {
        id: 'sig-2',
        mesa: 'M1',
        round: '11',
        recommendation: 'BANKER',
        rawSignal: { vector_forecast: ['B', 'P'], martingale: 1 },
      };
      const next = iaRealStateAfterNewSignal(row, { isSyncBlocked: true, startedAt: 0 });
      expect(next.status).toBe('SYNC');
      expect(next.activeRow).toBe(row);
    });
  });

  describe('3. Waiting — no step change without provider update', () => {
    it('visualStepIndex unchanged if martingale / raw unchanged', () => {
      const row = {
        id: 'x',
        rawSignal: { vector_forecast: ['P', 'B', 'P', 'B', 'P', 'B'], martingale: 2 },
      };
      const waiting = iaRealStateAfterNewSignal(row, { startedAt: 0 });
      const same = iaRealStateAfterProviderRowRefresh(waiting, row);
      expect(same.visualStepIndex).toBe(waiting.visualStepIndex);
    });

    it('visualStepIndex updates only when provider row reflects new contador', () => {
      const base = {
        id: 'x',
        rawSignal: { vector_forecast: ['P', 'B', 'P', 'B', 'P', 'B'], martingale: 1 },
      };
      const waiting = iaRealStateAfterNewSignal(base, { startedAt: 0 });
      const bumped = {
        ...base,
        rawSignal: { ...base.rawSignal, martingale: 3 },
      };
      const after = iaRealStateAfterProviderRowRefresh(waiting, bumped);
      expect(after.visualStepIndex).not.toBe(waiting.visualStepIndex);
      expect(after.activeRow).toBe(bumped);
    });
  });

  describe('4. Result', () => {
    it('immediate SUCCESS/FAILED from real ganador vs recommendation (no RNG)', () => {
      const waiting = iaRealStateAfterNewSignal(
        {
          id: 'a',
          recommendation: 'PLAYER',
          rawSignal: { vector_forecast: ['P'] },
        },
        { startedAt: 0 },
      );
      const done = {
        recommendation: 'PLAYER',
        winStatus: true,
        rawResult: {
          data: {
            data: {
              results: {
                mesa_info: { ganador: 'PLAYER', cartas_player: [], cartas_banker: [] },
              },
            },
          },
        },
      };
      const out = iaRealStateAfterSettledResult(waiting, done);
      expect(out.status).toBe('SUCCESS');
      expect(out.outcomeRow).toBe(done);
    });

    it('FAILED when prediction does not match ganador', () => {
      const waiting = iaRealStateAfterNewSignal(
        {
          id: 'b',
          recommendation: 'PLAYER',
          rawSignal: { vector_forecast: ['P'] },
        },
        { startedAt: 0 },
      );
      const done = {
        recommendation: 'PLAYER',
        winStatus: false,
        rawResult: {
          data: {
            data: {
              results: {
                mesa_info: { ganador: 'BANKER', cartas_player: [], cartas_banker: [] },
              },
            },
          },
        },
      };
      const out = iaRealStateAfterSettledResult(waiting, done);
      expect(out.status).toBe('FAILED');
    });
  });

  describe('5. End', () => {
    it('reset returns canonical IDLE', () => {
      const idle = createIdleIaRealVisualState();
      expect(idle).toEqual(createIdleIaRealVisualState());
      expect(idleHasNoMesaVisible(idle)).toBe(true);
    });
  });

  describe('Fail conditions (contract)', () => {
    it('does not advance to RESULT without a settled payload (model stays waiting until merge)', () => {
      const w = iaRealStateAfterNewSignal(
        { id: 'z', rawSignal: { vector_forecast: ['P'], martingale: 1 } },
        { startedAt: 0 },
      );
      expect(w.status).toBe('WAITING_RESULT');
      expect(['SUCCESS', 'FAILED', 'RESULT_ANIMATION']).not.toContain(w.status);
    });

    it('presentation phase tracks status, not a stale local fase', () => {
      expect(iaRealStatusToPresentationFase('WAITING_RESULT')).toBe(FASES.SEÑAL);
      expect(iaRealStatusToPresentationFase('SUCCESS')).toBe(FASES.RESULTADO);
      expect(iaRealStatusToPresentationFase('IDLE')).toBe(FASES.STANDBY);
    });
  });
});
