/**
 * Contrato: cada NEW_RESULT “completo” (como lo guarda el store en `rawResult`)
 * debe poder resolverse a mesa/cartas vía `extractMesaInfoFlexible`.
 * Prueba automatizada = evidencia de regresión sin depender del navegador.
 */
import { describe, it, expect } from 'vitest';
import { extractMesaInfoFlexible } from '../../utils/iaRealEngineUi.js';
import { mergeResultEnvelopeForExtract } from '../../utils/providerMartingaleRead.js';

/** Misma forma que `normalizeNewResultPayload` devuelve en `raw` (envelope socket). */
const round1_nestedMesaInfo = {
  type: 'NEW_RESULT',
  data: {
    data: {
      results: {
        mesa_info: {
          ganador: 'PLAYER',
          cartas_player: ['K', '8'],
          cartas_banker: ['Q', '6'],
        },
      },
    },
  },
  winStatus: true,
};

/** Solo `data.results` (sin `data.data`) — merge + extractor flexible. */
const round2_dataResultsOnly = {
  type: 'NEW_RESULT',
  data: {
    results: {
      mesa_info: {
        ganador: 'BANKER',
        cartas_player: ['9', '3'],
        cartas_banker: ['10', '7'],
      },
    },
  },
};

/** `scoreDetail.player` / `banker` — fallback agresivo. */
const round3_scoreDetailAliases = {
  type: 'NEW_RESULT',
  scoreDetail: {
    player: ['A', '2'],
    banker: ['K', '3'],
    ganador: 'PLAYER',
  },
};

/** Tras merge intermedio el store puede guardar `flat` — debe extraer igual. */
const round4_flatStoredShape = mergeResultEnvelopeForExtract({
  type: 'NEW_RESULT',
  data: {
    data: {
      results: {
        mesa_info: {
          ganador: 'TIE',
          cartas_player: ['J', '5'],
          cartas_banker: ['J', '4'],
        },
      },
    },
  },
});

/** Como en logs NDJSON: top keys type, data, winStatus, martingalaData — cartas en data.martingalaData.mesa_info */
const round5_martingalaDataMesaInfo = {
  type: 'NEW_RESULT',
  winStatus: true,
  data: {
    martingalaData: {
      mesa_info: {
        ganador: 'PLAYER',
        cartas_player: ['8', '9'],
        cartas_banker: ['K', '2'],
      },
    },
  },
};

function expectCompleteMesa(meta, label) {
  const p = Array.isArray(meta.cartas_player) ? meta.cartas_player.length : 0;
  const b = Array.isArray(meta.cartas_banker) ? meta.cartas_banker.length : 0;
  expect(p, `${label}: cartas_player`).toBeGreaterThan(0);
  expect(b, `${label}: cartas_banker`).toBeGreaterThan(0);
  expect(p + b, `${label}: total cartas`).toBeGreaterThanOrEqual(3);
  expect(meta.ganador != null && String(meta.ganador).trim() !== '', `${label}: ganador`).toBe(true);
}

describe('IA Real — información completa por ronda (extractor)', () => {
  it('ronda 1: data.data.results.mesa_info (WinX anidado)', () => {
    const meta = extractMesaInfoFlexible(round1_nestedMesaInfo);
    expectCompleteMesa(meta, 'r1');
    expect(meta.ganador).toBe('PLAYER');
  });

  it('ronda 2: data.results tras merge', () => {
    const meta = extractMesaInfoFlexible(round2_dataResultsOnly);
    expectCompleteMesa(meta, 'r2');
  });

  it('ronda 3: scoreDetail.player / scoreDetail.banker', () => {
    const meta = extractMesaInfoFlexible(round3_scoreDetailAliases);
    expectCompleteMesa(meta, 'r3');
  });

  it('ronda 4: objeto ya aplanado (como rawResult tras merge en store)', () => {
    const meta = extractMesaInfoFlexible(round4_flatStoredShape);
    expectCompleteMesa(meta, 'r4');
  });

  it('ronda 5: data.martingalaData.mesa_info (envelope cliente)', () => {
    const meta = extractMesaInfoFlexible(round5_martingalaDataMesaInfo);
    expectCompleteMesa(meta, 'r5');
  });

  it('serie: varias rondas consecutivas no vacían la extracción', () => {
    const rounds = [
      round1_nestedMesaInfo,
      round2_dataResultsOnly,
      round3_scoreDetailAliases,
      round4_flatStoredShape,
      round5_martingalaDataMesaInfo,
    ];
    for (let i = 0; i < rounds.length; i++) {
      const meta = extractMesaInfoFlexible(rounds[i]);
      expectCompleteMesa(meta, `serie[${i}]`);
    }
  });
});
