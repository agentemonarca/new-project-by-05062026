import { defaultServiceOrigins } from '@ai-genesis/config';

/** Core API base (browser). In dev, default to Vite proxy `/api/core` → core-api. */
export function getCoreApiBaseUrl(): string {
  const explicit = import.meta.env.VITE_CORE_API_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  if (import.meta.env.DEV) return '/api/core';
  return 'http://127.0.0.1:5050';
}

export function getEnv() {
  return {
    genesisOrigin: import.meta.env.VITE_GENESIS_URL ?? defaultServiceOrigins.genesis,
    gpulseOrigin: import.meta.env.VITE_GPULSE_URL ?? defaultServiceOrigins.gpulse,
    apiGatewayUrl: import.meta.env.VITE_API_GATEWAY_URL ?? defaultServiceOrigins.apiGateway,
    coreApiUrl: getCoreApiBaseUrl(),
    wsUrl: import.meta.env.VITE_WS_URL ?? '',
  };
}
