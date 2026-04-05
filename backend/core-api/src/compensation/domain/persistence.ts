import type { BinaryNode, LedgerEntry, PayoutRecord, ProductPack, UserId, VolumePoint } from './types.js';

/** Durable snapshot for restart / multi-instance later (file or DB). */
export type PersistedCompensationStateV1 = {
  version: 1;
  ledger: LedgerEntry[];
  processedPurchaseTx: string[];
  settledOnchainPayoutTxHashes: string[];
  productsByUser: Record<UserId, ProductPack[]>;
  binary: { nodes: BinaryNode[]; volumePoints: VolumePoint[] };
  payouts: { records: PayoutRecord[] };
};
