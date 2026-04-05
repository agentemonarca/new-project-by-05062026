import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseEther } from 'ethers';

const DATA_FILE = path.resolve(process.cwd(), 'data', 'balances.json');
const BACKUP_FILE = path.resolve(process.cwd(), 'data', 'balances.backup.json');
const LOCK_FILE = path.resolve(process.cwd(), 'data', 'balances.lock');
const TMP_FILE = path.resolve(process.cwd(), 'data', 'balances.tmp.json');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const DAILY_WITHDRAW_LIMIT_WEI = parseEther('5'); // example: 5 ETH/day

function utcDayKey(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, '{}', 'utf8');
  }
}

async function acquireLock({ timeoutMs = 5000, retryDelayMs = 75 } = {}) {
  const started = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const fh = await fs.open(LOCK_FILE, 'wx');
      await fh.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
      await fh.close();
      console.info('[balanceStore] lock acquired');
      return;
    } catch (e) {
      if (e && (e.code === 'EEXIST' || e.code === 'EACCES')) {
        if (Date.now() - started > timeoutMs) {
          console.error('[balanceStore] lock timeout');
          throw new Error('Balance storage lock timeout');
        }
        // eslint-disable-next-line no-await-in-loop
        await delay(retryDelayMs);
        continue;
      }
      throw e;
    }
  }
}

async function releaseLock() {
  try {
    await fs.unlink(LOCK_FILE);
    console.info('[balanceStore] lock released');
  } catch (e) {}
}

async function readAllLocked() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.error('[balanceStore] CRITICAL: malformed storage (expected object)');
      await fs.writeFile(BACKUP_FILE, raw, 'utf8').catch(() => {});
      throw new Error('Balance storage corrupted');
    }
    return parsed;
  } catch (e) {
    console.error('[balanceStore] CRITICAL: parse failed', { message: e?.message });
    await fs.writeFile(BACKUP_FILE, raw, 'utf8').catch(() => {});
    throw new Error('Balance storage corrupted');
  }
}

async function writeAllLocked(obj) {
  const payload = JSON.stringify(obj, null, 2);
  await fs.writeFile(TMP_FILE, payload, 'utf8');
  await fs.rename(TMP_FILE, DATA_FILE);
}

function ensureAccount(state, address) {
  if (!state[address]) {
    state[address] = { balanceWei: '0', deposits: {}, withdrawals: {}, dailyWithdrawalsWei: {} };
  }
  if (!state[address].balanceWei) state[address].balanceWei = '0';
  if (!state[address].deposits || typeof state[address].deposits !== 'object') state[address].deposits = {};
  if (!state[address].withdrawals || typeof state[address].withdrawals !== 'object') state[address].withdrawals = {};
  if (!state[address].dailyWithdrawalsWei || typeof state[address].dailyWithdrawalsWei !== 'object') {
    state[address].dailyWithdrawalsWei = {};
  }
  return state[address];
}

export async function getBalanceWei(address) {
  const addr = String(address || '');
  await acquireLock();
  try {
    const state = await readAllLocked();
    const acct = ensureAccount(state, addr);
    return BigInt(acct.balanceWei || '0');
  } finally {
    await releaseLock();
  }
}

/**
 * Credit balance from a verified deposit.
 * Idempotent by txHash.
 */
export async function creditDeposit({ address, amountWei, txHash }) {
  const addr = String(address || '');
  const h = String(txHash || '').trim();
  const amt = BigInt(amountWei);

  if (!addr) throw new Error('ADDRESS_REQUIRED');
  if (!h) throw new Error('TXHASH_REQUIRED');
  if (amt <= 0n) throw new Error('INVALID_AMOUNT');

  await acquireLock();
  try {
    const state = await readAllLocked();
    const acct = ensureAccount(state, addr);

    if (acct.deposits[h]) {
      return { applied: false, reason: 'already_credited', balanceWei: BigInt(acct.balanceWei || '0') };
    }

    const prev = BigInt(acct.balanceWei || '0');
    const next = prev + amt;
    acct.balanceWei = next.toString();
    acct.deposits[h] = amt.toString();

    await writeAllLocked(state);
    return { applied: true, balanceWei: next };
  } finally {
    await releaseLock();
  }
}

/**
 * Debit balance for a withdrawal (reservation/execution).
 * Idempotent by withdrawalId (record id).
 */
export async function debitWithdrawal({ address, amountWei, withdrawalId }) {
  const addr = String(address || '');
  const wid = String(withdrawalId || '').trim();
  const amt = BigInt(amountWei);

  if (!addr) throw new Error('ADDRESS_REQUIRED');
  if (!wid) throw new Error('WITHDRAWAL_ID_REQUIRED');
  if (amt <= 0n) throw new Error('INVALID_AMOUNT');

  await acquireLock();
  try {
    const state = await readAllLocked();
    const acct = ensureAccount(state, addr);

    if (acct.withdrawals[wid]) {
      return { applied: false, reason: 'already_debited', balanceWei: BigInt(acct.balanceWei || '0') };
    }

    const prev = BigInt(acct.balanceWei || '0');
    if (prev < amt) throw new Error('INSUFFICIENT_BALANCE');

    const dayKey = utcDayKey();
    const usedToday = BigInt(acct.dailyWithdrawalsWei?.[dayKey] || '0');
    if (usedToday + amt > DAILY_WITHDRAW_LIMIT_WEI) {
      throw new Error('DAILY_WITHDRAW_LIMIT_EXCEEDED');
    }

    const next = prev - amt;
    acct.balanceWei = next.toString();
    acct.withdrawals[wid] = { amountWei: amt.toString(), dayKey };
    acct.dailyWithdrawalsWei[dayKey] = (usedToday + amt).toString();

    await writeAllLocked(state);
    return { applied: true, balanceWei: next };
  } finally {
    await releaseLock();
  }
}

/**
 * Refund a withdrawal debit (best-effort), idempotent by withdrawalId.
 */
/**
 * Read-only ledger preview for dashboard (does not mutate balances).
 * @param {string} address
 * @param {number} [limit]
 * @returns {Promise<Array<{ id: string; type: string; amountWei: string; meta: Record<string, string> }>>}
 */
export async function listLedgerEvents(address, limit = 24) {
  const addr = String(address || '').trim();
  if (!addr) return [];
  const cap = Math.max(1, Math.min(100, Number(limit) || 24));

  await acquireLock();
  try {
    const state = await readAllLocked();
    const acct = ensureAccount(state, addr);
    const items = [];

    for (const [txHash, wei] of Object.entries(acct.deposits || {})) {
      items.push({
        id: `deposit:${txHash}`,
        type: 'deposit',
        amountWei: String(wei || '0'),
        meta: { txHash: String(txHash) },
      });
    }
    for (const [wid, entry] of Object.entries(acct.withdrawals || {})) {
      const amountWei =
        typeof entry === 'string' ? entry : String(entry?.amountWei != null ? entry.amountWei : '0');
      items.push({
        id: `withdrawal:${wid}`,
        type: 'withdrawal',
        amountWei,
        meta: { withdrawalId: String(wid) },
      });
    }

    return items.slice(-cap);
  } finally {
    await releaseLock();
  }
}

export async function refundWithdrawal({ address, withdrawalId }) {
  const addr = String(address || '');
  const wid = String(withdrawalId || '').trim();
  if (!addr) throw new Error('ADDRESS_REQUIRED');
  if (!wid) throw new Error('WITHDRAWAL_ID_REQUIRED');

  await acquireLock();
  try {
    const state = await readAllLocked();
    const acct = ensureAccount(state, addr);
    const entry = acct.withdrawals[wid];
    if (!entry) return { applied: false, reason: 'nothing_to_refund', balanceWei: BigInt(acct.balanceWei || '0') };

    const amtStr = typeof entry === 'string' ? entry : String(entry?.amountWei || '0');
    const dayKey = typeof entry === 'string' ? utcDayKey() : String(entry?.dayKey || utcDayKey());
    const amt = BigInt(amtStr);
    const prev = BigInt(acct.balanceWei || '0');
    const next = prev + amt;
    acct.balanceWei = next.toString();
    delete acct.withdrawals[wid];

    const used = BigInt(acct.dailyWithdrawalsWei?.[dayKey] || '0');
    const nextUsed = used >= amt ? used - amt : 0n;
    acct.dailyWithdrawalsWei[dayKey] = nextUsed.toString();

    await writeAllLocked(state);
    return { applied: true, balanceWei: next };
  } finally {
    await releaseLock();
  }
}

