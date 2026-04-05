import { promises as fs } from 'node:fs';
import path from 'node:path';

const DATA_FILE = path.resolve(process.cwd(), 'data', 'withdrawals.json');
const LOCK_FILE = path.resolve(process.cwd(), 'data', 'withdrawals.lock');
const TMP_FILE = path.resolve(process.cwd(), 'data', 'withdrawals.tmp.json');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, '[]', 'utf8');
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
      console.info('[withdrawalStore] lock acquired');
      return;
    } catch (e) {
      if (e && (e.code === 'EEXIST' || e.code === 'EACCES')) {
        if (Date.now() - started > timeoutMs) {
          console.error('[withdrawalStore] lock timeout');
          throw new Error('Withdrawal storage lock timeout');
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
    console.info('[withdrawalStore] lock released');
  } catch (e) {}
}

async function readAllLocked() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Withdrawal storage corrupted');
  }
  if (!Array.isArray(parsed)) throw new Error('Withdrawal storage corrupted');
  return parsed;
}

async function writeAllLocked(rows) {
  const payload = JSON.stringify(rows, null, 2);
  await fs.writeFile(TMP_FILE, payload, 'utf8');
  await fs.rename(TMP_FILE, DATA_FILE);
}

export async function listWithdrawals() {
  await acquireLock();
  try {
    const rows = await readAllLocked();
    return Array.isArray(rows) ? rows : [];
  } finally {
    await releaseLock();
  }
}

/** Count withdrawals still in-flight (signer / chain pipeline). */
export async function countPendingPipelineWithdrawals() {
  const rows = await listWithdrawals();
  return rows.filter((r) => {
    const s = String(r?.status || '').toUpperCase();
    return s === 'PENDING' || s === 'BROADCASTED' || s === 'QUEUED';
  }).length;
}

export async function findWithdrawalById(recordId) {
  const id = String(recordId || '');
  if (!id) return null;
  await acquireLock();
  try {
    const rows = await readAllLocked();
    return rows.find((r) => String(r?.id) === id) || null;
  } finally {
    await releaseLock();
  }
}

export async function findWithdrawalByUserAmount(userAddress, amountWei) {
  const addr = String(userAddress || '');
  const amt = String(amountWei || '');
  await acquireLock();
  try {
    const rows = await readAllLocked();
    return rows.find((r) => String(r?.userAddress) === addr && String(r?.amountWei) === amt) || null;
  } finally {
    await releaseLock();
  }
}

export async function existsWithdrawalTxHash(txHash) {
  const h = String(txHash || '');
  if (!h) return false;
  await acquireLock();
  try {
    const rows = await readAllLocked();
    return rows.some((r) => String(r?.txHash || '') === h);
  } finally {
    await releaseLock();
  }
}

export async function createWithdrawalRecord({ userAddress, amountWei, status }) {
  const now = Date.now();
  const row = {
    id: `wd-${now}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: now,
    at: now, // backward-compatible alias
    userAddress: String(userAddress),
    amountWei: String(amountWei),
    txHash: null,
    status: String(status),
  };

  await acquireLock();
  try {
    const rows = await readAllLocked();
    rows.unshift(row);
    await writeAllLocked(rows.slice(0, 500));
    return row;
  } finally {
    await releaseLock();
  }
}

export async function attachTxHashAndStatus(recordId, txHash, status) {
  const id = String(recordId || '');
  const h = String(txHash || '');
  await acquireLock();
  try {
    const rows = await readAllLocked();
    const idx = rows.findIndex((r) => String(r?.id) === id);
    if (idx < 0) return null;
    rows[idx] = { ...rows[idx], txHash: h || rows[idx]?.txHash || null, status: String(status) };
    await writeAllLocked(rows.slice(0, 500));
    return rows[idx];
  } finally {
    await releaseLock();
  }
}

