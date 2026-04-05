import { STORAGE_KEYS } from '@ai-genesis/config';
import type { ActivityItem, NetworkData, UserProfile, WalletData } from '@ai-genesis/types';
import { getCoreApiBaseUrl } from '@/config/env';

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = { Accept: 'application/json' };
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.TOKEN) : null;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* ignore */
  }
  return headers;
}

async function coreFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = getCoreApiBaseUrl();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  return fetch(url, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers as Record<string, string>) },
  });
}

/** True when core-api responds on `/health` (via same base as other calls). */
export async function isCoreApiReachable(): Promise<boolean> {
  try {
    const r = await coreFetch('/health', { method: 'GET' });
    return r.ok;
  } catch {
    return false;
  }
}

function readStoredAuthUserJson(): Record<string, unknown> | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.USER) : null;
    if (!raw) return null;
    const j = JSON.parse(raw) as unknown;
    return j && typeof j === 'object' && !Array.isArray(j) ? (j as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function mergeProfileFromStorage(api: UserProfile): UserProfile {
  const local = readStoredAuthUserJson();
  if (!local) return api;
  const id =
    api.id ??
    (typeof local.id === 'string' ? local.id : null) ??
    (typeof local.address === 'string' ? local.address : null);
  const email = api.email ?? (typeof local.email === 'string' ? local.email : undefined);
  const wallet =
    api.wallet ??
    (typeof local.address === 'string' ? local.address : undefined) ??
    (typeof local.wallet === 'string' ? local.wallet : null);
  const displayName =
    api.displayName ?? (typeof local.displayName === 'string' ? local.displayName : undefined);
  return {
    ...api,
    id,
    email,
    wallet: wallet ?? null,
    displayName,
    authenticated: api.authenticated,
  };
}

/**
 * User profile from core-api session + local auth snapshot (bridge / dev token).
 */
export async function getUserProfile(): Promise<UserProfile> {
  let api: UserProfile = {
    id: null,
    authenticated: false,
  };
  try {
    const res = await coreFetch('/genesis/profile');
    if (res.ok) {
      const j = (await res.json()) as Record<string, unknown>;
      api = {
        id: typeof j.id === 'string' ? j.id : j.id === null ? null : null,
        email: typeof j.email === 'string' ? j.email : undefined,
        wallet: typeof j.wallet === 'string' ? j.wallet : j.wallet === null ? null : null,
        displayName: typeof j.displayName === 'string' ? j.displayName : undefined,
        authenticated: Boolean(j.authenticated),
      };
    }
  } catch {
    /* network */
  }
  return mergeProfileFromStorage(api);
}

/**
 * Wallet balance for authenticated core session; otherwise null fields.
 */
export async function getWalletData(): Promise<WalletData> {
  try {
    const res = await coreFetch('/genesis/wallet');
    if (!res.ok) {
      return { address: null, balance: null, chainId: null };
    }
    const j = (await res.json()) as Record<string, unknown>;
    if (j.error) {
      return { address: null, balance: null, chainId: null };
    }
    const address = typeof j.address === 'string' ? j.address : j.address === null ? null : null;
    const balance =
      j.balance == null || !Number.isFinite(Number(j.balance)) ? null : Number(j.balance);
    const chainId =
      j.chainId == null || !Number.isFinite(Number(j.chainId)) ? null : Number(j.chainId);
    return { address, balance, chainId };
  } catch {
    return { address: null, balance: null, chainId: null };
  }
}

function parseNetworkHealth(j: Record<string, unknown>): Pick<NetworkData, 'rank'> {
  const risk = typeof j.riskLevel === 'string' ? j.riskLevel : 'unknown';
  return { rank: risk.toUpperCase() };
}

function parseQueueStats(j: Record<string, unknown>): Pick<NetworkData, 'referrals' | 'volume'> {
  const completed = Number(j.completed);
  const waiting = Number(j.waiting);
  const active = Number(j.active);
  return {
    referrals: Number.isFinite(completed) ? completed : 0,
    volume: (Number.isFinite(waiting) ? waiting : 0) + (Number.isFinite(active) ? active : 0),
  };
}

/**
 * Public core metrics: system health + queue stats (no auth).
 */
export async function getNetworkData(): Promise<NetworkData> {
  try {
    const [hRes, qRes] = await Promise.all([
      coreFetch('/system/health'),
      coreFetch('/system/queue-stats'),
    ]);
    let rank = '—';
    let referrals = 0;
    let volume = 0;
    if (hRes.ok) {
      const h = (await hRes.json()) as Record<string, unknown>;
      rank = parseNetworkHealth(h).rank;
    }
    if (qRes.ok) {
      const q = (await qRes.json()) as Record<string, unknown>;
      const pq = parseQueueStats(q);
      referrals = pq.referrals;
      volume = pq.volume;
      const scale = typeof q.scaleSignal === 'string' ? q.scaleSignal : '';
      if (scale) rank = `${rank} · ${scale}`.replace(/^·\s*/, '');
    }
    return { referrals, volume, rank };
  } catch {
    return { referrals: 0, volume: 0, rank: '—' };
  }
}

function isActivityItem(x: unknown): x is ActivityItem {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.type === 'string' &&
    typeof o.title === 'string' &&
    typeof o.timestamp === 'number'
  );
}

/**
 * Recent ledger activity for authenticated core session.
 */
export async function getRecentActivity(): Promise<ActivityItem[]> {
  try {
    const res = await coreFetch('/genesis/activity');
    if (!res.ok) return [];
    const j = await res.json();
    if (!Array.isArray(j)) return [];
    return j.filter(isActivityItem);
  } catch {
    return [];
  }
}
