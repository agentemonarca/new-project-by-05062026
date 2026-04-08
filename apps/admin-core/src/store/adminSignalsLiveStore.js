import { useSyncExternalStore } from 'react';
import {
  adminSignalsPredictionByMesa,
  adminSignalsPushDebugLog,
  getAdminSignalsLiveServerSnapshot,
  getAdminSignalsLiveSnapshot,
  subscribeAdminSignalsLive,
} from '../realtime/adminSignalsLiveStore.js';

export {
  adminSignalsPredictionByMesa,
  adminSignalsPushDebugLog,
  getAdminSignalsLiveServerSnapshot,
  getAdminSignalsLiveSnapshot,
  subscribeAdminSignalsLive,
} from '../realtime/adminSignalsLiveStore.js';

/**
 * Mismo snapshot que VistaLab (`useSyncExternalStore` + bridge único). Sin store nuevo.
 */
export function useAdminSignalsLiveStore() {
  return useSyncExternalStore(subscribeAdminSignalsLive, getAdminSignalsLiveSnapshot, getAdminSignalsLiveServerSnapshot);
}
