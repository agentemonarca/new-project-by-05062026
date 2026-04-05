import { Wallet } from 'ethers';
import { createRpcProviderPool } from '../infra/rpcPool.js';

function mustGetEnv(name) {
  const v = String(process.env[name] || '').trim();
  if (!v) throw new Error(`ENV_MISSING_${name}`);
  return v;
}

/**
 * Backend signer (custody) — NEVER expose to frontend.
 * Supports RPC_URL or RPC_URLS (comma-separated) with runtime fastest-RPC selection on chain ops.
 */
export function createSignerService({ logger }) {
  const PRIVATE_KEY = mustGetEnv('PRIVATE_KEY');
  const pool = createRpcProviderPool({ logger });
  const provider = pool.getDefaultProvider();
  const wallet = new Wallet(PRIVATE_KEY, provider);

  logger.info('Backend signer initialized', {
    signerAddress: wallet.address,
    rpcEndpoints: pool.urls.length,
  });

  return {
    provider,
    wallet,
    rpcPool: pool,
    getAddress() {
      return wallet.address;
    },
  };
}
