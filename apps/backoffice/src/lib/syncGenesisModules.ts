import { useGenesisStore } from '@ai-genesis/state';
import {
  getNetworkData,
  getRecentActivity,
  getUserProfile,
  getWalletData,
  isCoreApiReachable,
} from '@/services/genesisApi';

/** Shared TTL so Dashboard / Wallet / Network reuse one fetch when navigating quickly. */
export const GENESIS_MODULES_STALE_MS = 45_000;

/**
 * Fetches Genesis dashboard slice (profile, wallet, network, activity) into Zustand.
 * Skips network I/O when data was synced recently unless `force` is true.
 */
export async function syncGenesisModules(opts?: { force?: boolean }): Promise<{
  ok: boolean;
  skipped?: boolean;
}> {
  const force = opts?.force ?? false;
  const state = useGenesisStore.getState();
  if (
    !force &&
    state.genesisModulesSyncedAt > 0 &&
    Date.now() - state.genesisModulesSyncedAt < GENESIS_MODULES_STALE_MS
  ) {
    return { ok: true, skipped: true };
  }

  const reachable = await isCoreApiReachable();
  if (!reachable) {
    return { ok: false };
  }

  const [profile, wallet, network, activity] = await Promise.all([
    getUserProfile(),
    getWalletData(),
    getNetworkData(),
    getRecentActivity(),
  ]);

  const snap = useGenesisStore.getState().wallet;
  const prevBal = useGenesisStore.getState().dashboard.user.balance;

  const address = wallet.address ?? profile.wallet ?? snap?.address ?? profile.id ?? null;
  const balance = wallet.balance ?? prevBal;

  const {
    setUserData,
    setWalletData,
    setNetworkData,
    setRecentActivity,
    setWallet,
    setGenesisModulesSyncedAt,
  } = useGenesisStore.getState();

  setUserData({
    id: profile.id,
    email: profile.email,
    wallet: address ?? undefined,
  });
  setWalletData({
    wallet: address ?? undefined,
    balance: balance ?? undefined,
  });
  setNetworkData({ networkStats: network });
  setRecentActivity(activity);

  if (address) {
    setWallet({
      address,
      chainId: wallet.chainId ?? snap?.chainId ?? null,
      connector: snap?.connector ?? null,
    });
  }

  setGenesisModulesSyncedAt(Date.now());
  return { ok: true };
}
