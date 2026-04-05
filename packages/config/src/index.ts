/**
 * Environment and design tokens (browser-safe).
 */

export const designTokens = {
  colors: {
    bg: '#070b14',
    secondary: '#0b0f1a',
    cyan: '#00f0ff',
    magenta: '#ff00c8',
    purple: '#7b2cff',
    white: '#f4f7ff',
    muted: 'rgba(244, 247, 255, 0.55)',
  },
  radii: {
    card: '16px',
    pill: '9999px',
  },
  blur: {
    glass: '22px',
  },
} as const;

export type DesignTokens = typeof designTokens;

/** Default iframe / API origins (override per app via Vite env). */
export const defaultServiceOrigins = {
  genesis: 'http://localhost:3000',
  gpulse: 'http://localhost:5174',
  apiGateway: 'http://localhost:4000',
} as const;

export { STORAGE_KEYS, LEGACY_TOKEN_KEYS, LEGACY_USER_KEYS } from './storageKeys.js';
export type { StorageKeyName } from './storageKeys.js';
export {
  MessageType,
  MESSAGE_SOURCE_BACKOFFICE,
  MESSAGE_SOURCE_GPULSE,
} from './postMessage.js';
export type { MessageTypeName } from './postMessage.js';
