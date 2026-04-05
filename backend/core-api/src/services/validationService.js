import { getAddress, isHexString } from 'ethers';

function mustGetEnv(name) {
  const v = String(process.env[name] || '').trim();
  if (!v) throw new Error(`ENV_MISSING_${name}`);
  return v;
}

let _masterWalletLogged = false;
let _masterWalletChecksum = null;
function getMasterWalletChecksum() {
  if (_masterWalletChecksum) return _masterWalletChecksum;
  const raw = mustGetEnv('MASTER_WALLET_ADDRESS');
  // Normalize once (checksum) to prevent malformed inputs.
  _masterWalletChecksum = getAddress(raw);
  if (!_masterWalletLogged) {
    _masterWalletLogged = true;
    console.info('MASTER WALLET:', _masterWalletChecksum);
  }
  return _masterWalletChecksum;
}

/**
 * Antifraud, on-chain validation for deposits.
 *
 * @param {object|null} tx - normalized or raw tx object (must include to/from/value)
 * @param {bigint} expectedAmount - expected minimum amount (wei) as BigInt
 * @param {string|null} expectedAddress - optional expected destination override
 */
export function validateDeposit(tx, expectedAmount, expectedAddress) {
  if (!tx) throw new Error('Transaction not found');

  const master =
    expectedAddress ? getAddress(String(expectedAddress)) : getMasterWalletChecksum();
  const to = tx?.to ? getAddress(String(tx.to)) : null;
  const from = tx?.from ? String(tx.from).toLowerCase() : '';

  if (!to || to !== master) throw new Error('Invalid destination');
  if (!from) throw new Error('Transaction not found');

  const txValue =
    typeof tx?.value === 'bigint'
      ? tx.value
      : typeof tx?.valueWei === 'bigint'
        ? tx.valueWei
        : typeof tx?.valueWei === 'string'
          ? BigInt(tx.valueWei)
          : typeof tx?.value === 'string'
            ? BigInt(tx.value)
            : 0n;

  if (txValue < expectedAmount) throw new Error('Insufficient amount');
  return true;
}

/**
 * @param {{ userAddress: string, txFrom: string, totalRaw: bigint, expectedMinRaw: bigint }} p
 */
export function validateErc20DepositAgainstMaster({ userAddress, txFrom, totalRaw, expectedMinRaw }) {
  const u = String(userAddress || '').toLowerCase();
  const f = String(txFrom || '').toLowerCase();
  if (!u || !f || f !== u) throw new Error('Transaction sender does not match user');
  if (typeof totalRaw !== 'bigint' || typeof expectedMinRaw !== 'bigint') throw new Error('Invalid amount');
  if (totalRaw < expectedMinRaw) throw new Error('Insufficient amount');
  return true;
}

export function createValidationService() {
  return {
    validateDepositBody(body) {
      const txHash = String(body?.txHash || '').trim();
      if (!txHash || !isHexString(txHash, 32)) {
        throw new Error('INVALID_TX_HASH');
      }

      const expectedAmountWeiRaw = body?.expectedAmountWei;
      const expectedAmountWei =
        expectedAmountWeiRaw === undefined || expectedAmountWeiRaw === null || expectedAmountWeiRaw === ''
          ? null
          : String(expectedAmountWeiRaw);

      if (expectedAmountWei !== null) {
        try {
          const n = BigInt(expectedAmountWei);
          if (n <= 0n) throw new Error('INVALID_EXPECTED_AMOUNT');
        } catch {
          throw new Error('INVALID_EXPECTED_AMOUNT');
        }
      }

      const expectedToRaw = body?.expectedTo;
      const expectedTo =
        expectedToRaw === undefined || expectedToRaw === null || expectedToRaw === ''
          ? null
          : getAddress(String(expectedToRaw));

      return { txHash, expectedAmountWei, expectedTo };
    },
  };
}

