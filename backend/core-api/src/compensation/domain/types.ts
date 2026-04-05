export type UserId = string;

export type LedgerEntry = {
  id: string;
  ts: number;
  userId: UserId;
  direction: 'CREDIT' | 'DEBIT';
  /** High-level bucket: direct | binary | mining | payout | adjustment */
  category: string;
  amount: number;
  currency: 'USDT';
  referenceType: string;
  referenceId: string;
  metadata: Record<string, unknown>;
};

export type ProductPack = {
  id: string;
  userId: UserId;
  principal: number;
  totalClaimed: number;
  claimDateMs: number;
  active: boolean;
  /** When false, ROI accrual returns 0 (legacy isPagmented). */
  isPaying: boolean;
};

export type PayoutStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'failed';

export type PayoutRecord = {
  id: string;
  userId: UserId;
  amount: number;
  currency: 'USDT';
  source: 'direct' | 'binary' | 'mining';
  status: PayoutStatus;
  idempotencyKey: string;
  createdAtMs: number;
  resolvedAtMs?: number;
  externalRef?: string;
  /** Prevents double chain sends for the same payout row. */
  executionStartedAtMs?: number;
  /** Tx hash immediately after broadcast; cleared after confirmed on-chain success. */
  pendingTxHash?: string;
  /** On-chain phase for this payout row (orthogonal to approval queue status while broadcasting). */
  chainStatus?: 'broadcast' | 'confirmed' | 'failed';
};

export type BinarySide = 1 | 2;

export type BinaryNode = {
  userId: UserId;
  fatherId: UserId | null;
  /** 1 = left, 2 = right under father (legacy type). */
  sideFromFather: BinarySide | null;
  childrenLeft: UserId | null;
  childrenRight: UserId | null;
  /** Depth in tree; used for uplines walk length. */
  depth: number;
};

export type VolumePoint = {
  id: string;
  userId: UserId;
  leg: BinarySide;
  points: number;
  remaind: number;
  monthKey: string;
  createdAtMs: number;
};
