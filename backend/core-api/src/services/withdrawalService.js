import { getBalanceWei } from '../utils/balanceStore.js';

export function createWithdrawalService() {
  return {
    async getBalanceWei(userAddress) {
      return await getBalanceWei(userAddress);
    },
  };
}

