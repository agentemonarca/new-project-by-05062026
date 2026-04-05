import { getAddress } from 'ethers';
import { getTransaction, getTransactionReceipt, waitForConfirmations } from './blockchainService.js';

function mustGetEnv(name) {
  const v = String(process.env[name] || '').trim();
  if (!v) throw new Error(`ENV_MISSING_${name}`);
  return v;
}

export function createDepositVerificationService({ logger }) {
  const resolveMasterWalletAddress = () => getAddress(mustGetEnv('MASTER_WALLET_ADDRESS'));

  return {
    async verifyDeposit({ txHash, expectedAmountWei, expectedTo, confirmations = 2 }) {
      const MASTER_WALLET_ADDRESS = resolveMasterWalletAddress();
      const receipt = await waitForConfirmations(txHash, confirmations);
      if (!receipt) throw new Error('TX_NOT_FOUND');
      if (receipt.status !== 1) throw new Error('TX_FAILED');

      const tx = await getTransaction(txHash);
      if (!tx) throw new Error('TX_NOT_FOUND');

      const to = tx.to ? getAddress(tx.to) : null;
      const expectedDestination = expectedTo || MASTER_WALLET_ADDRESS;
      if (!to || to !== expectedDestination) throw new Error('INVALID_DESTINATION');

      const valueWei = BigInt(tx.valueWei || '0');
      if (expectedAmountWei) {
        const expected = BigInt(expectedAmountWei);
        if (valueWei < expected) throw new Error('INVALID_AMOUNT');
      }

      // Optional: receipt confirmation already implicit in waitForConfirmations
      logger.info('Deposit verified', {
        txHash,
        chainId: receipt.chainId,
        to,
        valueWei: String(valueWei),
        blockNumber: receipt.blockNumber,
        confirmations: receipt.confirmations,
      });

      return {
        txHash,
        chainId: receipt.chainId,
        to,
        valueWei: String(valueWei),
        blockNumber: receipt.blockNumber,
        confirmations: receipt.confirmations,
        masterWalletAddress: MASTER_WALLET_ADDRESS,
      };
    },
  };
}

