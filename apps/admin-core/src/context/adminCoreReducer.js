import { safeProjectSlice } from '../lib/adminCoreValidation.js';

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

/** Deep merge for nested config (price, order, rules, …). */
export function deepMergeConfig(target, source) {
  if (!isPlainObject(target)) return isPlainObject(source) ? { ...source } : source;
  if (!isPlainObject(source)) return target;
  const out = { ...target };
  for (const k of Object.keys(source)) {
    const sv = source[k];
    const tv = target[k];
    if (isPlainObject(sv) && isPlainObject(tv)) {
      out[k] = deepMergeConfig(tv, sv);
    } else {
      out[k] = sv;
    }
  }
  return out;
}

export function mergeUserRecord(prev, patch) {
  if (!prev || !patch || typeof patch !== 'object') return prev;
  const next = { ...prev };
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'balances' && isPlainObject(v)) {
      next.balances = { ...(prev.balances || {}), ...v };
    } else if (k === 'network' && isPlainObject(v)) {
      next.network = { ...(prev.network || {}), ...v };
    } else if (k === 'rewards' && isPlainObject(v)) {
      next.rewards = { ...(prev.rewards || {}), ...v };
    } else if (k === 'permissions' && isPlainObject(v)) {
      next.permissions = { ...(prev.permissions || {}), ...v };
    } else if (k === 'historyAppend' && v) {
      next.history = [...(prev.history || []), v];
    } else if (k !== 'historyAppend') {
      next[k] = v;
    }
  }
  return next;
}

export function adminCoreReducer(state, action) {
  switch (action.type) {
    case 'SET_TOAST':
      return { ...state, ui: { ...state.ui, toast: action.payload } };
    case 'CLEAR_TOAST':
      return { ...state, ui: { ...state.ui, toast: null } };
    case 'SET_UI':
      return { ...state, ui: { ...state.ui, ...action.payload } };
    case 'SET_LOADING_KEY': {
      const { key, on } = action.payload;
      const next = { ...(state.ui?.loadingByKey || {}) };
      if (on) next[key] = true;
      else delete next[key];
      return { ...state, ui: { ...state.ui, loadingByKey: next } };
    }
    case 'SET_PROJECT':
      return { ...state, currentProject: action.payload };
    case 'MERGE_USER': {
      const { project, userId, patch } = action.payload;
      const list = safeProjectSlice(state.usersByProject, project);
      return {
        ...state,
        usersByProject: {
          ...state.usersByProject,
          [project]: list.map((u) => (u.id === userId ? mergeUserRecord(u, patch) : u)),
        },
      };
    }
    case 'MERGE_LEDGER_ROW': {
      const { project, rowId, patch } = action.payload;
      const list = safeProjectSlice(state.walletLedgerByProject, project);
      return {
        ...state,
        walletLedgerByProject: {
          ...state.walletLedgerByProject,
          [project]: list.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
        },
      };
    }
    case 'ADD_LEDGER_ROW': {
      const { project, row } = action.payload;
      const list = safeProjectSlice(state.walletLedgerByProject, project);
      return {
        ...state,
        walletLedgerByProject: {
          ...state.walletLedgerByProject,
          [project]: [row, ...list],
        },
      };
    }
    case 'MERGE_ORDER': {
      const { project, orderId, patch } = action.payload;
      const list = safeProjectSlice(state.ordersByProject, project);
      return {
        ...state,
        ordersByProject: {
          ...state.ordersByProject,
          [project]: list.map((o) => (o.id === orderId ? { ...o, ...patch } : o)),
        },
      };
    }
    case 'SET_PROJECT_CONFIG': {
      const { project, patch } = action.payload;
      const prev = state.configByProject[project] || {};
      return {
        ...state,
        configByProject: {
          ...state.configByProject,
          [project]: deepMergeConfig(prev, patch),
        },
      };
    }
    case 'RESET_PROJECT_CONFIG': {
      const { project, config } = action.payload;
      return {
        ...state,
        configByProject: {
          ...state.configByProject,
          [project]: structuredClone(config),
        },
      };
    }
    case 'SET_REWARD_SYSTEM': {
      const { project, enabled } = action.payload;
      return {
        ...state,
        rewardSystemByProject: {
          ...(state.rewardSystemByProject || {}),
          [project]: Boolean(enabled),
        },
      };
    }
    case 'MERGE_SECURITY': {
      const { project, patchFn } = action.payload;
      const prev = state.securityByProject?.[project] || { blockedIps: [], securityLogs: [] };
      const nextSlice = patchFn(prev);
      return {
        ...state,
        securityByProject: {
          ...(state.securityByProject || {}),
          [project]: nextSlice,
        },
      };
    }
    case 'ADD_AUDIT_LOG':
      return {
        ...state,
        logs: [action.payload, ...(state.logs || [])],
      };
    default:
      return state;
  }
}
