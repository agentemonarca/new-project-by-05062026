import { ethers } from 'ethers';
import { fallbackDeterministicTxHex } from './gpulseRngPolicy.js';

/** Valid checksummed address; shown as mock user wallet */
export const MOCK_USER_ADDRESS = '0x71BE63F3384f5fb98995898A86B02Fb2426c9118';

/** Internal-only addresses for mock receipts (never read env / user config). */
export const MOCK_RECEIPT_USDT = '0x0000000000000000000000000000000000000001';
export const MOCK_RECEIPT_RECEIVER = '0x0000000000000000000000000000000000000002';

const DEFAULT_CHAIN_ID = 56n;

function envChainId() {
  const s = import.meta.env.VITE_CHAIN_ID;
  if (s == null || String(s).trim() === '') return DEFAULT_CHAIN_ID;
  try {
    return BigInt(String(s).trim());
  } catch {
    return DEFAULT_CHAIN_ID;
  }
}

/** Mutable emulator state (USDT 6 decimals raw) */
export const fakeState = {
  balance: 1000n * 10n ** 6n,
  nextTransferShouldFail: false,
};

const receiptByHash = new Map();

/** keccak256("Transfer(address,address,uint256)") — no runtime encode / AddressCoder in mock path */
const TRANSFER_TOPIC0 = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

function randomTxHash() {
  return '0x' + fallbackDeterministicTxHex(Date.now());
}

function addressToTopic32(addr) {
  const hex = (addr.startsWith('0x') ? addr.slice(2) : addr).toLowerCase();
  if (hex.length !== 40) {
    throw new Error('Invalid mock address length');
  }
  return '0x' + hex.padStart(64, '0');
}

function uint256ToData(value) {
  const h = value.toString(16);
  return '0x' + h.padStart(64, '0');
}

function buildTransferReceipt({ txHash, usdtContract, from, to, value }) {
  return {
    hash: txHash,
    transactionHash: txHash,
    status: 1,
    from,
    to: usdtContract,
    blockNumber: 12_345_678,
    logs: [
      {
        address: usdtContract,
        topics: [TRANSFER_TOPIC0, addressToTopic32(from), addressToTopic32(to)],
        data: uint256ToData(value),
      },
    ],
  };
}

/**
 * Read Transfer value from a mock receipt without ethers (for premium revalidation in mock).
 * @param {import('ethers').TransactionReceipt | { logs?: Array<{ address?: string, topics?: string[], data?: string }> }} receipt
 * @returns {bigint | null}
 */
export function parseMockTransferAmountFromReceipt(receipt) {
  if (!receipt?.logs?.length) return null;
  const wantToken = MOCK_RECEIPT_USDT.toLowerCase();
  const wantTo = MOCK_RECEIPT_RECEIVER.slice(2).toLowerCase();
  for (const log of receipt.logs) {
    const la = String(log.address ?? '').toLowerCase();
    if (la !== wantToken) continue;
    const topics = log.topics ?? [];
    if (String(topics[0] ?? '').toLowerCase() !== TRANSFER_TOPIC0) continue;
    const t2 = String(topics[2] ?? '');
    if (t2.length < 66) continue;
    const addrInTopic = t2.slice(-40).toLowerCase();
    if (addrInTopic !== wantTo) continue;
    const data = log.data;
    if (typeof data !== 'string' || data.length < 66) continue;
    try {
      return BigInt(data);
    } catch {
      continue;
    }
  }
  return null;
}

export const mockProvider = {
  __gpulseMock: true,
  async getNetwork() {
    return { chainId: envChainId() };
  },

  async getTransactionReceipt(hash) {
    const h = String(hash);
    const stored = receiptByHash.get(h);
    if (stored) return stored;
    return {
      hash: h,
      transactionHash: h,
      status: 1,
      logs: [],
      from: MOCK_USER_ADDRESS,
      to: null,
      blockNumber: null,
    };
  },
};

export function attachProviderToMockSigner(signer) {
  signer.provider = mockProvider;
  return signer;
}

export const mockSigner = attachProviderToMockSigner({
  async getAddress() {
    return MOCK_USER_ADDRESS;
  },
});

export async function mockTokenBalanceOf() {
  return fakeState.balance;
}

/**
 * Simulated ERC-20 transfer (payment path). No env/config addresses; no checksum validation.
 * @param {bigint} amount
 */
export async function mockTokenTransfer(amount) {
  if (fakeState.nextTransferShouldFail) {
    fakeState.nextTransferShouldFail = false;
    throw new Error('MOCK_TRANSACTION_FAILED');
  }
  if (fakeState.balance < amount) {
    throw new Error('INSUFFICIENT_BALANCE');
  }
  fakeState.balance -= amount;
  const txHash = randomTxHash();
  const from = await mockSigner.getAddress();
  const usdt = MOCK_RECEIPT_USDT;
  const to = MOCK_RECEIPT_RECEIVER;

  const receiptTemplate = buildTransferReceipt({
    txHash,
    usdtContract: usdt,
    from,
    to,
    value: amount,
  });

  const tx = {
    hash: txHash,
    async wait() {
      await new Promise((res) => setTimeout(res, 1200));
      const receipt = { ...receiptTemplate };
      receiptByHash.set(txHash, receipt);
      return receipt;
    },
  };
  return tx;
}

/**
 * Simulated withdraw: increases mock USDT balance, returns receipt.
 * @param {bigint} [amountRaw] — 6-decimal raw; default small test amount
 */
export async function mockWithdraw(amountRaw = 50n * 10n ** 6n) {
  fakeState.balance += amountRaw;
  const txHash = randomTxHash();
  const receipt = {
    hash: txHash,
    transactionHash: txHash,
    status: 1,
    logs: [],
    from: MOCK_USER_ADDRESS,
    to: MOCK_USER_ADDRESS,
    blockNumber: 12_345_680,
  };
  receiptByHash.set(txHash, receipt);
  await new Promise((res) => setTimeout(res, 450));
  return receipt;
}

export function mockAddBalance(usdtHuman = 500) {
  const raw = ethers.parseUnits(String(usdtHuman), 6);
  fakeState.balance += raw;
}

export function mockResetBalance() {
  fakeState.balance = 1000n * 10n ** 6n;
  fakeState.nextTransferShouldFail = false;
}

export function mockSimulateNextTransferFailure() {
  fakeState.nextTransferShouldFail = true;
}

export function mockClearReceipts() {
  receiptByHash.clear();
}

export function formatMockBalanceUsdt() {
  return ethers.formatUnits(fakeState.balance, 6);
}

/** @param {unknown} p */
export function isMockProvider(p) {
  return Boolean(p && typeof p === 'object' && p.__gpulseMock === true);
}
