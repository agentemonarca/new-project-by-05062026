import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchLedgerEventsRaw } from '../api/ledgerApi.js';
import { binaryEventsToLedgerRows } from '../binary/binaryHistoryToLedger.js';
import { useBinaryEngineStore } from '../binary/binaryEngineStore.js';
import { normalizeLedgerEvents } from './normalize.js';
import { usePaymentLedgerStore } from '../stores/paymentLedgerStore.js';
import { useSimulationModeStore } from '../stores/simulationModeStore.js';
import { buildSimulationLedgerEvents } from '../simulation/buildSimulationDataset.js';

const LedgerContext = createContext(null);

const DEFAULT_PAGE_SIZE = 20;

/**
 * Fetches and normalizes ledger rows; filtering and pagination are memoized (single copy of event list).
 *
 * @param {{
 *   children: React.ReactNode,
 *   hasSession: boolean,
 * }} props
 */
export function LedgerProvider({ children, hasSession }) {
  const [remoteEvents, setRemoteEvents] = useState([]);
  const binaryHistory = useBinaryEngineStore((s) => s.eventHistory);
  const paymentEvents = usePaymentLedgerStore((s) => s.events);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  /** `all` or a `LedgerEvent.category` value */
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const isSimulationMode = useSimulationModeStore((s) => s.isSimulationMode);
  const [simLedgerTick, setSimLedgerTick] = useState(0);

  useEffect(() => {
    if (!isSimulationMode) return undefined;
    const id = window.setInterval(() => setSimLedgerTick((t) => t + 1), 52000);
    return () => clearInterval(id);
  }, [isSimulationMode]);

  const simulationLedgerRows = useMemo(
    () => (isSimulationMode ? buildSimulationLedgerEvents(0.04) : []),
    [isSimulationMode, simLedgerTick],
  );

  const load = useCallback(async () => {
    if (!hasSession) {
      setRemoteEvents([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchLedgerEventsRaw();
      setRemoteEvents(normalizeLedgerEvents(raw));
    } catch (e) {
      setError(String(e?.message || e));
      setRemoteEvents([]);
    } finally {
      setLoading(false);
    }
  }, [hasSession]);

  useEffect(() => {
    load();
  }, [load]);

  const events = useMemo(() => {
    const bin = binaryEventsToLedgerRows(binaryHistory);
    return [...simulationLedgerRows, ...bin, ...paymentEvents, ...remoteEvents].sort((a, b) => b.ts - a.ts);
  }, [simulationLedgerRows, binaryHistory, paymentEvents, remoteEvents]);

  const filteredEvents = useMemo(() => {
    let list = events;
    if (categoryFilter !== 'all') {
      list = list.filter((e) => e.category === categoryFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (e) =>
          String(e.title ?? '')
            .toLowerCase()
            .includes(q) ||
          String(e.summary ?? '')
            .toLowerCase()
            .includes(q) ||
          String(e.kind ?? '')
            .toLowerCase()
            .includes(q) ||
          (e.txHash && String(e.txHash).toLowerCase().includes(q)),
      );
    }
    return [...list].sort((a, b) => b.ts - a.ts);
  }, [events, categoryFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / DEFAULT_PAGE_SIZE));

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const visibleEvents = useMemo(() => {
    const start = (page - 1) * DEFAULT_PAGE_SIZE;
    return filteredEvents.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [filteredEvents, page]);

  const value = useMemo(
    () => ({
      events,
      filteredEvents,
      visibleEvents,
      loading,
      error,
      refetch: load,
      search,
      setSearch,
      categoryFilter,
      setCategoryFilter,
      page,
      setPage,
      pageSize: DEFAULT_PAGE_SIZE,
      totalFiltered: filteredEvents.length,
      totalPages,
      hasSession,
    }),
    [
      events,
      filteredEvents,
      visibleEvents,
      loading,
      error,
      load,
      search,
      setSearch,
      categoryFilter,
      setCategoryFilter,
      page,
      setPage,
      totalPages,
      hasSession,
    ],
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

/** @returns {NonNullable<React.ContextType<typeof LedgerContext>>} */
export function useLedger() {
  const ctx = useContext(LedgerContext);
  if (!ctx) {
    throw new Error('useLedger must be used within LedgerProvider');
  }
  return ctx;
}
