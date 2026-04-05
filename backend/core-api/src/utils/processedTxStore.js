import { promises as fs } from 'node:fs';
import path from 'node:path';

const DATA_FILE = path.resolve(process.cwd(), 'data', 'processedTxs.json');
const BACKUP_FILE = path.resolve(process.cwd(), 'data', 'processedTxs.backup.json');
const LOCK_FILE = path.resolve(process.cwd(), 'data', 'processedTxs.lock');
const TMP_FILE = path.resolve(process.cwd(), 'data', 'processedTxs.tmp.json');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function acquireLock({ timeoutMs = 5000, retryDelayMs = 75 } = {}) {
  const started = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const fh = await fs.open(LOCK_FILE, 'wx');
      await fh.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
      await fh.close();
      console.info('[processedTxStore] lock acquired');
      return;
    } catch (e) {
      // EEXIST means another writer/reader holds the lock.
      if (e && (e.code === 'EEXIST' || e.code === 'EACCES')) {
        if (Date.now() - started > timeoutMs) {
          console.error('[processedTxStore] lock timeout');
          throw new Error('Storage lock timeout');
        }
        // Wait a bit and retry.
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
    console.info('[processedTxStore] lock released');
  } catch (e) {
    // ignore
  }
}

async function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, '[]', 'utf8');
  }
}

export async function loadProcessedTxs() {
  await ensureDataFile();
  await acquireLock();
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        console.error('[processedTxStore] CRITICAL: storage malformed (expected array).');
        await fs.writeFile(BACKUP_FILE, raw, 'utf8').catch(() => {});
        throw new Error('Storage corrupted');
      }
      return parsed.map((x) => String(x)).filter(Boolean);
    } catch (e) {
      console.error('[processedTxStore] CRITICAL: storage parse failed.', { message: e?.message });
      await fs.writeFile(BACKUP_FILE, raw, 'utf8').catch(() => {});
      throw new Error('Storage corrupted');
    }
  } finally {
    await releaseLock();
  }
}

export async function saveProcessedTx(txHash) {
  const h = String(txHash || '').trim();
  if (!h) return;

  await ensureDataFile();
  await acquireLock();
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    let list;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('Storage corrupted');
      list = parsed.map((x) => String(x)).filter(Boolean);
    } catch (e) {
      console.error('[processedTxStore] CRITICAL: storage parse failed during save.', { message: e?.message });
      await fs.writeFile(BACKUP_FILE, raw, 'utf8').catch(() => {});
      throw new Error('Storage corrupted');
    }

    if (list.includes(h)) return; // idempotent
    list.push(h);

    // Atomic write: write temp then rename over target.
    const payload = JSON.stringify(list, null, 2);
    await fs.writeFile(TMP_FILE, payload, 'utf8');
    await fs.rename(TMP_FILE, DATA_FILE);
  } finally {
    await releaseLock();
  }
}

