#!/usr/bin/env node
/**
 * G-Pulse Web3 Backend — End-to-End Test Harness
 *
 * Run:
 *   node backend/tests/e2eRunner.js --full
 *
 * Env:
 *   BACKEND_URL=http://localhost:5050
 *   PRIVATE_KEY_TEST=0x...
 *   TEST_ADDRESS=0x...            (optional; derived from PRIVATE_KEY_TEST if omitted)
 *   TEST_DEPOSIT_ETH=0.5          (optional; default 1.0)
 *   TEST_WITHDRAW_ETH=0.01        (optional; default 0.01)
 *
 * Notes:
 * - Does NOT modify controllers/services.
 * - Uses existing stores for safe simulation where needed.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { Wallet, getAddress, parseEther } from 'ethers';

import { creditDeposit, getBalanceWei, debitWithdrawal } from '../src/utils/balanceStore.js';
import { createWithdrawalRecord, listWithdrawals } from '../src/utils/withdrawalStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_URL = String(process.env.BACKEND_URL || 'http://localhost:5050').replace(/\/+$/, '');
const PRIVATE_KEY_TEST = String(process.env.PRIVATE_KEY_TEST || '').trim();
const TEST_ADDRESS_ENV = String(process.env.TEST_ADDRESS || '').trim();

const TEST_DEPOSIT_ETH = String(process.env.TEST_DEPOSIT_ETH || '1.0');
const TEST_WITHDRAW_ETH = String(process.env.TEST_WITHDRAW_ETH || '0.01');

const DATA_DIR = path.resolve(process.cwd(), 'data');
const WITHDRAWALS_FILE = path.resolve(DATA_DIR, 'withdrawals.json');
const BALANCES_FILE = path.resolve(DATA_DIR, 'balances.json');

function hasFlag(name) {
  return process.argv.includes(name);
}

function pickMode() {
  if (hasFlag('--auth-only')) return 'auth-only';
  if (hasFlag('--withdraw-only')) return 'withdraw-only';
  if (hasFlag('--full')) return 'full';
  // default
  return 'full';
}

function fmt(testName, status, details) {
  const s = String(status).toUpperCase();
  return [`[${testName}]`, `STATUS: ${s}`, `DETAILS: ${details || ''}`].join('\n');
}

async function httpJson(url, { method = 'GET', headers = {}, body } = {}) {
  const resp = await fetch(url, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text().catch(() => '');
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return {
    ok: resp.ok,
    status: resp.status,
    headers: resp.headers,
    text,
    json,
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'ASSERT_FAILED');
}

function walletFromEnv() {
  if (!PRIVATE_KEY_TEST) {
    throw new Error('Missing env PRIVATE_KEY_TEST');
  }
  return new Wallet(PRIVATE_KEY_TEST);
}

async function ensureBackendUp() {
  const r = await httpJson(`${BACKEND_URL}/health`);
  assert(r.ok, `Backend health check failed (${r.status})`);
  assert(r.json?.ok === true, 'Backend /health did not return { ok:true }');
}

async function testAuthFlow() {
  const TEST_NAME = 'TEST 1 — AUTH FLOW';
  try {
    const w = walletFromEnv();
    const address = getAddress(TEST_ADDRESS_ENV || w.address);

    let r1 = await httpJson(`${BACKEND_URL}/api/auth/request-message`, {
      method: 'POST',
      body: { address },
    });
    if (r1.status === 429) {
      const ra = r1.headers?.get ? r1.headers.get('Retry-After') : null;
      const waitSec = Math.min(120, Math.max(1, Number(ra || 1)));
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      r1 = await httpJson(`${BACKEND_URL}/api/auth/request-message`, {
        method: 'POST',
        body: { address },
      });
    }
    assert(r1.ok, `request-message failed (${r1.status})`);
    assert(r1.json?.success === true, 'request-message success !== true');
    assert(typeof r1.json?.message === 'string' && r1.json.message.includes('Nonce:'), 'challenge message missing nonce');

    const message = r1.json.message;
    const signature = await w.signMessage(message);

    const r2 = await httpJson(`${BACKEND_URL}/api/auth/verify-signature`, {
      method: 'POST',
      body: { address, signature, message },
    });
    assert(r2.ok, `verify-signature failed (${r2.status})`);
    assert(r2.json?.success === true, 'verify-signature success !== true');
    assert(typeof r2.json?.token === 'string' && r2.json.token.length > 10, 'token missing/invalid');
    assert(getAddress(r2.json?.address) === address, 'verified address mismatch');

    console.log(fmt(TEST_NAME, 'PASS', '✔ AUTH SUCCESS'));
    return { token: r2.json.token, address, message, signature };
  } catch (e) {
    console.error(fmt(TEST_NAME, 'FAIL', String(e?.message || e)));
    return { error: e };
  }
}

async function testDepositSimulation({ address }) {
  const TEST_NAME = 'TEST 2 — DEPOSIT SIMULATION';
  try {
    const before = await getBalanceWei(address);
    const amountWei = parseEther(TEST_DEPOSIT_ETH);
    const fakeTxHash = `e2e-deposit-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const out = await creditDeposit({ address, amountWei, txHash: fakeTxHash });
    const after = await getBalanceWei(address);

    assert(after >= before, 'balance decreased after credit (unexpected)');
    assert(after === before + amountWei, 'balance did not increase by expected amount');
    assert(out?.applied === true, 'creditDeposit not applied');

    console.log(fmt(TEST_NAME, 'PASS', `✔ BALANCE INCREASED (+${TEST_DEPOSIT_ETH} ETH simulated)`));
    return { credited: true, amountWei, before: before.toString(), after: after.toString(), txHash: fakeTxHash };
  } catch (e) {
    console.error(fmt(TEST_NAME, 'FAIL', String(e?.message || e)));
    return { error: e };
  }
}

async function testWithdrawSuccess({ token, address }) {
  const TEST_NAME = 'TEST 3 — WITHDRAW SUCCESS';
  try {
    const r = await httpJson(`${BACKEND_URL}/api/request-withdraw`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { userAddress: address, amount: TEST_WITHDRAW_ETH },
    });

    // If signer is not configured, treat as FAIL (production-safety requires signer configured).
    assert(r.ok, `withdraw failed (${r.status}) ${r.json?.reason || r.text}`);
    assert(r.json?.success === true, 'withdraw success !== true');
    assert(typeof r.json?.txHash === 'string' && r.json.txHash.startsWith('0x'), 'txHash missing/invalid');

    console.log(fmt(TEST_NAME, 'PASS', '✔ WITHDRAW SUCCESS'));
    return { txHash: r.json.txHash };
  } catch (e) {
    console.error(fmt(TEST_NAME, 'FAIL', String(e?.message || e)));
    return { error: e };
  }
}

async function testRateLimit() {
  const TEST_NAME = 'TEST 4 — RATE LIMIT';
  try {
    const w = walletFromEnv();
    const address = getAddress(TEST_ADDRESS_ENV || w.address);

    let last = null;
    for (let i = 0; i < 12; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      last = await httpJson(`${BACKEND_URL}/api/auth/request-message`, { method: 'POST', body: { address } });
      if (last.status === 429) break;
    }

    assert(last, 'no response');
    assert(last.status === 429, `expected 429, got ${last.status}`);
    const ra = last.headers?.get ? last.headers.get('Retry-After') : null;
    assert(ra && String(ra).trim().length > 0, 'Retry-After header missing');

    console.log(fmt(TEST_NAME, 'PASS', '✔ RATE LIMIT WORKING (429 + Retry-After)'));
    return { retryAfter: ra };
  } catch (e) {
    console.error(fmt(TEST_NAME, 'FAIL', String(e?.message || e)));
    return { error: e };
  }
}

async function testReplayAttack({ address, message, signature }) {
  const TEST_NAME = 'TEST 5 — REPLAY ATTACK';
  try {
    const r = await httpJson(`${BACKEND_URL}/api/auth/verify-signature`, {
      method: 'POST',
      body: { address, signature, message },
    });
    assert(!r.ok, 'expected replay verify to fail');
    assert(r.status === 401, `expected 401, got ${r.status}`);
    const reason = r.json?.reason || '';
    assert(reason === 'NONCE_MISMATCH' || reason === 'INVALID_SIGNATURE', `unexpected reason: ${reason || r.text}`);

    console.log(fmt(TEST_NAME, 'PASS', `✔ REPLAY BLOCKED (${reason})`));
    return { reason };
  } catch (e) {
    console.error(fmt(TEST_NAME, 'FAIL', String(e?.message || e)));
    return { error: e };
  }
}

async function crashSimulateAfterDebit({ address }) {
  const TEST_NAME = 'TEST 6 — CRASH SIMULATION';
  try {
    const amountWei = parseEther(TEST_WITHDRAW_ETH);
    const record = await createWithdrawalRecord({ userAddress: address, amountWei, status: 'PENDING' });
    await debitWithdrawal({ address, amountWei, withdrawalId: record.id });

    // Intentionally exit to simulate crash after debit and before broadcasting.
    console.log(fmt(TEST_NAME, 'PASS', `✔ Simulated crash point created (withdrawalId=${record.id}). Exiting now.`));
    // Flush stdout best-effort, then exit.
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  } catch (e) {
    console.error(fmt(TEST_NAME, 'FAIL', String(e?.message || e)));
    return { error: e };
  }
}

async function testRecoveryValidation({ address }) {
  const TEST_NAME = 'TEST 7 — RECOVERY VALIDATION';
  try {
    // Validate using on-disk ledgers.
    const withdrawalsRaw = await fs.readFile(WITHDRAWALS_FILE, 'utf8');
    const balancesRaw = await fs.readFile(BALANCES_FILE, 'utf8');

    const withdrawals = JSON.parse(withdrawalsRaw);
    const balances = JSON.parse(balancesRaw);

    assert(Array.isArray(withdrawals), 'withdrawals.json malformed (expected array)');
    assert(balances && typeof balances === 'object' && !Array.isArray(balances), 'balances.json malformed (expected object)');

    const stuck = withdrawals.filter((w) => w && (w.status === 'PENDING')).length;
    assert(stuck === 0, `Found stuck PENDING withdrawals: ${stuck}`);

    // For our address, ensure no PENDING remain and any BROADCASTED are allowed (receipt unknown).
    const mine = withdrawals.filter((w) => String(w?.userAddress || '') === String(address));
    const badMine = mine.filter((w) => w && w.status === 'PENDING');
    assert(badMine.length === 0, `Address has PENDING withdrawals: ${badMine.length}`);

    // Also sanity check: balance is readable and non-negative.
    const b = await getBalanceWei(address);
    assert(b >= 0n, 'balance is negative (impossible)');

    console.log(fmt(TEST_NAME, 'PASS', '✔ RECOVERY SUCCESS (no stuck PENDING; balance consistent)'));
    return { ok: true, mineCount: mine.length };
  } catch (e) {
    console.error(fmt(TEST_NAME, 'FAIL', String(e?.message || e)));
    return { error: e };
  }
}

async function main() {
  const mode = pickMode();
  const simulateCrash = hasFlag('--simulate-crash');

  const results = [];
  const push = (name, r) => results.push({ name, ok: !r?.error, ...r });

  try {
    await ensureBackendUp();
  } catch (e) {
    console.error(fmt('BOOTSTRAP', 'FAIL', `Backend not reachable at ${BACKEND_URL} (${e?.message || e})`));
    // eslint-disable-next-line no-process-exit
    process.exit(2);
  }

  // Crash simulation should not depend on auth endpoints (rate limits, etc).
  // It intentionally creates the "crash-after-debit" persisted state and exits.
  if (simulateCrash && (mode === 'withdraw-only' || mode === 'full')) {
    try {
      const w = walletFromEnv();
      const address = getAddress(TEST_ADDRESS_ENV || w.address);
      await crashSimulateAfterDebit({ address });
      return finalize(results);
    } catch (e) {
      const err = { error: e };
      push('CRASH_SIM', err);
      return finalize(results);
    }
  }

  // Shared auth context
  const auth = await testAuthFlow();
  push('AUTH', auth);
  if (auth.error) return finalize(results);

  if (mode === 'auth-only') {
    await testReplayAttack(auth).then((r) => push('REPLAY', r));
    await testRateLimit().then((r) => push('RATE_LIMIT', r));
    return finalize(results);
  }

  if (mode === 'withdraw-only' || mode === 'full') {
    const dep = await testDepositSimulation({ address: auth.address });
    push('DEPOSIT_SIM', dep);
    if (dep.error) return finalize(results);

    const wd = await testWithdrawSuccess({ token: auth.token, address: auth.address });
    push('WITHDRAW', wd);

    // Optional integrity: read withdrawal ledger for visibility.
    try {
      const rows = await listWithdrawals();
      const mine = rows.filter((r) => String(r?.userAddress || '') === String(auth.address));
      console.log(fmt('INFO — WITHDRAWAL LEDGER', 'PASS', `records_for_address=${mine.length}`));
    } catch {}
  }

  if (mode === 'full') {
    await testReplayAttack(auth).then((r) => push('REPLAY', r));
    await testRateLimit().then((r) => push('RATE_LIMIT', r));
    await testRecoveryValidation({ address: auth.address }).then((r) => push('RECOVERY', r));
  }

  return finalize(results);
}

function finalize(results) {
  const total = results.length;
  const passed = results.filter((r) => r.ok).length;
  const failed = total - passed;

  console.log('\n## 📊 FINAL SUMMARY');
  console.log(`Total tests: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed === 0) {
    console.log('\n✅ SYSTEM VALIDATED — PRODUCTION READY (SINGLE NODE)');
    // eslint-disable-next-line no-process-exit
    process.exit(0);
  }
  // eslint-disable-next-line no-process-exit
  process.exit(1);
}

await main();

