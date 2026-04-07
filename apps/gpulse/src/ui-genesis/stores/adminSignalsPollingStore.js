import { create } from 'zustand';

/**
 * Estado unificado del polling admin signals (stats, metrics, analytics, alerts).
 */
export const useAdminSignalsPollingStore = create((set) => ({
  loading: false,
  /** Tras 401: no más requests hasta reanudar explícitamente o login OK en /config. */
  pollingStopped: false,
  /** Incrementado en `resumePolling` para reiniciar el efecto del hook. */
  resumeToken: 0,

  lastPollAt: null,
  /** Último intervalo programado tras backoff / Retry-After (ms). */
  scheduledAfterMs: null,

  serverStats: null,
  serverMetrics: null,
  serverPairError: null,

  analytics: null,
  analyticsError: null,

  alerts: [],
  alertsMongoReady: true,
  alertsError: null,

  /** Histórico multi-día (GET …/alerts-daily) — mismo ciclo que el polling unificado. */
  alertsDaily: [],
  alertsDailyFromDate: '',
  alertsDailyToDate: '',
  alertsDailyError: null,
  alertsDailyMongoReady: true,
  /** Primer lote alerts-daily recibido (para UI histórica). */
  alertsDailySnapshotAt: null,

  /** Error agregado (p.ej. red). */
  pollError: null,

  /** Incrementar para forzar un ciclo inmediato del hook de polling. */
  pollKick: 0,

  setPollingStopped: (v) => set({ pollingStopped: Boolean(v) }),

  requestPollKick: () => set((s) => ({ pollKick: s.pollKick + 1 })),

  resumePolling: () =>
    set((s) => ({
      pollingStopped: false,
      pollError: null,
      resumeToken: s.resumeToken + 1,
    })),

  /**
   * @param {{
   *   serverStats?: object | null,
   *   serverMetrics?: object | null,
   *   serverPairError?: string | null,
   *   analytics?: object | null,
   *   analyticsError?: string | null,
   *   alerts?: object[],
   *   alertsMongoReady?: boolean,
   *   alertsError?: string | null,
   *   alertsDaily?: object[],
   *   alertsDailyFromDate?: string,
   *   alertsDailyToDate?: string,
   *   alertsDailyError?: string | null,
   *   alertsDailyMongoReady?: boolean,
   *   alertsDailySnapshotAt?: number | null,
   *   pollError?: string | null,
   *   loading?: boolean,
   *   scheduledAfterMs?: number | null,
   * }} patch
   */
  ingest: (patch) =>
    set((s) => {
      const next = { ...s, ...patch, lastPollAt: Date.now() };
      if (
        Object.prototype.hasOwnProperty.call(patch, 'alertsDaily') ||
        Object.prototype.hasOwnProperty.call(patch, 'alertsDailyError')
      ) {
        next.alertsDailySnapshotAt = Date.now();
      }
      return next;
    }),
}));
