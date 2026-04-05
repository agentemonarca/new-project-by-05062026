import { useMemo } from 'react';
import { SEED_LOCAL_MERCHANTS } from './mockMerchants.js';
import { useLocalMerchantDirectoryStore } from '../stores/localMerchantDirectoryStore.js';

/** Seed demos + user-created stores (for map, list, filters). */
export function useMergedLocalMerchants() {
  const userMerchants = useLocalMerchantDirectoryStore((s) => s.userMerchants);
  return useMemo(() => [...SEED_LOCAL_MERCHANTS, ...userMerchants], [userMerchants]);
}
