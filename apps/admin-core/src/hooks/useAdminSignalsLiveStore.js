import { useSyncExternalStore } from 'react';
import {
  getAdminSignalsLiveServerSnapshot,
  getAdminSignalsLiveSnapshot,
  subscribeAdminSignalsLive,
} from '@/realtime/adminSignalsLiveStore.js';

/**
 * Suscripción al store único de señales/resultados en vivo (mismo que VistaLab).
 * No crea estado nuevo: solo `useSyncExternalStore` sobre `adminSignalsLiveStore`.
 */
export function useAdminSignalsLiveStore() {
  return useSyncExternalStore(subscribeAdminSignalsLive, getAdminSignalsLiveSnapshot, getAdminSignalsLiveServerSnapshot);
}
