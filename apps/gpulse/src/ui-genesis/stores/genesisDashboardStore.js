import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchWallet, fetchEarnings, fetchNetwork, postClaim } from '../api/genesisApi.js';
import { safeFetch } from '../api/safeFetch.js';
import { FALLBACK_WALLET, FALLBACK_EARNINGS, FALLBACK_NETWORK } from '../api/dashboardFallbacks.js';
import { getDevMockBearer } from '../api/genesisConfig.js';
import { walletLoginWithSigner, siweLogout } from '../api/compensationClient.js';
import { executeNativeDeposit } from '../api/depositFlow.js';
import { normalizeUserAccess } from '../lib/userPermissions.js';

function resolveSessionToken(get) {
  return get().authToken || getDevMockBearer() || null;
}

function pushErr(errors, label, err) {
  const msg = err instanceof Error ? err.message : String(err);
  errors.push(`${label}: ${msg}`);
}

export const useGenesisDashboardStore = create(
  persist(
    (set, get) => ({
      authToken: null,
      /** Cookie session from SIWE (`/auth/verify`); use with `credentials: 'include'` */
      sessionAuth: false,

      wallet: null,
      earnings: null,
      network: null,

      /** Rol + permisos efectivos (API wallet o normalización por defecto). */
      userAccess: normalizeUserAccess(null),

      /** Dashboard fetch in flight */
      loading: false,
      /** Last dashboard / claim / deposit error message */
      error: null,

      claimLoading: null,
      depositLoading: false,
      lastClaimResult: null,

      setAuthToken: (t) => set({ authToken: t }),

      clearSession: () =>
        set({
          authToken: null,
          sessionAuth: false,
          wallet: null,
          earnings: null,
          network: null,
          userAccess: normalizeUserAccess(null),
          lastClaimResult: null,
          error: null,
        }),

      signIn: async (signer, address) => {
        const out = await walletLoginWithSigner({ address, signer });
        set({
          authToken: null,
          sessionAuth: Boolean(out.sessionAuth),
          error: null,
        });
        await get().loadDashboardData();
        return out;
      },

      signOut: async () => {
        await siweLogout();
        get().clearSession();
      },

      /**
       * Loads wallet, earnings, and network in parallel.
       * Uses safeFetch + fallbacks — never throws; API failures surface as `error` + `_fallback` data.
       */
      loadDashboardData: async () => {
        if (get().loading) return;
        const token = resolveSessionToken(get);
        const sessionOk = get().sessionAuth;
        if (!token && !sessionOk) {
          set({
            wallet: null,
            earnings: null,
            network: null,
            userAccess: normalizeUserAccess(null),
            error: null,
            loading: false,
          });
          return;
        }
        set({ loading: true, error: null });
        const syncErrors = [];

        const apiToken = token || null;
        const [wallet, earnings, network] = await Promise.all([
          safeFetch(() => fetchWallet(apiToken), FALLBACK_WALLET, (e) => pushErr(syncErrors, 'wallet', e)),
          safeFetch(() => fetchEarnings(apiToken), FALLBACK_EARNINGS, (e) =>
            pushErr(syncErrors, 'generated rewards', e),
          ),
          safeFetch(() => fetchNetwork(apiToken), FALLBACK_NETWORK, (e) => pushErr(syncErrors, 'network', e)),
        ]);

        const userAccess = normalizeUserAccess(
          wallet && typeof wallet === 'object'
            ? { role: wallet.role, permissions: wallet.permissions ?? wallet.userPermissions }
            : null,
        );

        set({
          wallet,
          earnings,
          network,
          userAccess,
          loading: false,
          error: syncErrors.length ? syncErrors.join(' · ') : null,
        });
      },

      /** @deprecated Use loadDashboardData */
      refreshAll: async () => get().loadDashboardData(),

      /**
       * @param {'direct' | 'mining' | 'binary'} type
       * @param {Record<string, unknown>} [extra]
       */
      claim: async (type, extra = {}) => {
        const token = resolveSessionToken(get);
        if (!token && !get().sessionAuth) {
          throw new Error('Sign in with your wallet or set VITE_DEV_MOCK_BEARER for dev API access');
        }
        set({ claimLoading: type, error: null });
        try {
          const data = await postClaim(token || null, type, extra);
          set({ lastClaimResult: data, claimLoading: null });
          await get().loadDashboardData();
          return data;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          set({ claimLoading: null, error: msg });
          throw e;
        }
      },

      /** On-chain deposit + verify-deposit */
      deposit: async ({ userAddress, amountEther, expectedChainId }) => {
        set({ depositLoading: true, error: null });
        try {
          const out = await executeNativeDeposit({ userAddress, amountEther, expectedChainId });
          set({ depositLoading: false });
          try {
            await get().loadDashboardData();
          } catch {
            /* ignore */
          }
          return out;
        } catch (e) {
          set({ depositLoading: false, error: String(e?.message || e) });
          throw e;
        }
      },

      /**
       * Simulated purchase / deposit for UI demos (no chain).
       * @returns {{ txHash: string }}
       */
      simulateDeposit: async ({ usdt }) => {
        set({ depositLoading: true, error: null });
        await new Promise((r) => setTimeout(r, 900));
        const hex = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        const txHash = `0x${hex}`;
        set({ depositLoading: false });
        try {
          await get().loadDashboardData();
        } catch {
          /* ignore */
        }
        return { txHash, usdt };
      },
    }),
    {
      name: 'genesis-ui-session',
      partialize: (s) => ({ authToken: s.authToken, sessionAuth: s.sessionAuth }),
    },
  ),
);
