import { useCallback } from 'react';
import { useExternalSignalsStore } from '../stores/externalSignalsStore.js';

/**
 * Placeholder AutoPlay: lectura del último id activo en store; sin ejecución de apuestas.
 *
 * @returns {{
 *   executeSignal: (signal: object) => Promise<{ ok: boolean, reason: string, signal: object }>,
 *   lastActiveId: string | null,
 * }}
 */
export function useSignalExecution() {
  const lastActiveId = useExternalSignalsStore((s) => {
    const list = s.activeSignals;
    return list.length ? list[list.length - 1]?.id ?? null : null;
  });

  const executeSignal = useCallback(async (signal) => {
    return {
      ok: false,
      reason: 'autoplay_not_enabled',
      signal: signal && typeof signal === 'object' ? signal : {},
    };
  }, []);

  return { executeSignal, lastActiveId };
}
