/**
 * Run: npm run build:compensation && node --test tests/payoutIdempotency.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PayoutService } from '../dist/compensation/services/payout.service.js';
import { PayoutTxHashRegistry } from '../dist/compensation/services/payoutTxRegistry.js';
import { createKeyedMutex } from '../dist/compensation/utils/keyedMutex.js';

const fakeHash = (n) => `0x${String(n).padStart(64, '0')}`;

test('idempotency key: second enqueue returns same record, execute once', async () => {
  let executions = 0;
  const registry = new PayoutTxHashRegistry();
  const payout = new PayoutService({
    isWhitelisted: () => true,
    txRegistry: registry,
    onExecute: async (rec, ctx) => {
      executions += 1;
      const h = fakeHash(executions);
      await ctx.onBroadcast(h);
      return { externalRef: h };
    },
  });

  const a = await payout.enqueue({
    userId: '0x1111111111111111111111111111111111111111',
    amount: 10,
    source: 'direct',
    idempotencyKey: 'same:key',
  });
  const b = await payout.enqueue({
    userId: '0x1111111111111111111111111111111111111111',
    amount: 10,
    source: 'direct',
    idempotencyKey: 'same:key',
  });

  assert.equal(a.id, b.id);
  assert.equal(executions, 1);
  assert.equal(a.status, 'completed');
});

test('same user: two payouts do not execute on-chain hooks concurrently', async () => {
  let depth = 0;
  let maxDepth = 0;
  const registry = new PayoutTxHashRegistry();
  const payout = new PayoutService({
    isWhitelisted: () => true,
    txRegistry: registry,
    onExecute: async (rec, ctx) => {
      depth += 1;
      maxDepth = Math.max(maxDepth, depth);
      await new Promise((r) => setTimeout(r, 25));
      const h = fakeHash(rec.id.charCodeAt(0) + depth * 17);
      await ctx.onBroadcast(h);
      depth -= 1;
      return { externalRef: h };
    },
  });

  await Promise.all([
    payout.enqueue({
      userId: '0x2222222222222222222222222222222222222222',
      amount: 5,
      source: 'mining',
      idempotencyKey: 'mining:a',
    }),
    payout.enqueue({
      userId: '0x2222222222222222222222222222222222222222',
      amount: 5,
      source: 'mining',
      idempotencyKey: 'mining:b',
    }),
  ]);

  assert.equal(maxDepth, 1);
});

test('tx registry rejects same hash for different payout ids', () => {
  const registry = new PayoutTxHashRegistry();
  const h = fakeHash(7);
  registry.reserve(h, 'payout-a');
  assert.throws(() => registry.reserve(h, 'payout-b'), /PAYOUT_TX_HASH_ALREADY_USED/);
});

test('keyed mutex serializes same key', async () => {
  const m = createKeyedMutex();
  let n = 0;
  const results = await Promise.all([
    m.runExclusive('k', async () => {
      const v = ++n;
      await new Promise((r) => setTimeout(r, 20));
      return v;
    }),
    m.runExclusive('k', async () => {
      const v = ++n;
      return v;
    }),
  ]);
  assert.deepEqual(results.sort(), [1, 2]);
});
