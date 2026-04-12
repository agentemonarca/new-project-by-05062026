import { useShallow } from 'zustand/react/shallow';
import { useExternalSignalsStore } from '../ui-genesis/stores/externalSignalsStore.js';
import { extractProviderSignalAlgorithmName } from '../ui-genesis/lib/externalSignalsTypes.js';

/**
 * Estado compacto para UI: conexión relay + última señal / nombre algoritmo (App + Genesis dashboard).
 */
export function useProviderRelayUi() {
  return useExternalSignalsStore(
    useShallow((s) => {
      const hist = s.history;
      const act = s.activeSignals;
      const latest =
        Array.isArray(act) && act.length
          ? act[act.length - 1]
          : Array.isArray(hist) && hist[0]
            ? hist[0]
            : null;
      const rawSig = latest?.rawSignal;
      const nameFromRow =
        latest?.algorithmDisplayName != null && String(latest.algorithmDisplayName).trim() !== ''
          ? String(latest.algorithmDisplayName).trim()
          : '';
      const signalAlgorithmName =
        nameFromRow || (rawSig && typeof rawSig === 'object' ? extractProviderSignalAlgorithmName(rawSig) : '');
      return {
        connectionStatus: s.connectionStatus,
        lastError: s.lastError,
        n: act.length + hist.length,
        latest,
        signalAlgorithmName,
      };
    }),
  );
}
