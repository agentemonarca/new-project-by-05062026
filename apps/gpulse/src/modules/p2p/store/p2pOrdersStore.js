import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** @typedef {'buy' | 'sell'} P2PSide */

/**
 * @typedef {{
 *   id: string,
 *   side: P2PSide,
 *   priceUsd: number,
 *   amountAig: number,
 *   status: 'open' | 'filled' | 'cancelled',
 *   createdAt: number,
 *   label?: string,
 *   owned?: boolean,
 * }} P2POrderRow
 */

function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function weekKey(ts = Date.now()) {
  const d = new Date(ts);
  const oneJan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - oneJan) / 86400000 + oneJan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

function monthKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}

/** @type {P2POrderRow[]} */
const SEED_ORDERS = [
  {
    id: 'book-1',
    side: 'sell',
    priceUsd: 23.45,
    amountAig: 1200,
    status: 'open',
    createdAt: Date.now() - 86400000,
    label: 'Liquidity_MM_A',
  },
  {
    id: 'book-2',
    side: 'buy',
    priceUsd: 22.8,
    amountAig: 5000,
    status: 'open',
    createdAt: Date.now() - 3600000,
    label: 'Desk_B',
  },
  {
    id: 'book-3',
    side: 'sell',
    priceUsd: 24.1,
    amountAig: 800,
    status: 'open',
    createdAt: Date.now() - 7200000,
    label: 'OTC_C',
  },
];

function freshUsage() {
  const t = Date.now();
  return {
    dayKey: dayKey(t),
    dailyCount: 0,
    weekKey: weekKey(t),
    weeklyCount: 0,
    monthKey: monthKey(t),
    monthlyCount: 0,
    buyDayAig: 0,
    sellDayAig: 0,
  };
}

/**
 * Mock order book + local usage (ready to swap for API).
 */
export const useP2POrdersStore = create(
  persist(
    (set, get) => ({
      /** @type {P2POrderRow[]} */
      orders: [...SEED_ORDERS],

      mockUser: {
        hasProfile: true,
        hasMining: true,
      },

      /** @type {ReturnType<typeof freshUsage>} */
      usage: freshUsage(),

      setMockUser: (/** @type {Partial<{ hasProfile: boolean, hasMining: boolean }>} */ p) =>
        set((s) => ({ mockUser: { ...s.mockUser, ...p } })),

      /** @param {P2POrderRow} row */
      addOrder: (row) => set((s) => ({ orders: [row, ...s.orders] })),

      /** @param {string} id @param {'open'|'filled'|'cancelled'} status */
      setOrderStatus: (id, status) =>
        set((s) => ({
          orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)),
        })),

      /**
       * Append user-owned open order and roll usage counters.
       * @param {P2POrderRow} row
       * @param {P2PSide} side
       */
      appendOwnedOpenOrder: (row, side) => {
        const t = Date.now();
        const dk = dayKey(t);
        const wk = weekKey(t);
        const mk = monthKey(t);
        set((s) => {
          let u = { ...s.usage };
          if (u.dayKey !== dk) {
            u = { ...u, dayKey: dk, dailyCount: 0, buyDayAig: 0, sellDayAig: 0 };
          }
          if (u.weekKey !== wk) {
            u = { ...u, weekKey: wk, weeklyCount: 0 };
          }
          if (u.monthKey !== mk) {
            u = { ...u, monthKey: mk, monthlyCount: 0 };
          }
          u.dailyCount += 1;
          u.weeklyCount += 1;
          u.monthlyCount += 1;
          if (side === 'buy') u.buyDayAig += row.amountAig;
          else u.sellDayAig += row.amountAig;
          return {
            orders: [{ ...row, owned: true }, ...s.orders],
            usage: u,
          };
        });
      },

      resetBookDemo: () =>
        set({
          orders: [...SEED_ORDERS],
          usage: freshUsage(),
        }),
    }),
    {
      name: 'aigenesis-p2p-orders-v1',
      partialize: (s) => ({ orders: s.orders, mockUser: s.mockUser, usage: s.usage }),
    },
  ),
);
