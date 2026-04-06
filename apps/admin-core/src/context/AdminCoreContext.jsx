import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { buildInitialState, PROJECT_LIST } from '../data/mockMaster.js';
import * as api from '../services/adminCoreService.js';
import { assertProject, safeProjectSlice } from '../lib/adminCoreValidation.js';
import { buildAuditLogFromPartial } from '../lib/auditLog.js';
import { exportLedgerSelection } from '../utils/walletBulkExport.js';
import { adminCoreReducer } from './adminCoreReducer.js';

/** @typedef {ReturnType<typeof buildInitialState>} AdminCoreState */

const AdminCoreContext = createContext(/** @type {any} */ (null));

export function marketPausedFromConfig(cfg) {
  if (!cfg) return false;
  return Boolean(cfg.flags?.marketPaused ?? cfg.marketPaused);
}

function patchUi(state, partial) {
  return { ...state, ui: { ...state.ui, ...partial } };
}

export function AdminCoreProvider({ children }) {
  const [state, dispatch] = useReducer(adminCoreReducer, undefined, buildInitialState);
  const toastTimer = useRef(0);

  const setLoadingKey = useCallback((key, on) => {
    dispatch({ type: 'SET_LOADING_KEY', payload: { key, on } });
  }, []);

  const isLoading = useCallback(
    (key) => Boolean(state.ui?.loadingByKey && state.ui.loadingByKey[key]),
    [state.ui?.loadingByKey],
  );

  const showToast = useCallback((type, message) => {
    window.clearTimeout(toastTimer.current);
    dispatch({ type: 'SET_TOAST', payload: { type, message: String(message || '') } });
    toastTimer.current = window.setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 4000);
  }, []);

  const run = useCallback(
    async (fn) => {
      try {
        const res = await fn();
        if (!res?.ok) {
          showToast('error', res?.error || 'Operación rechazada');
          return res;
        }
        return res;
      } catch (e) {
        showToast('error', String(e?.message || e));
        return { ok: false, error: String(e?.message || e) };
      }
    },
    [showToast],
  );

  const addLog = useCallback(
    (entry) => {
      const r = buildAuditLogFromPartial(entry);
      if (!r.ok) {
        showToast('error', r.error);
        return false;
      }
      dispatch({ type: 'ADD_AUDIT_LOG', payload: r.log });
      return true;
    },
    [showToast],
  );

  const setCurrentProject = useCallback(
    async (projectId) => {
      const v = assertProject(projectId);
      if (!v.ok) {
        showToast('error', v.error);
        return;
      }
      if (projectId === state.currentProject) return;
      dispatch({ type: 'SET_UI', payload: { isSwitchingProject: true } });
      await new Promise((r) => setTimeout(r, 280));
      dispatch({ type: 'SET_PROJECT', payload: projectId });
      dispatch({ type: 'SET_UI', payload: { isSwitchingProject: false } });
    },
    [state.currentProject, showToast],
  );

  const currentProjectMeta = useMemo(
    () => PROJECT_LIST.find((p) => p.id === state.currentProject) ?? null,
    [state.currentProject],
  );

  const projectUsers = useMemo(() => {
    const id = state.currentProject;
    if (!id) return [];
    return safeProjectSlice(state.usersByProject, id);
  }, [state.usersByProject, state.currentProject]);

  const projectWalletLedger = useMemo(() => {
    const id = state.currentProject;
    if (!id) return [];
    return safeProjectSlice(state.walletLedgerByProject, id);
  }, [state.walletLedgerByProject, state.currentProject]);

  /** Alias compatible con vistas que aún hablan de «transactions». */
  const projectTransactions = projectWalletLedger;

  const projectOrders = useMemo(() => {
    const id = state.currentProject;
    if (!id) return [];
    return safeProjectSlice(state.ordersByProject, id);
  }, [state.ordersByProject, state.currentProject]);

  const projectConfig = useMemo(() => {
    const id = state.currentProject;
    if (!id) return null;
    return state.configByProject[id] ?? null;
  }, [state.configByProject, state.currentProject]);

  const projectLogs = useMemo(() => {
    const id = state.currentProject;
    if (!id) return [];
    const logs = Array.isArray(state.logs) ? state.logs : [];
    return logs.filter((l) => l && l.project === id);
  }, [state.logs, state.currentProject]);

  const projectRewards = useMemo(() => {
    const id = state.currentProject;
    if (!id) return null;
    return state.rewardsByProject[id] ?? null;
  }, [state.rewardsByProject, state.currentProject]);

  const projectSecurity = useMemo(() => {
    const id = state.currentProject;
    if (!id) return { blockedIps: [], securityLogs: [] };
    return state.securityByProject?.[id] ?? { blockedIps: [], securityLogs: [] };
  }, [state.securityByProject, state.currentProject]);

  const rewardSystemEnabled = useMemo(() => {
    const id = state.currentProject;
    if (!id) return false;
    return Boolean(state.rewardSystemByProject?.[id]);
  }, [state.rewardSystemByProject, state.currentProject]);

  const blockUser = useCallback(
    async (project, userId, blocked) => {
      const lk = `block-${userId}`;
      setLoadingKey(lk, true);
      const res = await run(() => api.blockUser(project, userId, blocked));
      setLoadingKey(lk, false);
      if (res?.ok) {
        dispatch({
          type: 'MERGE_USER',
          payload: {
            project,
            userId,
            patch: {
              status: blocked ? 'blocked' : 'active',
              historyAppend: {
                ts: new Date().toISOString(),
                action: blocked ? 'admin.block' : 'admin.unblock',
                detail: 'estado cuenta',
              },
            },
          },
        });
        addLog({ action: 'blockUser', project, userId, meta: { blocked: Boolean(blocked) } });
        showToast('success', blocked ? 'Usuario bloqueado' : 'Usuario desbloqueado');
      }
      return res;
    },
    [run, addLog, showToast, setLoadingKey],
  );

  const updateUser = useCallback(
    async (project, userId, patch) => {
      const lk = `user-${userId}`;
      setLoadingKey(lk, true);
      const res = await run(() => api.updateUser(project, userId, patch));
      setLoadingKey(lk, false);
      if (res?.ok) {
        dispatch({
          type: 'MERGE_USER',
          payload: {
            project,
            userId,
            patch: {
              ...res.patch,
              historyAppend: {
                ts: new Date().toISOString(),
                action: 'profile.update',
                detail: Object.keys(res.patch || {}).join(', '),
              },
            },
          },
        });
        addLog({ action: 'updateUser', project, userId });
        showToast('success', 'Usuario actualizado');
      }
      return res;
    },
    [run, addLog, showToast, setLoadingKey],
  );

  const adjustBalance = useCallback(
    async (project, userId, delta) => {
      const lk = `bal-${userId}`;
      setLoadingKey(lk, true);
      const res = await run(() => api.adjustBalance(project, userId, delta));
      setLoadingKey(lk, false);
      if (res?.ok) {
        const list = safeProjectSlice(state.usersByProject, project);
        const u = list.find((x) => x.id === userId);
        if (u) {
          const nextUsd = (u.balances?.usd || 0) + (res.delta?.usd || 0);
          const nextAig = (u.balances?.aig || 0) + (res.delta?.aig || 0);
          dispatch({
            type: 'MERGE_USER',
            payload: {
              project,
              userId,
              patch: {
                balances: { usd: nextUsd, aig: nextAig },
                historyAppend: {
                  ts: new Date().toISOString(),
                  action: 'balance.adjust',
                  detail: `Δ USD ${res.delta?.usd ?? 0} · AIG ${res.delta?.aig ?? 0}`,
                },
              },
            },
          });
        }
        const rowId = `ADJ-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        dispatch({
          type: 'ADD_LEDGER_ROW',
          payload: {
            project,
            row: {
              id: rowId,
              project,
              userId,
              type: 'adjustment',
              asset: 'MIX',
              amount: Math.abs(Number(res.delta?.usd) || 0) + Math.abs(Number(res.delta?.aig) || 0),
              status: 'approved',
              createdAt: new Date().toISOString(),
            },
          },
        });
        addLog({ action: 'adjustBalance', project, userId, meta: { delta: res.delta } });
        showToast('success', 'Balance ajustado');
      }
      return res;
    },
    [run, state.usersByProject, addLog, showToast, setLoadingKey],
  );

  const sendEmail = useCallback(
    async (project, to, subject, body) => {
      const lk = 'email';
      setLoadingKey(lk, true);
      const res = await run(() => api.sendEmail(project, to, subject, body));
      setLoadingKey(lk, false);
      if (res?.ok) {
        addLog({ action: 'sendEmail', project, meta: { to: res.to } });
        showToast('success', 'Email enviado (mock)');
      }
      return res;
    },
    [run, addLog, showToast, setLoadingKey],
  );

  const sendInternalNotification = useCallback(
    async (project, userId, title, body) => {
      const key = 'inapp';
      setLoadingKey(key, true);
      const res = await run(() => api.sendInternalNotification(project, userId, title, body));
      setLoadingKey(key, false);
      if (res?.ok) {
        addLog({ action: 'sendInternalNotification', project, userId, meta: { title } });
        showToast('success', 'Notificación interna (mock)');
      }
      return res;
    },
    [run, addLog, showToast, setLoadingKey],
  );

  const resetPassword = useCallback(
    async (project, userId) => {
      const key = `pwd-${userId}`;
      setLoadingKey(key, true);
      const res = await run(() => api.resetPassword(project, userId));
      setLoadingKey(key, false);
      if (res?.ok) {
        dispatch({
          type: 'MERGE_USER',
          payload: {
            project,
            userId,
            patch: {
              historyAppend: {
                ts: new Date().toISOString(),
                action: 'security.reset_password',
                detail: 'mock flow',
              },
            },
          },
        });
        addLog({ action: 'resetPassword', project, userId });
        showToast('success', 'Reset de contraseña disparado (mock)');
      }
      return res;
    },
    [run, addLog, showToast, setLoadingKey],
  );

  const changeReferrer = useCallback(
    async (project, userId, newReferrerId) => {
      const lk = `ref-${userId}`;
      setLoadingKey(lk, true);
      const res = await run(() => api.changeReferrer(project, userId, newReferrerId));
      setLoadingKey(lk, false);
      if (res?.ok) {
        dispatch({
          type: 'MERGE_USER',
          payload: {
            project,
            userId,
            patch: {
              referrerId: res.newReferrerId,
              historyAppend: {
                ts: new Date().toISOString(),
                action: 'network.referrer',
                detail: res.newReferrerId,
              },
            },
          },
        });
        addLog({ action: 'changeReferrer', project, userId, meta: { newReferrerId: res.newReferrerId } });
        showToast('success', 'Referidor actualizado');
      }
      return res;
    },
    [run, addLog, showToast, setLoadingKey],
  );

  const approveWithdraw = useCallback(
    async (project, txId) => {
      const res = await run(() => api.approveWithdraw(project, txId));
      if (res?.ok) {
        dispatch({ type: 'MERGE_LEDGER_ROW', payload: { project, rowId: txId, patch: { status: 'approved' } } });
        addLog({ action: 'approveWithdraw', project, txId });
        showToast('success', 'Retiro aprobado');
      }
      return res;
    },
    [run, addLog, showToast],
  );

  const rejectWithdraw = useCallback(
    async (project, txId) => {
      const res = await run(() => api.rejectWithdraw(project, txId));
      if (res?.ok) {
        dispatch({ type: 'MERGE_LEDGER_ROW', payload: { project, rowId: txId, patch: { status: 'rejected' } } });
        addLog({ action: 'rejectWithdraw', project, txId });
        showToast('success', 'Retiro rechazado');
      }
      return res;
    },
    [run, addLog, showToast, setLoadingKey],
  );

  const freezeFunds = useCallback(
    async (project, userId, frozen) => {
      const res = await run(() => api.freezeFunds(project, userId, frozen));
      if (res?.ok) {
        dispatch({ type: 'MERGE_USER', payload: { project, userId, patch: { fundsFrozen: frozen } } });
        addLog({ action: 'freezeFunds', project, userId, meta: { frozen: Boolean(frozen) } });
        showToast('success', frozen ? 'Fondos congelados' : 'Fondos liberados');
      }
      return res;
    },
    [run, addLog, showToast],
  );

  const approveMultipleWithdraw = useCallback(
    async (project, rowIds) => {
      const ids = Array.isArray(rowIds) ? rowIds.filter(Boolean) : [];
      if (!ids.length) {
        showToast('error', 'No hay retiros pendientes seleccionados');
        return { ok: false };
      }
      const lk = 'wallet-bulk';
      setLoadingKey(lk, true);
      const res = await run(() => api.approveMultipleWithdraw(project, ids));
      setLoadingKey(lk, false);
      if (res?.ok) {
        const list = res.rowIds || ids;
        for (const rowId of list) {
          dispatch({ type: 'MERGE_LEDGER_ROW', payload: { project, rowId, patch: { status: 'approved' } } });
        }
        addLog({ action: 'approveMultipleWithdraw', project, meta: { count: list.length } });
        showToast('success', `${list.length} retiro(s) aprobado(s)`);
      }
      return res;
    },
    [run, addLog, showToast, setLoadingKey],
  );

  const rejectMultipleWithdraw = useCallback(
    async (project, rowIds) => {
      const ids = Array.isArray(rowIds) ? rowIds.filter(Boolean) : [];
      if (!ids.length) {
        showToast('error', 'No hay retiros pendientes seleccionados');
        return { ok: false };
      }
      const lk = 'wallet-bulk';
      setLoadingKey(lk, true);
      const res = await run(() => api.rejectMultipleWithdraw(project, ids));
      setLoadingKey(lk, false);
      if (res?.ok) {
        const list = res.rowIds || ids;
        for (const rowId of list) {
          dispatch({ type: 'MERGE_LEDGER_ROW', payload: { project, rowId, patch: { status: 'rejected' } } });
        }
        addLog({ action: 'rejectMultipleWithdraw', project, meta: { count: list.length } });
        showToast('success', `${list.length} retiro(s) rechazado(s)`);
      }
      return res;
    },
    [run, addLog, showToast, setLoadingKey],
  );

  const freezeMultiple = useCallback(
    async (project, userIds) => {
      const ids = Array.isArray(userIds) ? [...new Set(userIds.map((x) => String(x).trim()).filter(Boolean))] : [];
      if (!ids.length) {
        showToast('error', 'No hay usuarios en la selección');
        return { ok: false };
      }
      const lk = 'wallet-bulk';
      setLoadingKey(lk, true);
      const res = await run(() => api.freezeMultiple(project, ids));
      setLoadingKey(lk, false);
      if (res?.ok) {
        for (const userId of res.userIds) {
          dispatch({ type: 'MERGE_USER', payload: { project, userId, patch: { fundsFrozen: true } } });
        }
        addLog({ action: 'freezeMultiple', project, meta: { count: res.userIds.length, userIds: res.userIds } });
        showToast('success', `Fondos congelados para ${res.userIds.length} usuario(s)`);
      }
      return res;
    },
    [run, addLog, showToast, setLoadingKey],
  );

  const exportSelection = useCallback(
    (ledgerRows) => {
      const pid = state.currentProject;
      if (!pid) {
        showToast('error', 'Selecciona un proyecto');
        return { ok: false };
      }
      if (!ledgerRows?.length) {
        showToast('error', 'Nada que exportar');
        return { ok: false };
      }
      exportLedgerSelection(ledgerRows, { project: pid });
      addLog({ action: 'exportWalletSelection', project: pid, meta: { count: ledgerRows.length } });
      showToast('success', `Exportados ${ledgerRows.length} movimiento(s)`);
      return { ok: true };
    },
    [state.currentProject, showToast, addLog],
  );

  const cancelOrder = useCallback(
    async (project, orderId) => {
      const res = await run(() => api.cancelOrder(project, orderId));
      if (res?.ok) {
        dispatch({ type: 'MERGE_ORDER', payload: { project, orderId, patch: { status: 'cancelled' } } });
        addLog({ action: 'cancelOrder', project, orderId });
        showToast('success', 'Orden cancelada');
      }
      return res;
    },
    [run, addLog, showToast],
  );

  const forceExecuteOrder = useCallback(
    async (project, orderId) => {
      const res = await run(() => api.forceExecuteOrder(project, orderId));
      if (res?.ok) {
        dispatch({ type: 'MERGE_ORDER', payload: { project, orderId, patch: { status: 'filled' } } });
        addLog({ action: 'forceExecuteOrder', project, orderId });
        showToast('success', 'Orden ejecutada (forzado · mock)');
      }
      return res;
    },
    [run, addLog, showToast],
  );

  const markDisputed = useCallback(
    async (project, orderId, note = '') => {
      const res = await run(() => api.markOrderDisputed(project, orderId, note));
      if (res?.ok) {
        dispatch({
          type: 'MERGE_ORDER',
          payload: {
            project,
            orderId,
            patch: {
              status: 'disputed',
              disputedAt: new Date().toISOString(),
              ...(res.disputeNote ? { disputeNote: res.disputeNote } : {}),
            },
          },
        });
        addLog({ action: 'markDisputed', project, orderId, meta: { note: res.disputeNote || '' } });
        showToast('success', 'Orden marcada en disputa');
      }
      return res;
    },
    [run, addLog, showToast],
  );

  const resolveDispute = useCallback(
    async (project, orderId, outcome) => {
      const res = await run(() => api.resolveOrderDispute(project, orderId, outcome));
      if (res?.ok) {
        dispatch({
          type: 'MERGE_ORDER',
          payload: {
            project,
            orderId,
            patch: {
              status: res.status,
              disputeResolvedAt: new Date().toISOString(),
              disputeOutcome: res.outcome,
            },
          },
        });
        addLog({
          action: 'resolveDispute',
          project,
          orderId,
          meta: { outcome: res.outcome, status: res.status },
        });
        showToast('success', 'Disputa resuelta');
      }
      return res;
    },
    [run, addLog, showToast],
  );

  const pauseMarket = useCallback(
    async (project, paused) => {
      const pv = assertProject(project);
      if (!pv.ok) {
        showToast('error', pv.error);
        return { ok: false };
      }
      const res = await run(() => api.pauseMarket(project, paused));
      if (res?.ok) {
        dispatch({
          type: 'SET_PROJECT_CONFIG',
          payload: { project, patch: { flags: { marketPaused: paused } } },
        });
        addLog({ action: 'pauseMarket', project, meta: { marketPaused: paused } });
        showToast('success', paused ? 'Mercado pausado' : 'Mercado activo');
      }
      return res;
    },
    [run, addLog, showToast],
  );

  const blockUserP2P = useCallback(
    async (project, userId, blocked) => {
      const lk = `p2p-block-${userId}`;
      setLoadingKey(lk, true);
      const res = await run(() => api.blockUserP2P(project, userId, blocked));
      setLoadingKey(lk, false);
      if (res?.ok) {
        dispatch({ type: 'MERGE_USER', payload: { project, userId, patch: { p2pBlocked: blocked } } });
        addLog({ action: 'blockUserP2P', project, userId, meta: { blocked: Boolean(blocked) } });
        showToast('success', blocked ? 'Usuario bloqueado en P2P' : 'P2P desbloqueado');
      }
      return res;
    },
    [run, addLog, showToast, setLoadingKey],
  );

  const saveProjectConfig = useCallback(
    async (project, patch) => {
      const pv = assertProject(project);
      if (!pv.ok) {
        showToast('error', pv.error);
        return { ok: false };
      }
      if (!patch || typeof patch !== 'object') {
        showToast('error', 'Config inválida');
        return { ok: false };
      }
      const key = 'config-save';
      setLoadingKey(key, true);
      const res = await run(() => api.updateConfig(project, patch));
      setLoadingKey(key, false);
      if (res?.ok) {
        dispatch({ type: 'SET_PROJECT_CONFIG', payload: { project, patch: res.patch } });
        addLog({ action: 'updateConfig', project, meta: { keys: Object.keys(patch) } });
        showToast('success', 'Configuración guardada (mock)');
      }
      return res;
    },
    [run, addLog, showToast, setLoadingKey],
  );

  const resetProjectConfig = useCallback(
    async (project) => {
      const pv = assertProject(project);
      if (!pv.ok) {
        showToast('error', pv.error);
        return { ok: false };
      }
      const key = 'config-reset';
      setLoadingKey(key, true);
      const res = await run(() => api.resetConfig(project));
      setLoadingKey(key, false);
      if (res?.ok) {
        dispatch({ type: 'RESET_PROJECT_CONFIG', payload: { project, config: res.config } });
        addLog({ action: 'resetConfig', project });
        showToast('success', 'Config restablecida (demo)');
      }
      return res;
    },
    [run, addLog, showToast, setLoadingKey],
  );

  const setRewardSystem = useCallback(
    async (project, enabled, opts = {}) => {
      const pv = assertProject(project);
      if (!pv.ok) {
        showToast('error', pv.error);
        return { ok: false };
      }
      dispatch({ type: 'SET_REWARD_SYSTEM', payload: { project, enabled } });
      dispatch({
        type: 'SET_PROJECT_CONFIG',
        payload: { project, patch: { rules: { rewardsEnabled: Boolean(enabled) } } },
      });
      addLog({ action: 'setRewardSystem', project, meta: { enabled: Boolean(enabled) } });
      if (opts.notify !== false) {
        showToast('success', enabled ? 'Recompensas activadas (proyecto)' : 'Recompensas desactivadas');
      }
      return { ok: true };
    },
    [addLog, showToast],
  );

  const securityActions = useMemo(
    () => ({
      blockIp: async (ip) => {
        const project = state.currentProject;
        if (!project) return { ok: false };
        const res = await run(() => api.blockIp(project, ip));
        if (res?.ok) {
          dispatch({
            type: 'MERGE_SECURITY',
            payload: {
              project,
              patchFn: (prev) => ({
                ...prev,
                blockedIps: [...new Set([...(prev.blockedIps || []), res.ip])],
                securityLogs: [
                  { id: `SEC-${Date.now()}`, actor: 'operator', action: 'ip.block', ts: new Date().toLocaleString() },
                  ...(prev.securityLogs || []),
                ],
              }),
            },
          });
          addLog({ action: 'security.blockIp', project, meta: { ip: res.ip } });
          showToast('success', 'IP bloqueada (mock)');
        }
        return res;
      },
      revokeSession: async (userId) => {
        const project = state.currentProject;
        if (!project) return { ok: false };
        const res = await run(() => api.revokeSession(project, userId));
        if (res?.ok) {
          dispatch({
            type: 'MERGE_SECURITY',
            payload: {
              project,
              patchFn: (prev) => ({
                ...prev,
                securityLogs: [
                  {
                    id: `SEC-${Date.now()}`,
                    actor: 'operator',
                    action: 'session.revoke',
                    ts: new Date().toLocaleString(),
                    userId,
                  },
                  ...(prev.securityLogs || []),
                ],
              }),
            },
          });
          addLog({ action: 'security.revokeSession', project, userId });
          showToast('success', 'Sesión revocada (mock)');
        }
        return res;
      },
      flagSuspicious: async (userId, note) => {
        const project = state.currentProject;
        if (!project) return { ok: false };
        const res = await run(() => api.flagSuspicious(project, userId, note));
        if (res?.ok) {
          dispatch({
            type: 'MERGE_SECURITY',
            payload: {
              project,
              patchFn: (prev) => ({
                ...prev,
                securityLogs: [
                  {
                    id: `SEC-${Date.now()}`,
                    actor: 'operator',
                    action: 'user.suspicious',
                    ts: new Date().toLocaleString(),
                    userId,
                    note: res.note,
                  },
                  ...(prev.securityLogs || []),
                ],
              }),
            },
          });
          addLog({ action: 'security.flagSuspicious', project, userId });
          showToast('success', 'Usuario marcado');
        }
        return res;
      },
    }),
    [state.currentProject, run, addLog, showToast],
  );

  const networkActions = useMemo(
    () => ({
      moveUser: async (userId, leg) => {
        const project = state.currentProject;
        if (!project) return { ok: false };
        const res = await run(() => api.moveUserLeg(project, userId, leg));
        if (res?.ok) {
          dispatch({
            type: 'MERGE_USER',
            payload: {
              project,
              userId,
              patch: {
                network: { leg: res.leg },
                historyAppend: {
                  ts: new Date().toISOString(),
                  action: 'network.move_leg',
                  detail: res.leg,
                },
              },
            },
          });
          addLog({ action: 'network.moveUser', project, userId, meta: { leg: res.leg } });
          showToast('success', `Pierna ${res.leg} (mock)`);
        }
        return res;
      },
      correct: async (userId) => {
        const project = state.currentProject;
        if (!project) return { ok: false };
        const res = await run(() => api.correctNetworkPosition(project, userId));
        if (res?.ok) {
          dispatch({
            type: 'MERGE_USER',
            payload: {
              project,
              userId,
              patch: {
                network: res.network,
                historyAppend: {
                  ts: new Date().toISOString(),
                  action: 'network.correct',
                  detail: 'volumen recalculado',
                },
              },
            },
          });
          addLog({ action: 'network.correct', project, userId });
          showToast('success', 'Posición corregida (mock)');
        }
        return res;
      },
      reassignSponsor: async (userId, sponsorId) => {
        const project = state.currentProject;
        if (!project) return { ok: false };
        return changeReferrer(project, userId, sponsorId);
      },
    }),
    [state.currentProject, run, addLog, showToast, changeReferrer],
  );

  const refreshFromService = useCallback(
    async (projectId) => {
      const pid = projectId || state.currentProject;
      const pv = assertProject(pid);
      if (!pv.ok) {
        showToast('error', pv.error);
        return;
      }
      dispatch({ type: 'SET_UI', payload: { loading: true } });
      try {
        const [u, w, o] = await Promise.all([api.getUsers(pid), api.getWalletLedger(pid), api.getOrders(pid)]);
        if (u.ok && w.ok && o.ok) {
          showToast('success', 'Datos sincronizados (seed demo · sin merge en vivo)');
        }
      } finally {
        dispatch({ type: 'SET_UI', payload: { loading: false } });
      }
    },
    [state.currentProject, showToast],
  );

  const toggleAccountActive = useCallback(
    async (project, userId, enabled) => {
      const key = `acct-${userId}`;
      setLoadingKey(key, true);
      const res = await run(() => api.updateUser(project, userId, { accountEnabled: enabled }));
      setLoadingKey(key, false);
      if (res?.ok) {
        dispatch({
          type: 'MERGE_USER',
          payload: {
            project,
            userId,
            patch: {
              accountEnabled: enabled,
              historyAppend: {
                ts: new Date().toISOString(),
                action: enabled ? 'account.activate' : 'account.deactivate',
                detail: '',
              },
            },
          },
        });
        addLog({ action: 'toggleAccountActive', project, userId, meta: { enabled } });
        showToast('success', enabled ? 'Cuenta activada' : 'Cuenta desactivada');
      }
      return res;
    },
    [run, addLog, showToast, setLoadingKey],
  );

  const isSwitchingProject = Boolean(state.ui?.isSwitchingProject);

  const value = useMemo(
    () => ({
      state,
      currentProject: state.currentProject,
      currentProjectMeta,
      isSwitchingProject,
      setCurrentProject,
      projectUsers,
      projectWalletLedger,
      projectTransactions,
      projectOrders,
      projectConfig,
      projectLogs,
      logs: state.logs || [],
      projectRewards,
      projectSecurity,
      rewardSystemEnabled,
      projectList: PROJECT_LIST,
      showToast,
      addLog,
      refreshFromService,
      isLoading,
      blockUser,
      updateUser,
      adjustBalance,
      sendEmail,
      sendInternalNotification,
      resetPassword,
      changeReferrer,
      toggleAccountActive,
      approveWithdraw,
      rejectWithdraw,
      freezeFunds,
      approveMultipleWithdraw,
      rejectMultipleWithdraw,
      freezeMultiple,
      exportSelection,
      cancelOrder,
      forceExecuteOrder,
      markDisputed,
      resolveDispute,
      pauseMarket,
      blockUserP2P,
      saveProjectConfig,
      resetProjectConfig,
      setRewardSystem,
      securityActions,
      networkActions,
    }),
    [
      state,
      currentProjectMeta,
      isSwitchingProject,
      setCurrentProject,
      projectUsers,
      projectWalletLedger,
      projectTransactions,
      projectOrders,
      projectConfig,
      projectLogs,
      projectRewards,
      projectSecurity,
      rewardSystemEnabled,
      showToast,
      addLog,
      refreshFromService,
      isLoading,
      blockUser,
      updateUser,
      adjustBalance,
      sendEmail,
      sendInternalNotification,
      resetPassword,
      changeReferrer,
      toggleAccountActive,
      approveWithdraw,
      rejectWithdraw,
      freezeFunds,
      approveMultipleWithdraw,
      rejectMultipleWithdraw,
      freezeMultiple,
      exportSelection,
      cancelOrder,
      forceExecuteOrder,
      markDisputed,
      resolveDispute,
      pauseMarket,
      blockUserP2P,
      saveProjectConfig,
      resetProjectConfig,
      setRewardSystem,
      securityActions,
      networkActions,
    ],
  );

  return <AdminCoreContext.Provider value={value}>{children}</AdminCoreContext.Provider>;
}

export function useAdminCore() {
  const ctx = useContext(AdminCoreContext);
  if (!ctx) throw new Error('useAdminCore must be used within AdminCoreProvider');
  return ctx;
}

export { assertProject, assertUserId } from '../lib/adminCoreValidation.js';
