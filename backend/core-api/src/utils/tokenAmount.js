import { formatUnits, parseEther, parseUnits } from 'ethers';

const MAX_PRINCIPAL_USDT = 1e12;

/**
 * Parse request "amount" field to wei (native, 18 decimals).
 * @param {string|number} amountHuman
 * @returns {bigint}
 */
export function parseNativeDepositAmountWei(amountHuman) {
  return parseEther(String(amountHuman));
}

/**
 * Parse ERC-20 deposit amount from human decimal string (e.g. USDT).
 * @param {string|number} amountHuman
 * @param {number} decimals
 * @returns {bigint}
 */
export function parseErc20DepositAmountRaw(amountHuman, decimals) {
  const d = Number(decimals);
  if (!Number.isInteger(d) || d < 0 || d > 36) throw new Error('INVALID_TOKEN_DECIMALS');
  return parseUnits(String(amountHuman), d);
}

/**
 * Convert on-chain received amount to principal number used by compensation (USDT notional, 8 dp cap).
 * Uses string math via formatUnits to avoid accidentally treating 6-decimal USDT as 18-decimal ether.
 *
 * @param {bigint} amountRawWei smallest unit from chain (native wei or token raw)
 * @param {{ asset: 'native' | 'erc20'; tokenDecimals: number }} opts
 * @returns {number}
 */
export function rawDepositToPrincipal(amountRawWei, opts) {
  if (typeof amountRawWei !== 'bigint' || amountRawWei <= 0n) throw new Error('INVALID_DEPOSIT_RAW');
  const decimals = opts.asset === 'erc20' ? opts.tokenDecimals : 18;
  const human = formatUnits(amountRawWei, decimals);
  const n = Number(human);
  if (!Number.isFinite(n) || n <= 0) throw new Error('INVALID_PRINCIPAL');
  if (n > MAX_PRINCIPAL_USDT) throw new Error('PRINCIPAL_CAP_EXCEEDED');
  return Math.round(n * 1e8) / 1e8;
}

/**
 * @returns {{ asset: 'native' | 'erc20'; tokenDecimals: number; tokenAddress: string | null }}
 */
export function getDepositAssetConfig() {
  const raw = String(process.env.DEPOSIT_ASSET || 'native').trim().toLowerCase();
  const asset = raw === 'erc20' ? 'erc20' : 'native';
  let tokenDecimals = asset === 'erc20' ? Number(process.env.DEPOSIT_TOKEN_DECIMALS ?? 6) : 18;
  if (!Number.isFinite(tokenDecimals)) tokenDecimals = asset === 'erc20' ? 6 : 18;
  tokenDecimals = Math.max(0, Math.min(36, tokenDecimals));
  const tokenAddress =
    asset === 'erc20' ? String(process.env.DEPOSIT_TOKEN_ADDRESS || '').trim().toLowerCase() : null;
  return { asset, tokenDecimals, tokenAddress };
}
