import { useMemo } from 'react';
import { useExternalSignalsStore } from '@/ui-genesis/stores/externalSignalsStore.js';

/**
 * Maps settled rows (NEW_SIGNAL + NEW_RESULT) to cycle view models. No partial cycles.
 */
export function mapHistoryToCycles(history) {
  const list = Array.isArray(history) ? history : [];
  return list.map((row) => {
    const rawSig = row.rawSignal && typeof row.rawSignal === 'object' ? row.rawSignal : {};
    const rawRes = row.rawResult && typeof row.rawResult === 'object' ? row.rawResult : {};
    const won = row.status === 'won';
    const lost = row.status === 'lost';
    return {
      cycleId: row.id,
      mesa: String(row.mesa ?? '—'),
      round: String(row.round ?? '—'),
      signal: row.recommendation,
      martingale: Number(row.martingale) || 0,
      status: won ? 'WIN' : lost ? 'LOSS' : 'UNKNOWN',
      startedAt: row.receivedAt,
      settledAt: row.settledAt,
      result: row.winStatus,
      rawEvents: [
        { type: 'NEW_SIGNAL', at: row.receivedAt, payload: rawSig },
        { type: 'NEW_RESULT', at: row.settledAt ?? row.receivedAt, payload: rawRes },
      ],
      fullRawBundle: { signal: rawSig, result: rawRes },
    };
  });
}

export function useSignalCycles() {
  const history = useExternalSignalsStore((s) => s.history);
  const connectionStatus = useExternalSignalsStore((s) => s.connectionStatus);
  const lastError = useExternalSignalsStore((s) => s.lastError);

  const cycles = useMemo(() => mapHistoryToCycles(history), [history]);

  return { cycles, connectionStatus, lastError };
}
