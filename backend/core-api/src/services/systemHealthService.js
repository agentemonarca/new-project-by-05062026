import { getTxMetricsStats } from './txMetricsStore.js';
import { countPendingPipelineWithdrawals } from '../utils/withdrawalStore.js';

const BASELINE_CONFIRM_MS = 45000;
const PENDING_HIGH = 12;
const PENDING_BACKEND_LAG = 20;

/**
 * Measure JSON-RPC round-trip latency (ms). Returns null if unreachable.
 */
async function measureRpcLatencyMs(provider) {
  if (!provider?.getBlockNumber) return null;
  const t0 = Date.now();
  try {
    await provider.getBlockNumber();
    return Date.now() - t0;
  } catch {
    return null;
  }
}

/**
 * Derive composite system health from live signals (no hardcoded “always healthy”).
 */
export async function computeSystemHealth({ signerService, txMetrics = getTxMetricsStats } = {}) {
  const provider = signerService?.provider || null;
  const rpcLatencyMs = await measureRpcLatencyMs(provider);

  const { failureRate, avgConfirmationMs, sampleSize } = txMetrics();
  let pendingPipeline = 0;
  try {
    pendingPipeline = await countPendingPipelineWithdrawals();
  } catch {
    pendingPipeline = 0;
  }

  const rpcOk = rpcLatencyMs != null;

  let network = 'offline';
  if (rpcOk) {
    if (rpcLatencyMs < 500) network = 'healthy';
    else if (rpcLatencyMs <= 1500) network = 'degraded';
    else network = 'degraded';
  }

  let signer = 'error';
  if (signerService?.wallet && rpcOk) {
    if (rpcLatencyMs > 1200) signer = 'delayed';
    else signer = 'ready';
  } else if (signerService?.wallet && !rpcOk) {
    signer = 'error';
  }

  let mempool = 'normal';
  if (rpcOk && avgConfirmationMs != null && avgConfirmationMs > BASELINE_CONFIRM_MS) {
    mempool = 'congested';
  }
  if (pendingPipeline > PENDING_HIGH) mempool = 'congested';

  let backend = 'synced';
  if (pendingPipeline > PENDING_BACKEND_LAG) backend = 'lagging';

  let riskLevel = 'low';
  if (
    !rpcOk ||
    failureRate > 0.15 ||
    (sampleSize >= 5 && failureRate > 0.12) ||
    (rpcLatencyMs != null && rpcLatencyMs > 1500)
  ) {
    riskLevel = 'high';
  } else if (
    failureRate > 0.05 ||
    (rpcLatencyMs != null && rpcLatencyMs >= 500 && rpcLatencyMs <= 1500) ||
    mempool === 'congested' ||
    signer === 'delayed' ||
    backend === 'lagging'
  ) {
    riskLevel = 'medium';
  }

  return {
    network,
    signer,
    mempool,
    backend,
    riskLevel,
    _meta: {
      rpcLatencyMs,
      sampleSize,
      failureRate,
      avgConfirmationMs,
      pendingPipeline,
    },
  };
}
