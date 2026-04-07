import mongoose from 'mongoose';

const { Schema } = mongoose;

export const SIGNAL_CONFIG_KEY = 'global';
export const SIGNAL_METRICS_KEY = 'global';

const signalConfigSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: SIGNAL_CONFIG_KEY },
    showSignalsToUsers: { type: Boolean, default: true },
    artificialDelayMs: { type: Number, default: 0 },
    martingaleDelta: { type: Number, default: 0 },
    filters: {
      mesa: { type: String, default: '' },
    },
    upstreamEnabled: { type: Boolean, default: true },
    updatedAt: { type: Date, default: Date.now },
    /** Auto-respuesta ante alertas diarias (`signalAutoResponseService`). */
    autoResponseEnabled: { type: Boolean, default: false },
    autoResponseActions: { type: Schema.Types.Mixed, default: () => ({}) },
    autoResponseCautela: { type: Boolean, default: false },
    autoResponseLatencyWarning: { type: Boolean, default: false },
    autoResponseLastRunAt: { type: Date, default: null },
    autoResponseLastAction: { type: Schema.Types.Mixed, default: null },
  },
  { collection: 'signal_config', versionKey: false },
);

/** Ciclo señal→resultado (un doc se actualiza al settled). */
const signalEventSchema = new Schema(
  {
    type: { type: String, required: true, enum: ['NEW_SIGNAL', 'NEW_RESULT'] },
    correlationKey: { type: String, default: '', index: true },
    mesa: { type: String, default: '' },
    round: { type: String, default: '' },
    recommendation: { type: String, default: null },
    martingale: { type: Number, default: 0 },
    /** win | loss | correlation_miss | null (pendiente) */
    result: { type: String, default: null },
    latencyMs: { type: Number, default: null },
    /** Compat lecturas legacy */
    latency: { type: Number, default: null },
    providerTimestamp: { type: Date, default: null },
    serverTimestamp: { type: Date, default: Date.now },
    serverSettledAt: { type: Date, default: null },
    rawPayload: { type: Schema.Types.Mixed, default: null },
    rawResultPayload: { type: Schema.Types.Mixed, default: null },
    correlationMiss: { type: Boolean, default: false },
    /** signal | correlation_miss | orphan_settled — agregación diaria sin contar misses como señales. */
    ingressKind: { type: String, default: 'signal', index: true },
  },
  {
    collection: 'signal_events',
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  },
);

signalEventSchema.index({ createdAt: -1 });
signalEventSchema.index({ mesa: 1, createdAt: -1 });
signalEventSchema.index(
  { correlationKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      result: null,
      correlationMiss: false,
      type: 'NEW_SIGNAL',
      correlationKey: { $gt: '' },
    },
  },
);

const signalMetricsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: SIGNAL_METRICS_KEY },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    correlationMiss: { type: Number, default: 0 },
    totalSignals: { type: Number, default: 0 },
    latencySumMs: { type: Number, default: 0 },
    latencyCount: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'signal_metrics', versionKey: false },
);

/** Agregación diaria (cron). */
const signalMetricsDailySchema = new Schema(
  {
    date: { type: String, required: true, unique: true, index: true },
    totalSignals: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    avgLatencyMs: { type: Number, default: null },
    correlationMisses: { type: Number, default: 0 },
    computedAt: { type: Date, default: Date.now },
  },
  { collection: 'signal_metrics_daily', versionKey: false },
);

/** @type {WeakMap<import('mongoose').Connection, object>} */
const modelCache = new WeakMap();

/**
 * Models bound to a specific connection (genesis / winx / gpulse).
 * @param {import('mongoose').Connection} conn
 */
export function getSignalModelsForConnection(conn) {
  if (!conn) throw new Error('getSignalModelsForConnection: connection required');
  let m = modelCache.get(conn);
  if (m) return m;
  const SignalConfig =
    conn.models.SignalAdminConfig || conn.model('SignalAdminConfig', signalConfigSchema);
  const SignalEvent =
    conn.models.SignalAdminEvent || conn.model('SignalAdminEvent', signalEventSchema);
  const SignalMetrics =
    conn.models.SignalAdminMetrics || conn.model('SignalAdminMetrics', signalMetricsSchema);
  const SignalMetricsDaily =
    conn.models.SignalAdminMetricsDaily ||
    conn.model('SignalAdminMetricsDaily', signalMetricsDailySchema);
  m = { SignalConfig, SignalEvent, SignalMetrics, SignalMetricsDaily };
  modelCache.set(conn, m);
  return m;
}
