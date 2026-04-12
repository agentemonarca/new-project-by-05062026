import { getApiBaseUrl } from '../ui-genesis/api/genesisConfig.js';

export function isGpulseFullFlowEnabled() {
  return String(import.meta.env.VITE_GPULSE_FULL_FLOW ?? '').trim() === '1';
}

/** POST capture row to core-api (same JSON as backend when ADMIN_SIGNALS_FULL_FLOW=1). Fire-and-forget. */
export async function postFullFlowRow(row) {
  if (!isGpulseFullFlowEnabled()) return;
  const base = (getApiBaseUrl() || (typeof window !== 'undefined' ? window.location.origin : '')).replace(
    /\/$/,
    '',
  );
  if (!base) return;
  const adminKey = String(import.meta.env.VITE_GENESIS_ADMIN_API_KEY || '').trim();
  try {
    await fetch(`${base}/api/admin/signals/full-flow`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(adminKey ? { 'x-admin-api-key': adminKey } : {}),
      },
      body: JSON.stringify(row),
    });
  } catch {
    /* dev-only; console logs still hold truth */
  }
}
