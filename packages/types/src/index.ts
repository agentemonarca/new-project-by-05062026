/**
 * Shared domain types for Ai Génesis (Backoffice 2.0) and satellite apps.
 */

export type SystemMode = 'NORMAL' | 'CAUTION' | 'PROTECTION' | 'MAINTENANCE' | string;

export interface GenesisUser {
  id?: string;
  email?: string;
  address?: string;
  displayName?: string;
  role?: string;
  [key: string]: unknown;
}

export interface WalletSnapshot {
  address: string | null;
  chainId?: number | null;
  connector?: string | null;
}

export interface AuthTokenPayload {
  token: string | null;
  expiresAt?: number;
}

export interface ExternalContextValue {
  user: GenesisUser | null;
  wallet: WalletSnapshot | null;
  token: string | null;
  isAuthenticated: boolean;
  systemMode: SystemMode;
}

export type {
  UserProfile,
  WalletData,
  NetworkData,
  ActivityItem,
  GenesisDashboardUserState,
} from './genesisDashboard.js';
