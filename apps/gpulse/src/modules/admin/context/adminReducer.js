/**
 * @typedef {{
 *   users: object[],
 *   p2pOrders: object[],
 *   withdrawals: object[],
 *   walletLedger: object[],
 *   globalConfig: object,
 *   rewardSystemEnabled: boolean,
 *   marketPaused: boolean,
 *   securityLogs: object[],
 *   blockedIps: string[],
 *   ui: { toast: null | { type: 'success'|'error', message: string }, loading: Record<string, boolean> },
 * }} AdminState
 */

/** @param {AdminState} state @param {object} action */
export function adminReducer(state, action) {
  switch (action.type) {
    case 'SET_TOAST':
      return { ...state, ui: { ...state.ui, toast: action.payload } };
    case 'CLEAR_TOAST':
      return { ...state, ui: { ...state.ui, toast: null } };
    case 'SET_LOADING': {
      const { key, value } = action.payload;
      return {
        ...state,
        ui: { ...state.ui, loading: { ...state.ui.loading, [key]: Boolean(value) } },
      };
    }
    case 'UPDATE_USER': {
      const { userId, patch } = action.payload;
      return {
        ...state,
        users: state.users.map((u) => (u.id === userId ? { ...u, ...patch } : u)),
      };
    }
    case 'MERGE_USER': {
      const { userId, patch } = action.payload;
      return {
        ...state,
        users: state.users.map((u) =>
          u.id === userId
            ? {
                ...u,
                ...patch,
                balances: patch.balances ? { ...u.balances, ...patch.balances } : u.balances,
                network: patch.network ? { ...u.network, ...patch.network } : u.network,
                rewards: patch.rewards ? { ...u.rewards, ...patch.rewards } : u.rewards,
                history: patch.history ? [...(u.history || []), ...patch.history] : u.history,
              }
            : u,
        ),
      };
    }
    case 'APPEND_USER_HISTORY': {
      const { userId, entry } = action.payload;
      return {
        ...state,
        users: state.users.map((u) =>
          u.id === userId ? { ...u, history: [...(u.history || []), entry] } : u,
        ),
      };
    }
    case 'SET_ORDERS':
      return { ...state, p2pOrders: action.payload };
    case 'UPDATE_ORDER': {
      const { orderId, patch } = action.payload;
      return {
        ...state,
        p2pOrders: state.p2pOrders.map((o) => (o.id === orderId ? { ...o, ...patch } : o)),
      };
    }
    case 'SET_WITHDRAWALS':
      return { ...state, withdrawals: action.payload };
    case 'UPDATE_WITHDRAWAL': {
      const { withdrawalId, patch } = action.payload;
      return {
        ...state,
        withdrawals: state.withdrawals.map((w) => (w.id === withdrawalId ? { ...w, ...patch } : w)),
        walletLedger: (state.walletLedger || []).map((row) =>
          row.id === withdrawalId && row.type === 'withdrawal' ? { ...row, ...patch } : row,
        ),
      };
    }
    case 'SET_GLOBAL_CONFIG':
      return {
        ...state,
        globalConfig: {
          ...state.globalConfig,
          ...action.payload,
          price: { ...state.globalConfig.price, ...(action.payload.price || {}) },
          rules: { ...state.globalConfig.rules, ...(action.payload.rules || {}) },
          order: { ...state.globalConfig.order, ...(action.payload.order || {}) },
          limits: { ...state.globalConfig.limits, ...(action.payload.limits || {}) },
          volume: { ...state.globalConfig.volume, ...(action.payload.volume || {}) },
          flags: { ...state.globalConfig.flags, ...(action.payload.flags || {}) },
        },
      };
    case 'RESET_GLOBAL_CONFIG':
      return { ...state, globalConfig: action.payload };
    case 'SET_REWARD_SYSTEM':
      return { ...state, rewardSystemEnabled: Boolean(action.payload) };
    case 'SET_MARKET_PAUSED':
      return { ...state, marketPaused: Boolean(action.payload) };
    case 'ADD_SECURITY_LOG':
      return { ...state, securityLogs: [action.payload, ...state.securityLogs] };
    case 'ADD_BLOCKED_IP':
      return { ...state, blockedIps: [...state.blockedIps, action.payload].filter(Boolean) };
    default:
      return state;
  }
}
