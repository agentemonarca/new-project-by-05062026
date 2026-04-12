/**
 * Run: node --test tests/signalNormalize.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNewSignalPayload } from '../src/admin-signals/signalNormalize.js';

test('normalizeNewSignalPayload: UNKNOWN + vector_forecast usa celda según martingale (1-based)', () => {
  const n = normalizeNewSignalPayload({
    recommendation: 'UNKNOWN',
    data: {
      signal: {
        vector_forecast: ['B', 'P', 'B'],
        martingale: 2,
      },
    },
  });
  assert.equal(n.recommendation, 'PLAYER');
});

test('normalizeNewSignalPayload: data.data.signal + martingala.contador_martingala', () => {
  const n = normalizeNewSignalPayload({
    recommendation: 'UNKNOWN',
    data: {
      data: {
        signal: {
          vector_forecast: ['P', 'B', 'P'],
          martingala: { contador_martingala: 3 },
        },
      },
    },
  });
  assert.equal(n.recommendation, 'PLAYER');
});

test('normalizeNewSignalPayload: recomendación textual explícita gana sobre vector', () => {
  const n = normalizeNewSignalPayload({
    recommendation: 'BANKER',
    data: {
      signal: {
        vector_forecast: ['P', 'B'],
        martingale: 2,
      },
    },
  });
  assert.equal(n.recommendation, 'BANKER');
});

test('normalizeNewSignalPayload: contador 0 → primera celda', () => {
  const n = normalizeNewSignalPayload({
    recommendation: 'UNKNOWN',
    data: {
      signal: {
        vector_forecast: ['P', 'B'],
        martingale: 0,
      },
    },
  });
  assert.equal(n.recommendation, 'PLAYER');
});
