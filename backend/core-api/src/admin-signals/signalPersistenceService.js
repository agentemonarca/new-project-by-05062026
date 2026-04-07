import { getDbConnection, isGenesisMongoReady } from '../db/connectBridge.js';
import {
  getSignalModelsForConnection,
  SIGNAL_CONFIG_KEY,
  SIGNAL_METRICS_KEY,
} from './db/signalMongoModels.js';
import { capRawPayload, extractProviderTimestamp } from './db/signalPayloadSanitize.js';
import { patchAdminSignalsRuntime, getPublicConfigFromRuntime } from './runtimeConfig.js';
import { adminSignalsFlowTrace } from './signalFlowDebug.js';

function genesisModels() {
  if (!isGenesisMongoReady()) return null;
  return getSignalModelsForConnection(getDbConnection('genesis'));
}

function runHook(p) {
  if (!p) return;
  Promise.resolve(p()).catch(() => {});
}

/**
 * @param {{ logger?: { warn?: Function, info?: Function } }} ctx
 */
export function createSignalPersistence({ logger } = {}) {
  return {
    isReady() {
      return isGenesisMongoReady();
    },

    async bootstrapRuntimeFromDb() {
      const M = genesisModels();
      if (!M) {
        logger?.info?.('signal_persistence_skip_bootstrap', { reason: 'mongo_not_ready' });
        return;
      }
      try {
        const doc = await M.SignalConfig.findOne({ key: SIGNAL_CONFIG_KEY }).lean();
        if (!doc) return;
        patchAdminSignalsRuntime({
          enabled: doc.upstreamEnabled,
          visibilityEnabled: doc.showSignalsToUsers,
          showSignalsToUsers: doc.showSignalsToUsers,
          delayMs: doc.artificialDelayMs,
          artificialDelayMs: doc.artificialDelayMs,
          martingaleDelta: doc.martingaleDelta,
          filters: doc.filters || { mesa: '' },
        });
        const { hydrateAutoResponseFromDbDoc } = await import('./signalAutoResponseService.js');
        hydrateAutoResponseFromDbDoc(doc);
        logger?.info?.('signal_config_bootstrapped');
      } catch (e) {
        logger?.warn?.('signal_config_bootstrap_failed', { message: e?.message });
      }
    },

    /** Refresca runtime desde Mongo (GET config multi-instancia). */
    async reloadConfigToRuntime() {
      await this.bootstrapRuntimeFromDb();
    },

    async persistRuntimeConfigToDb() {
      const M = genesisModels();
      if (!M) return;
      const c = getPublicConfigFromRuntime();
      try {
        await M.SignalConfig.findOneAndUpdate(
          { key: SIGNAL_CONFIG_KEY },
          {
            $set: {
              showSignalsToUsers: c.showSignalsToUsers,
              artificialDelayMs: c.artificialDelayMs,
              martingaleDelta: c.martingaleDelta,
              filters: { mesa: c.filters?.mesa ?? '' },
              upstreamEnabled: c.upstreamEnabled,
              updatedAt: new Date(),
            },
          },
          { upsert: true },
        );
      } catch (e) {
        logger?.warn?.('signal_config_save_failed', { message: e?.message });
      }
    },

    async persistAutoResponseToDb() {
      const M = genesisModels();
      if (!M) return;
      try {
        const { getAutoResponseMongoSlice } = await import('./signalAutoResponseService.js');
        await M.SignalConfig.findOneAndUpdate(
          { key: SIGNAL_CONFIG_KEY },
          {
            $set: {
              ...getAutoResponseMongoSlice(),
              updatedAt: new Date(),
            },
          },
          { upsert: true },
        );
      } catch (e) {
        logger?.warn?.('signal_auto_response_save_failed', { message: e?.message });
      }
    },

    async getMetricsFromDb() {
      const M = genesisModels();
      if (!M) {
        return {
          wins: 0,
          losses: 0,
          correlationMiss: 0,
          avgLatency: null,
          totalSignals: 0,
          source: 'memory',
        };
      }
      const m = await M.SignalMetrics.findOne({ key: SIGNAL_METRICS_KEY }).lean();
      if (!m) {
        return {
          wins: 0,
          losses: 0,
          correlationMiss: 0,
          avgLatency: null,
          totalSignals: 0,
          source: 'mongo',
        };
      }
      const avgLatency =
        m.latencyCount > 0 ? Math.round(m.latencySumMs / m.latencyCount) : null;
      return {
        wins: m.wins,
        losses: m.losses,
        correlationMiss: m.correlationMiss,
        avgLatency,
        totalSignals: m.totalSignals,
        source: 'mongo',
      };
    },

    async resetMetricsInDb() {
      const M = genesisModels();
      if (!M) return;
      await M.SignalMetrics.findOneAndUpdate(
        { key: SIGNAL_METRICS_KEY },
        {
          $set: {
            wins: 0,
            losses: 0,
            correlationMiss: 0,
            totalSignals: 0,
            latencySumMs: 0,
            latencyCount: 0,
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );
    },

    getProcessorHooks() {
      const svc = this;
      return {
        onSignalIngested(row, n) {
          runHook(() => svc._persistNewSignal(row, n));
        },
        onResultSettled(settled, latencyMs, r) {
          runHook(() => svc._persistSettled(settled, latencyMs, r));
        },
        onCorrelationMiss(r) {
          runHook(() => svc._persistMiss(r));
        },
      };
    },

    async _persistNewSignal(row, n) {
      const M = genesisModels();
      if (!M) {
        adminSignalsFlowTrace(logger, 'mongo_persist_skip', {
          op: 'NEW_SIGNAL',
          reason: 'genesis_mongo_not_ready',
          correlationKey: row.correlationKey,
        });
        return;
      }
      const rawSource = n && typeof n === 'object' && n.raw != null ? n.raw : n;
      const rawPayload = capRawPayload(rawSource);
      const providerTimestamp = extractProviderTimestamp(
        rawSource && typeof rawSource === 'object' ? rawSource : null,
      );
      try {
        await M.SignalEvent.create({
          type: 'NEW_SIGNAL',
          correlationKey: row.correlationKey || '',
          mesa: row.mesa || '',
          round: String(row.round ?? ''),
          recommendation: row.recommendation ?? null,
          martingale: Number(row.martingale) || 0,
          result: null,
          latencyMs: null,
          latency: null,
          providerTimestamp,
          serverTimestamp: new Date(),
          rawPayload,
          correlationMiss: false,
          ingressKind: 'signal',
        });
        await M.SignalMetrics.findOneAndUpdate(
          { key: SIGNAL_METRICS_KEY },
          { $inc: { totalSignals: 1 }, $set: { updatedAt: new Date() } },
          { upsert: true },
        );
        adminSignalsFlowTrace(logger, 'mongo_signal_event_inserted', {
          correlationKey: row.correlationKey,
          mesa: row.mesa,
        });
      } catch (e) {
        if (e && Number(e.code) === 11000) {
          logger?.warn?.('signal_event_duplicate_open', { key: row.correlationKey });
          adminSignalsFlowTrace(logger, 'mongo_signal_event_duplicate', { correlationKey: row.correlationKey });
          return;
        }
        logger?.warn?.('signal_event_signal_failed', { message: e?.message });
        adminSignalsFlowTrace(logger, 'mongo_signal_event_failed', {
          correlationKey: row.correlationKey,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    },

    async _persistSettled(settled, latencyMs, r) {
      const M = genesisModels();
      if (!M) {
        adminSignalsFlowTrace(logger, 'mongo_persist_skip', {
          op: 'NEW_RESULT',
          reason: 'genesis_mongo_not_ready',
          correlationKey: settled.correlationKey,
        });
        return;
      }
      const result = settled.winStatus ? 'win' : 'loss';
      const rawResultPayload = capRawPayload(r && typeof r === 'object' ? r.raw : r);
      const now = new Date();
      try {
        let updatedOpen = false;
        const open = await M.SignalEvent.findOne({
          correlationKey: settled.correlationKey || '',
          type: 'NEW_SIGNAL',
          correlationMiss: false,
          $or: [{ result: null }, { result: { $exists: false } }],
        }).sort({ createdAt: -1 });

        if (open) {
          updatedOpen = true;
          open.type = 'NEW_RESULT';
          open.result = result;
          open.latencyMs = latencyMs;
          open.latency = latencyMs;
          open.serverSettledAt = now;
          open.serverTimestamp = now;
          if (rawResultPayload) open.rawResultPayload = rawResultPayload;
          if (settled.recommendation != null) open.recommendation = settled.recommendation;
          await open.save();
        } else {
          await M.SignalEvent.create({
            type: 'NEW_RESULT',
            correlationKey: settled.correlationKey || '',
            mesa: settled.mesa || '',
            round: String(settled.round ?? ''),
            recommendation: settled.recommendation ?? null,
            martingale: Number(settled.martingale) || 0,
            result,
            latencyMs,
            latency: latencyMs,
            providerTimestamp: null,
            serverTimestamp: now,
            serverSettledAt: now,
            rawResultPayload,
            correlationMiss: false,
            rawPayload: null,
            ingressKind: 'orphan_settled',
          });
        }

        const inc = settled.winStatus ? { wins: 1 } : { losses: 1 };
        await M.SignalMetrics.findOneAndUpdate(
          { key: SIGNAL_METRICS_KEY },
          {
            $inc: {
              ...inc,
              latencySumMs: latencyMs,
              latencyCount: 1,
            },
            $set: { updatedAt: new Date() },
          },
          { upsert: true },
        );
        adminSignalsFlowTrace(logger, 'mongo_result_persisted', {
          correlationKey: settled.correlationKey,
          updatedOpen,
          result,
        });
      } catch (e) {
        logger?.warn?.('signal_event_result_failed', { message: e?.message });
        adminSignalsFlowTrace(logger, 'mongo_result_persist_failed', {
          correlationKey: settled.correlationKey,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    },

    async _persistMiss(r) {
      const M = genesisModels();
      if (!M) return;
      try {
        await M.SignalEvent.create({
          type: 'NEW_RESULT',
          correlationKey: r.correlationKey || '',
          mesa: r.mesa || '',
          round: r.round != null ? String(r.round) : '',
          recommendation: null,
          martingale: 0,
          result: null,
          latencyMs: null,
          latency: null,
          providerTimestamp: null,
          serverTimestamp: new Date(),
          serverSettledAt: null,
          rawResultPayload: capRawPayload(r && typeof r === 'object' ? r.raw : r),
          correlationMiss: true,
          rawPayload: null,
          ingressKind: 'correlation_miss',
        });
        await M.SignalMetrics.findOneAndUpdate(
          { key: SIGNAL_METRICS_KEY },
          { $inc: { correlationMiss: 1 }, $set: { updatedAt: new Date() } },
          { upsert: true },
        );
      } catch (e) {
        logger?.warn?.('signal_event_miss_failed', { message: e?.message });
      }
    },
  };
}
