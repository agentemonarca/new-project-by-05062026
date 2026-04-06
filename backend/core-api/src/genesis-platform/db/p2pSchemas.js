import mongoose from 'mongoose';

const { Schema } = mongoose;

const genesisUserSchema = new Schema(
  {
    address: { type: String, required: true, unique: true, lowercase: true, index: true },
    projectId: { type: String, default: 'genesis' },
    balances: {
      usd: { type: Number, default: 0 },
      aig: { type: Number, default: 0 },
    },
    frozen: {
      usd: { type: Number, default: 0 },
      aig: { type: Number, default: 0 },
    },
    rewardsPending: {
      direct: { type: Number, default: 0 },
      binary: { type: Number, default: 0 },
      mining: { type: Number, default: 0 },
    },
    /** USD agregado claimable (bonos direct/binary registrados vía rewards_transactions). */
    rewardsPendingUsd: { type: Number, default: 0 },
    /** Acumulado histórico USD pasado de pending a balances.usd por claim. */
    rewardsClaimedUsd: { type: Number, default: 0 },
    network: {
      leftMonth: { type: Number, default: 0 },
      rightMonth: { type: Number, default: 0 },
    },
    /** Requerido para crear órdenes de venta P2P (salvo P2P_SKIP_MINING_CHECK). */
    miningActive: { type: Boolean, default: false },
    role: { type: String, default: 'member' },
    permissions: { type: Schema.Types.Mixed, default: null },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  { timestamps: false, collection: 'genesis_users' },
);

const p2pOrderSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    projectId: { type: String, required: true, index: true },
    userId: { type: String, required: true, lowercase: true, index: true },
    side: { type: String, enum: ['buy', 'sell'], required: true },
    amount: { type: Number, required: true },
    amountOriginal: { type: Number, required: true },
    amountRemaining: { type: Number, required: true },
    price: { type: Number, required: true },
    status: {
      type: String,
      enum: ['open', 'partial', 'filled', 'cancelled'],
      default: 'open',
      index: true,
    },
    escrowUsd: { type: Number, default: 0 },
    escrowAig: { type: Number, default: 0 },
    counterpartyId: { type: String, default: null, lowercase: true },
    meta: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Number, required: true, index: true },
    updatedAt: { type: Number, required: true },
  },
  { collection: 'p2p_orders' },
);

p2pOrderSchema.index({ projectId: 1, side: 1, status: 1, createdAt: -1 });

/** Registro append-only de eventos P2P / ledger asociado. */
const p2pTransactionSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, lowercase: true, index: true },
    ts: { type: Number, required: true, index: true },
    direction: { type: String, default: 'CREDIT' },
    category: { type: String, required: true, index: true },
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'USDT' },
    referenceType: { type: String, default: 'p2p' },
    referenceId: { type: String, default: '' },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { collection: 'p2p_transactions' },
);

p2pTransactionSchema.index({ userId: 1, ts: -1 });

/** Bonos P2P/fintech: direct | binary; pending hasta claim unificado. */
const rewardsTransactionSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, lowercase: true, index: true },
    type: { type: String, enum: ['direct', 'binary'], required: true, index: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'claimed'], default: 'pending', index: true },
    createdAt: { type: Number, required: true, index: true },
    claimedAt: { type: Number, default: null },
    /** Dedup de generación (opcional). Único por usuario cuando está presente. */
    idempotencyKey: { type: String, default: null },
  },
  { collection: 'rewards_transactions' },
);

rewardsTransactionSchema.index({ userId: 1, createdAt: -1 });
rewardsTransactionSchema.index({ userId: 1, status: 1, createdAt: -1 });
rewardsTransactionSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string', $ne: null } },
  },
);

/** Respuestas idempotentes de claim (replay seguro). */
const genesisIdempotencySchema = new Schema(
  {
    scope: { type: String, enum: ['reward_claim'], required: true },
    userId: { type: String, required: true, lowercase: true, index: true },
    clientKey: { type: String, required: true },
    response: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Number, default: () => Date.now() },
  },
  { collection: 'genesis_idempotency' },
);

genesisIdempotencySchema.index({ scope: 1, userId: 1, clientKey: 1 }, { unique: true });

const genesisProjectConfigSchema = new Schema(
  {
    projectId: { type: String, required: true, unique: true },
    price: {
      basePrice: { type: Number, default: 1 },
      minPrice: { type: Number, default: 0.95 },
      maxPrice: { type: Number, default: 1.05 },
    },
    p2pFeeBps: { type: Number, default: 35 },
    minOrderUsd: { type: Number, default: 10 },
    maxOrderUsd: { type: Number, default: 10_000_000 },
    marketPaused: { type: Boolean, default: false },
  },
  { collection: 'genesis_project_configs' },
);

function getOrCreateModels() {
  const RewardsTx =
    mongoose.models.RewardsTransaction || mongoose.model('RewardsTransaction', rewardsTransactionSchema);
  const Idempotency =
    mongoose.models.GenesisIdempotency || mongoose.model('GenesisIdempotency', genesisIdempotencySchema);
  if (mongoose.models.GenesisUser) {
    return {
      GenesisUser: mongoose.models.GenesisUser,
      P2pOrder: mongoose.models.P2pOrder,
      P2pTransaction: mongoose.models.P2pTransaction,
      RewardsTransaction: RewardsTx,
      GenesisIdempotency: Idempotency,
      GenesisProjectConfig: mongoose.models.GenesisProjectConfig,
    };
  }
  return {
    GenesisUser: mongoose.model('GenesisUser', genesisUserSchema),
    P2pOrder: mongoose.model('P2pOrder', p2pOrderSchema),
    P2pTransaction: mongoose.model('P2pTransaction', p2pTransactionSchema),
    RewardsTransaction: RewardsTx,
    GenesisIdempotency: Idempotency,
    GenesisProjectConfig: mongoose.model('GenesisProjectConfig', genesisProjectConfigSchema),
  };
}

export { getOrCreateModels };
