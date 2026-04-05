/**
 * @typedef {import('./ledgerModel.js').LedgerEvent} LedgerEvent
 * @typedef {import('./ledgerModel.js').LedgerEventCategory} LedgerEventCategory
 */

const CATEGORY_ALIASES = {
  mine: 'mining',
  min: 'mining',
  boost: 'booster',
  stake: 'staking',
  net: 'network',
  binary: 'network',
  tx: 'transaction',
  txn: 'transaction',
  transfer: 'transaction',
  shop: 'marketplace',
  market: 'marketplace',
  general: 'overview',
  system: 'overview',
};

/**
 * @param {unknown} raw
 * @returns {LedgerEventCategory}
 */
function normalizeCategory(raw) {
  const k = String(raw || '')
    .toLowerCase()
    .trim();
  if (CATEGORY_ALIASES[k]) return CATEGORY_ALIASES[k];
  if (
    k === 'mining' ||
    k === 'booster' ||
    k === 'staking' ||
    k === 'network' ||
    k === 'transaction' ||
    k === 'marketplace' ||
    k === 'overview'
  ) {
    return k;
  }
  return 'overview';
}

/**
 * @param {Record<string, unknown>} raw
 * @returns {LedgerEvent}
 */
/**
 * @param {Record<string, unknown>} raw
 * @param {string | null} txHash
 * @returns {'pending' | 'confirmed' | null}
 */
function inferTxStatus(raw, txHash) {
  const s = String(raw.txStatus ?? raw.status ?? raw.txnStatus ?? '').toLowerCase();
  if (s === 'pending' || s === 'submitted' || s === 'queued') return 'pending';
  if (s === 'confirmed' || s === 'success' || s === 'finalized') return 'confirmed';
  if (raw.pending === true || raw.awaitingConfirmation === true) return 'pending';
  if (txHash && /^0x[a-fA-F0-9]{64}$/.test(txHash)) return 'confirmed';
  return null;
}

export function normalizeLedgerEvent(raw) {
  const id = String(raw.id ?? raw._id ?? `${raw.ts ?? Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  const ts = Number(raw.ts ?? raw.timestamp ?? raw.createdAt ?? Date.now());
  const category = normalizeCategory(raw.category ?? raw.type ?? raw.module);
  const txHash = raw.txHash != null ? String(raw.txHash) : raw.hash != null ? String(raw.hash) : null;
  const txStatus = inferTxStatus(raw, txHash);

  return {
    id,
    ts: Number.isFinite(ts) ? ts : Date.now(),
    category,
    kind: String(raw.kind ?? raw.eventType ?? raw.action ?? 'event'),
    title: String(raw.title ?? raw.name ?? 'Activity'),
    summary: String(raw.summary ?? raw.description ?? raw.message ?? ''),
    amountUsdt: raw.amountUsdt != null ? Number(raw.amountUsdt) : raw.usdt != null ? Number(raw.usdt) : undefined,
    amountAig: raw.amountAig != null ? Number(raw.amountAig) : raw.aig != null ? Number(raw.aig) : undefined,
    txHash,
    chainId: raw.chainId != null ? raw.chainId : null,
    txStatus,
    meta: raw.meta && typeof raw.meta === 'object' ? { ...raw.meta } : undefined,
  };
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @returns {LedgerEvent[]}
 */
export function normalizeLedgerEvents(rows) {
  return rows.map(normalizeLedgerEvent);
}
