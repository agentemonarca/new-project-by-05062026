import { JsonRpcProvider } from 'ethers';

function parseRpcUrlList() {
  const multi = String(process.env.RPC_URLS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (multi.length > 0) return multi;
  const single = String(process.env.RPC_URL || '').trim();
  return single ? [single] : [];
}

/**
 * Multi-RPC: measure latency, pick fastest healthy endpoint.
 */
export function createRpcProviderPool({ logger } = {}) {
  const urls = parseRpcUrlList();
  if (urls.length === 0) throw new Error('ENV_MISSING_RPC_URL');

  const entries = urls.map((url) => ({
    url,
    provider: new JsonRpcProvider(url),
  }));

  async function measureOne(entry) {
    const t0 = Date.now();
    try {
      await entry.provider.getBlockNumber();
      return { ...entry, latencyMs: Date.now() - t0, ok: true };
    } catch (e) {
      logger?.warn?.('rpc_health_fail', { url: entry.url, message: e?.message });
      return { ...entry, latencyMs: null, ok: false };
    }
  }

  return {
    urls,
    getPrimaryProvider() {
      return entries[0].provider;
    },
    /** Use first URL provider without probe (signer bootstrap). */
    getDefaultProvider() {
      return entries[0].provider;
    },
    async pickFastestHealthyProvider() {
      if (entries.length === 1) {
        const r = await measureOne(entries[0]);
        if (!r.ok) throw new Error('RPC_UNREACHABLE');
        logger?.info?.('rpc_pool_single', { url: r.url, latencyMs: r.latencyMs });
        return r.provider;
      }
      const results = await Promise.all(entries.map((e) => measureOne(e)));
      const ok = results.filter((r) => r.ok).sort((a, b) => (a.latencyMs || 9e9) - (b.latencyMs || 9e9));
      if (ok.length === 0) throw new Error('RPC_POOL_UNREACHABLE');
      const best = ok[0];
      logger?.info?.('rpc_pool_selected', { url: best.url, latencyMs: best.latencyMs });
      return best.provider;
    },
  };
}
