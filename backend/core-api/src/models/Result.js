import mongoose from 'mongoose';

const { Schema } = mongoose;

const resultSchema = new Schema(
  {
    mesa: { type: String, default: '' },
    recommendation: { type: String, default: null },
    martingale: { type: Number, default: 0 },
    round: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
    verdict: { type: String, default: null },
  },
  { collection: 'results', versionKey: false },
);

/**
 * @param {import('mongoose').Connection} conn
 */
export function getResultModel(conn) {
  return conn.models.Result || conn.model('Result', resultSchema);
}
