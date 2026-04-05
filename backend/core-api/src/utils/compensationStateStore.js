import { promises as fs } from 'node:fs';
import path from 'node:path';

const DATA_FILE = path.resolve(process.cwd(), 'data', 'compensationState.json');
const BACKUP_FILE = path.resolve(process.cwd(), 'data', 'compensationState.backup.json');
const LOCK_FILE = path.resolve(process.cwd(), 'data', 'compensationState.lock');
const TMP_FILE = path.resolve(process.cwd(), 'data', 'compensationState.tmp.json');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function acquireLock({ timeoutMs = 15_000, retryDelayMs = 50 } = {}) {
  const started = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const fh = await fs.open(LOCK_FILE, 'wx');
      await fh.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
      await fh.close();
      return;
    } catch (e) {
      if (e && (e.code === 'EEXIST' || e.code === 'EACCES')) {
        if (Date.now() - started > timeoutMs) throw new Error('compensation_state_lock_timeout');
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
  } catch {
    /* ignore */
  }
}

function defaultState() {
  return {
    version: 1,
    ledger: [],
    processedPurchaseTx: [],
    settledOnchainPayoutTxHashes: [],
    productsByUser: {},
    binary: { nodes: [], volumePoints: [] },
    payouts: { records: [] },
  };
}

function sanitizeState(raw) {
  const d = defaultState();
  if (!raw || typeof raw !== 'object') return d;
  if (Number(raw.version) !== 1) return d;
  d.ledger = Array.isArray(raw.ledger) ? raw.ledger : [];
  d.processedPurchaseTx = Array.isArray(raw.processedPurchaseTx)
    ? raw.processedPurchaseTx.map((x) => String(x).toLowerCase())
    : [];
  d.settledOnchainPayoutTxHashes = Array.isArray(raw.settledOnchainPayoutTxHashes)
    ? raw.settledOnchainPayoutTxHashes.map((x) => String(x).toLowerCase())
    : [];
  d.productsByUser =
    raw.productsByUser && typeof raw.productsByUser === 'object' ? { ...raw.productsByUser } : {};
  d.binary =
    raw.binary && typeof raw.binary === 'object'
      ? {
          nodes: Array.isArray(raw.binary.nodes) ? raw.binary.nodes : [],
          volumePoints: Array.isArray(raw.binary.volumePoints) ? raw.binary.volumePoints : [],
        }
      : { nodes: [], volumePoints: [] };
  d.payouts =
    raw.payouts && typeof raw.payouts === 'object' && Array.isArray(raw.payouts.records)
      ? { records: raw.payouts.records }
      : { records: [] };
  return d;
}

export async function loadCompensationState() {
  const dir = path.dirname(DATA_FILE);
  await fs.mkdir(dir, { recursive: true });
  await acquireLock();
  try {
    let rawText;
    try {
      rawText = await fs.readFile(DATA_FILE, 'utf8');
    } catch (e) {
      if (e && e.code === 'ENOENT') return defaultState();
      throw e;
    }
    try {
      return sanitizeState(JSON.parse(rawText));
    } catch (e) {
      console.error('[compensationStateStore] parse failed, restore from backup or delete file', {
        message: e?.message,
      });
      await fs.writeFile(BACKUP_FILE, rawText, 'utf8').catch(() => {});
      throw new Error('compensation_state_corrupt');
    }
  } finally {
    await releaseLock();
  }
}

/**
 * Atomic replace of full compensation durable snapshot (single logical transaction).
 *
 * @param {ReturnType<typeof defaultState>} state
 */
export async function saveCompensationState(state) {
  const payload = JSON.stringify(sanitizeState(state), null, 2);
  const dir = path.dirname(DATA_FILE);
  await fs.mkdir(dir, { recursive: true });
  await acquireLock();
  try {
    await fs.writeFile(TMP_FILE, payload, 'utf8');
    await fs.rename(TMP_FILE, DATA_FILE);
  } finally {
    await releaseLock();
  }
}
