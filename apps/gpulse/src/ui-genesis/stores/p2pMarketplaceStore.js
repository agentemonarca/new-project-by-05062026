import { create } from 'zustand';

/**
 * G11 P2P marketplace — tab mode, selection, expansion, filter.
 */
export const useP2PMarketplaceStore = create((set, get) => ({
  p2pMode: 'buy',
  selectedOrder: null,
  expandedOrderId: null,
  networkFilter: 'ERC-20',
  uiLang: 'es',

  setP2pMode: (p2pMode) => set({ p2pMode: p2pMode === 'sell' ? 'sell' : 'buy' }),

  setNetworkFilter: (networkFilter) => set({ networkFilter }),

  setUiLang: (uiLang) => set({ uiLang: uiLang === 'en' ? 'en' : 'es' }),

  setSelectedOrder: (selectedOrder) => set({ selectedOrder }),

  /**
   * @param {string | null} orderId
   * @param {Array<{ id: string }>} orderList
   */
  setExpandedOrder: (orderId, orderList) => {
    if (!orderId) {
      set({ expandedOrderId: null, selectedOrder: null });
      return;
    }
    const order = orderList.find((o) => o.id === orderId) ?? null;
    set({ expandedOrderId: orderId, selectedOrder: order });
  },

  toggleExpandOrder: (orderId, orderList) => {
    const cur = get().expandedOrderId;
    const next = cur === orderId ? null : orderId;
    if (!next) {
      set({ expandedOrderId: null, selectedOrder: null });
      return;
    }
    const order = orderList.find((o) => o.id === next) ?? null;
    set({ expandedOrderId: next, selectedOrder: order });
  },

  closeExpanded: () => set({ expandedOrderId: null, selectedOrder: null }),
}));
