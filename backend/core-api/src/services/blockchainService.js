import * as ethers from 'ethers';

const TRANSFER_IFACE = new ethers.Interface([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

const RPC_URL = String(process.env.RPC_URL || '').trim();
const provider = RPC_URL ? new ethers.JsonRpcProvider(RPC_URL) : null;
const ALLOWED_CHAIN_ID = BigInt(process.env.CHAIN_ID || 1);

function requireProvider() {
  if (!provider) {
    const err = new Error('RPC_URL missing (set process.env.RPC_URL)');
    err.code = 'ENV_MISSING_RPC_URL';
    throw err;
  }
  return provider;
}

function normalizeBigInt(v) {
  return typeof v === 'bigint' ? v.toString() : null;
}

function normalizeTx(tx, chainId) {
  if (!tx) return null;
  return {
    hash: tx.hash,
    from: tx.from ? ethers.getAddress(tx.from) : null,
    to: tx.to ? ethers.getAddress(tx.to) : null,
    nonce: typeof tx.nonce === 'number' ? tx.nonce : null,
    valueWei: normalizeBigInt(tx.value ?? 0n),
    data: tx.data ?? null,
    chainId: chainId ? chainId.toString() : null,
  };
}

function normalizeReceipt(receipt, chainId) {
  if (!receipt) return null;
  return {
    transactionHash: receipt.hash,
    status: typeof receipt.status === 'number' ? receipt.status : null,
    blockNumber: typeof receipt.blockNumber === 'number' ? receipt.blockNumber : null,
    confirmations: typeof receipt.confirmations === 'number' ? receipt.confirmations : null,
    to: receipt.to ? ethers.getAddress(receipt.to) : null,
    from: receipt.from ? ethers.getAddress(receipt.from) : null,
    contractAddress: receipt.contractAddress ? ethers.getAddress(receipt.contractAddress) : null,
    chainId: chainId ? chainId.toString() : null,
  };
}

function assertExpectedNetwork(network) {
  const chainId = network?.chainId;
  if (chainId !== ALLOWED_CHAIN_ID) {
    console.warn('[blockchainService] Invalid network:', {
      expected: ALLOWED_CHAIN_ID?.toString?.() ?? String(ALLOWED_CHAIN_ID),
      got: chainId?.toString?.() ?? String(chainId),
    });
    throw new Error(`Invalid network: expected ${ALLOWED_CHAIN_ID}, got ${chainId}`);
  }
}

export async function getTransaction(txHash) {
  try {
    const p = requireProvider();
    const network = await p.getNetwork();
    assertExpectedNetwork(network);
    const tx = await p.getTransaction(txHash);
    return normalizeTx(tx, network?.chainId ?? null);
  } catch (err) {
    console.error('[blockchainService.getTransaction]', { message: err?.message, code: err?.code });
    throw err;
  }
}

export async function getTransactionReceipt(txHash) {
  try {
    const p = requireProvider();
    const network = await p.getNetwork();
    assertExpectedNetwork(network);
    const receipt = await p.getTransactionReceipt(txHash);
    return normalizeReceipt(receipt, network?.chainId ?? null);
  } catch (err) {
    console.error('[blockchainService.getTransactionReceipt]', { message: err?.message, code: err?.code });
    throw err;
  }
}

export async function waitForConfirmations(txHash, confirmations = 2) {
  try {
    const p = requireProvider();
    const network = await p.getNetwork();
    assertExpectedNetwork(network);
    const receipt = await p.waitForTransaction(txHash, confirmations);
    return normalizeReceipt(receipt, network?.chainId ?? null);
  } catch (err) {
    console.error('[blockchainService.waitForConfirmations]', { message: err?.message, code: err?.code });
    throw err;
  }
}

/**
 * Receipt with logs (for ERC-20 Transfer parsing). Not normalized.
 * @param {string} txHash
 * @returns {Promise<import('ethers').TransactionReceipt | null>}
 */
export async function getRawTransactionReceipt(txHash) {
  try {
    const p = requireProvider();
    const network = await p.getNetwork();
    assertExpectedNetwork(network);
    return await p.getTransactionReceipt(txHash);
  } catch (err) {
    console.error('[blockchainService.getRawTransactionReceipt]', { message: err?.message, code: err?.code });
    throw err;
  }
}

/**
 * Sum ERC-20 Transfer amounts to `recipientAddress` from `tokenAddress` in this tx.
 *
 * @param {{ txHash: string, tokenAddress: string, recipientAddress: string }} p
 * @returns {Promise<{ totalRaw: bigint, from: string | null }>}
 */
export async function sumErc20TransfersToRecipient({ txHash, tokenAddress, recipientAddress }) {
  const receipt = await getRawTransactionReceipt(txHash);
  if (!receipt || receipt.status !== 1) {
    const err = new Error('TX_FAILED');
    throw err;
  }
  const token = ethers.getAddress(String(tokenAddress));
  const to = ethers.getAddress(String(recipientAddress));
  let total = 0n;
  for (const log of receipt.logs) {
    if (!log.address) continue;
    try {
      if (ethers.getAddress(log.address) !== token) continue;
      const ev = TRANSFER_IFACE.parseLog({ topics: [...log.topics], data: log.data });
      if (ev.name !== 'Transfer') continue;
      if (ethers.getAddress(ev.args.to) !== to) continue;
      total += ev.args.value;
    } catch {
      /* not a transfer or wrong layout */
    }
  }
  return { totalRaw: total };
}

export async function getTransactionFromHash(txHash) {
  try {
    const p = requireProvider();
    const network = await p.getNetwork();
    assertExpectedNetwork(network);
    const tx = await p.getTransaction(txHash);
    if (!tx) return null;
    return {
      hash: tx.hash,
      from: tx.from ? ethers.getAddress(tx.from) : null,
      to: tx.to ? ethers.getAddress(tx.to) : null,
      valueWei: normalizeBigInt(tx.value ?? 0n),
    };
  } catch (err) {
    console.error('[blockchainService.getTransactionFromHash]', { message: err?.message, code: err?.code });
    throw err;
  }
}

