/**
 * Genesis dashboard domain (Backoffice native UI; data from core-api + derived metrics).
 */

export interface UserProfile {
  id: string | null;
  email?: string;
  wallet?: string | null;
  displayName?: string;
  /** Present when core-api resolved a wallet session. */
  authenticated?: boolean;
}

export interface WalletData {
  address: string | null;
  balance: number | null;
  chainId?: number | null;
}

export interface NetworkData {
  referrals: number;
  volume: number;
  rank: string;
}

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  timestamp: number;
  amountWei?: string;
}

/** Zustand dashboard slice: mirrors the “user domain” fields from the Phase 5 spec. */
export interface GenesisDashboardUserState {
  id: string | null;
  email?: string;
  wallet?: string;
  balance?: number;
  networkStats?: NetworkData;
}
