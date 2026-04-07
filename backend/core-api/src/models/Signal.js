import mongoose from 'mongoose';

const { Schema } = mongoose;

const signalSchema = new Schema(
  {
    mesa: { type: String, default: '' },
    recommendation: { type: String, default: null },
    martingale: { type: Number, default: 0 },
    round: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { collection: 'signals', versionKey: false },
);

/**
 * Modelo auxiliar (colección `signals`). Persistencia operativa: `SignalAdminEvent` en signal_events.
 * @param {import('mongoose').Connection} conn
 */
export function getSignalModel(conn) {
  return conn.models.Signal || conn.model('Signal', signalSchema);
}
