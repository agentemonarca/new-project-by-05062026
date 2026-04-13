import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from '@/context/WalletContext.jsx';
import { useGenesisDashboardStore } from '@/ui-genesis/stores/genesisDashboardStore.js';
import { getDevMockBearer } from '@/ui-genesis/api/genesisConfig.js';
import { useP2PValidation } from './useP2PValidation.js';
import { P2P_USE_BACKEND } from '../p2pEnv.js';
import {
  p2pCancelOrderBackend,
  p2pCreateOrderBackend,
  p2pExecuteOrderBackend,
  p2pFetchOrderbookBackend,
  p2pFetchUserOrdersBackend,
} from '../api/p2pBackendApi.js';
import { nextOpaqueId } from '@/utils/gpulseRngPolicy.js';

/**
 * @typedef {import('../p2pTypes.js').P2POrderRow} P2POrderRow
 * @typedef {import('../p2pTypes.js').P2PSide} P2PSide
 */

function nextMockId() {
  return nextOpaqueId('mock');
}

/** @param {unknown} st */
function normalizeStatus(st) {
  if (st === 'open' || st === 'partial' || st === 'filled' || st === 'cancelled') return st;
  return 'open';
}

/**
 * @param {object} o
 * @param {string | null | undefined} selfId
 * @returns {P2POrderRow | null}
 */
function mapApiOrder(o, selfId) {
  if (!o || typeof o !== 'object') return null;
  const id = o.id != null ? String(o.id) : '';
  if (!id) return null;
  const price = Number(o.price);
  const amount = Number(o.amount);
  if (!Number.isFinite(price) || !Number.isFinite(amount) || price <= 0 || amount <= 0) return null;
  if (o.side !== 'buy' && o.side !== 'sell') return null;
  const sid = String(selfId || '').toLowerCase();
  const uid = String(o.userId || '').toLowerCase();
  return {
    id,
    side: o.side,
    priceUsd: price,
    amountAig: amount,
    status: /** @type {'open' | 'partial' | 'filled' | 'cancelled'} */ (normalizeStatus(o.status)),
    createdAt: typeof o.createdAt === 'number' ? o.createdAt : Number(o.createdAt) || Date.now(),
    label: uid && uid === sid ? 'Tú' : uid ? `0x${uid.slice(2, 8)}…` : 'P2P',
    owned: Boolean(uid && sid && uid === sid),
    userId: uid || undefined,
  };
}

/**
 * @param {string} orderBookSide — lado del libro ('sell' | 'buy')
 */
export function useP2POrders(orderBookSide = 'sell') {
  const authToken = useGenesisDashboardStore((s) => s.authToken);
  const sessionAuth = useGenesisDashboardStore((s) => s.sessionAuth);
  const loadDashboardData = useGenesisDashboardStore((s) => s.loadDashboardData);

  const { address } = useWallet();

  const token = authToken || getDevMockBearer() || null;

  const [apiBookOrders, setApiBookOrders] = useState(/** @type {P2POrderRow[]} */ ([]));
  const [apiMyOrders, setApiMyOrders] = useState(/** @type {P2POrderRow[]} */ ([]));
  const [mockOrders, setMockOrders] = useState(/** @type {P2POrderRow[]} */ ([]));

  const [bookLoading, setBookLoading] = useState(false);
  const [bookError, setBookError] = useState(/** @type {string | null} */ (null));
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [executingId, setExecutingId] = useState(/** @type {string | null} */ (null));
  const [cancellingId, setCancellingId] = useState(/** @type {string | null} */ (null));

  const createInFlight = useRef(false);
  const executingRef = useRef(new Set());
  const fetchGen = useRef(0);

  const { validatePrice, validateAmount, validateUser, validateLimits } = useP2PValidation();

  const canOperate = useMemo(
    () => (P2P_USE_BACKEND ? Boolean(sessionAuth || token) : Boolean(address)),
    [P2P_USE_BACKEND, sessionAuth, token, address],
  );

  const bookOrders = useMemo(() => {
    if (P2P_USE_BACKEND) return apiBookOrders;
    return mockOrders.filter((o) => o.side === orderBookSide);
  }, [apiBookOrders, mockOrders, orderBookSide]);

  const myOrdersAll = useMemo(() => {
    if (P2P_USE_BACKEND) return apiMyOrders;
    const self = String(address || '').toLowerCase();
    return mockOrders.filter((o) => (o.userId || '').toLowerCase() === self);
  }, [apiMyOrders, mockOrders, address]);

  const refreshBook = useCallback(async () => {
    if (!P2P_USE_BACKEND) {
      setBookError(null);
      setBookLoading(true);
      queueMicrotask(() => setBookLoading(false));
      return;
    }
    if (!canOperate) {
      setBookError('Inicia sesión en Genesis para cargar el libro P2P.');
      setApiBookOrders([]);
      setApiMyOrders([]);
      return;
    }

    const gen = ++fetchGen.current;
    setBookLoading(true);
    setBookError(null);
    const self = String(address || '').toLowerCase();
    try {
      const [bookData, userData] = await Promise.all([
        p2pFetchOrderbookBackend(token, { projectId: 'genesis', side: orderBookSide }),
        p2pFetchUserOrdersBackend(token, { projectId: 'genesis' }),
      ]);
      if (gen !== fetchGen.current) return;
      const rawBook = Array.isArray(bookData.orders) ? bookData.orders : [];
      const rawUser = Array.isArray(userData.orders) ? userData.orders : [];
      const bookMapped = rawBook.map((o) => mapApiOrder(/** @type {object} */ (o), self)).filter(Boolean);
      const userMapped = rawUser.map((o) => mapApiOrder(/** @type {object} */ (o), self)).filter(Boolean);
      setApiBookOrders(/** @type {P2POrderRow[]} */ (bookMapped));
      setApiMyOrders(/** @type {P2POrderRow[]} */ (userMapped));
    } catch (e) {
      if (gen !== fetchGen.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      setBookError(msg);
    } finally {
      if (gen === fetchGen.current) setBookLoading(false);
    }
  }, [canOperate, token, orderBookSide, address]);

  useEffect(() => {
    void refreshBook();
    return undefined;
  }, [refreshBook]);

  const openOrders = useMemo(
    () => bookOrders.filter((o) => o.status === 'open' || o.status === 'partial'),
    [bookOrders],
  );

  const myActiveOrders = useMemo(
    () => myOrdersAll.filter((o) => o.status === 'open' || o.status === 'partial'),
    [myOrdersAll],
  );

  const syncAfterMutation = useCallback(async () => {
    if (P2P_USE_BACKEND) {
      await loadDashboardData().catch(() => {});
      await refreshBook();
    }
  }, [loadDashboardData, refreshBook]);

  const createOrder = useCallback(
    async (/** @type {{ side: P2PSide, priceUsd: number, amountAig: number }} */ payload) => {
      if (!canOperate) {
        return {
          ok: false,
          error: P2P_USE_BACKEND
            ? 'Inicia sesión para publicar órdenes.'
            : 'Conecta tu wallet para publicar en modo demostración.',
        };
      }
      if (createInFlight.current) {
        return { ok: false, error: 'Ya hay una publicación en curso.' };
      }

      const errs = [
        validateUser(payload.side),
        validatePrice(payload.priceUsd),
        validateAmount(payload.amountAig),
        validateLimits(payload.side, payload.amountAig),
      ].filter((e) => !e.ok);
      if (errs.length) {
        return { ok: false, error: errs[0].message };
      }

      createInFlight.current = true;
      setSubmittingOrder(true);
      try {
        if (!P2P_USE_BACKEND) {
          const self = String(address || '').toLowerCase();
          const row = /** @type {P2POrderRow} */ ({
            id: nextMockId(),
            side: payload.side,
            priceUsd: Number(payload.priceUsd),
            amountAig: Number(payload.amountAig),
            status: 'open',
            createdAt: Date.now(),
            label: 'Tú',
            owned: true,
            userId: self,
          });
          setMockOrders((prev) => [...prev, row]);
          return { ok: true };
        }

        await p2pCreateOrderBackend(token, {
          projectId: 'genesis',
          side: payload.side,
          amount: Number(payload.amountAig),
          price: Number(payload.priceUsd),
        });
        await syncAfterMutation();
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      } finally {
        createInFlight.current = false;
        setSubmittingOrder(false);
      }
    },
    [
      P2P_USE_BACKEND,
      canOperate,
      token,
      address,
      validateAmount,
      validateLimits,
      validatePrice,
      validateUser,
      syncAfterMutation,
    ],
  );

  const executeOrder = useCallback(
    async (/** @type {string} */ id) => {
      if (!canOperate) {
        return {
          ok: false,
          error: P2P_USE_BACKEND ? 'Inicia sesión para operar.' : 'Conecta tu wallet para operar en demo.',
        };
      }
      if (executingRef.current.has(id)) return { ok: false, error: 'Operación en curso…' };

      /** @type {P2POrderRow | undefined} */
      let o;
      if (P2P_USE_BACKEND) {
        o = bookOrders.find((x) => x.id === id);
      } else {
        o = mockOrders.find((x) => x.id === id);
      }

      if (!o || (o.status !== 'open' && o.status !== 'partial')) {
        return { ok: false, error: 'Orden no disponible' };
      }
      if (o.owned) return { ok: false, error: 'No puedes tomar tu propia orden' };

      executingRef.current.add(id);
      setExecutingId(id);
      try {
        if (!P2P_USE_BACKEND) {
          setMockOrders((prev) => prev.filter((x) => x.id !== id));
          return { ok: true };
        }
        await p2pExecuteOrderBackend(token, { makerOrderId: id });
        await syncAfterMutation();
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      } finally {
        executingRef.current.delete(id);
        setExecutingId(null);
      }
    },
    [P2P_USE_BACKEND, canOperate, token, bookOrders, mockOrders, syncAfterMutation],
  );

  const cancelOrder = useCallback(
    async (/** @type {string} */ id) => {
      if (!canOperate) {
        return {
          ok: false,
          error: P2P_USE_BACKEND ? 'Inicia sesión.' : 'Conecta tu wallet.',
        };
      }

      /** @type {P2POrderRow | undefined} */
      let o;
      if (P2P_USE_BACKEND) {
        o = myOrdersAll.find((x) => x.id === id) || bookOrders.find((x) => x.id === id);
      } else {
        o = mockOrders.find((x) => x.id === id);
      }

      if (!o || !o.owned) return { ok: false, error: 'Solo puedes cancelar tus órdenes.' };
      if (o.status !== 'open' && o.status !== 'partial') {
        return { ok: false, error: 'Esta orden ya no se puede cancelar.' };
      }

      setCancellingId(id);
      try {
        if (!P2P_USE_BACKEND) {
          setMockOrders((prev) => prev.filter((x) => x.id !== id));
          return { ok: true };
        }
        await p2pCancelOrderBackend(token, id);
        await syncAfterMutation();
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      } finally {
        setCancellingId(null);
      }
    },
    [P2P_USE_BACKEND, canOperate, token, myOrdersAll, bookOrders, mockOrders, syncAfterMutation],
  );

  return useMemo(
    () => ({
      useBackend: P2P_USE_BACKEND,
      canOperate,
      orders: openOrders,
      allOrders: bookOrders,
      myOrders: myActiveOrders,
      createOrder,
      executeOrder,
      cancelOrder,
      resetBookDemo: refreshBook,
      bookLoading,
      bookError,
      refreshBook,
      submittingOrder,
      executingId,
      cancellingId,
    }),
    [
      canOperate,
      openOrders,
      bookOrders,
      myActiveOrders,
      createOrder,
      executeOrder,
      cancelOrder,
      refreshBook,
      bookLoading,
      bookError,
      submittingOrder,
      executingId,
      cancellingId,
    ],
  );
}
