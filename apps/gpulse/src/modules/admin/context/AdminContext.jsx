import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { adminReducer } from './adminReducer.js';
import { buildInitialAdminState } from './adminInitialState.js';
import * as actions from '../services/adminActions.js';

/** @typedef {ReturnType<typeof buildInitialAdminState>} AdminStateFull */

const AdminContext = createContext(/** @type {any} */ (null));

function pushLog(dispatch, actor, actionName, risk = 'low') {
  dispatch({
    type: 'ADD_SECURITY_LOG',
    payload: {
      id: `SEC-${Date.now()}`,
      actor,
      action: actionName,
      ts: 'Ahora',
      risk,
    },
  });
}

export function AdminProvider({ children }) {
  const [state, dispatch] = useReducer(adminReducer, undefined, buildInitialAdminState);
  const toastTimer = useRef(0);

  const showToast = useCallback((type, message) => {
    window.clearTimeout(toastTimer.current);
    dispatch({ type: 'SET_TOAST', payload: { type, message: String(message || '') } });
    toastTimer.current = window.setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 4200);
  }, []);

  const run = useCallback(
    async (key, fn) => {
      dispatch({ type: 'SET_LOADING', payload: { key, value: true } });
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
      } finally {
        dispatch({ type: 'SET_LOADING', payload: { key, value: false } });
      }
    },
    [showToast],
  );

  const updateUserField = useCallback(
    async (userId, patch) => {
      const res = await run(`user-${userId}`, () => actions.updateUser(userId, patch));
      if (res?.ok) {
        dispatch({ type: 'MERGE_USER', payload: { userId, patch } });
        pushLog(dispatch, 'operator', `user.update · ${userId}`, 'low');
        showToast('success', 'Usuario actualizado');
      }
      return res;
    },
    [run, showToast],
  );

  const toggleBlockUser = useCallback(
    async (userId, blocked) => {
      const res = await run(`block-${userId}`, () => actions.blockUser(userId, blocked));
      if (res?.ok) {
        dispatch({
          type: 'MERGE_USER',
          payload: { userId, patch: { status: blocked ? 'blocked' : 'active' } },
        });
        pushLog(dispatch, 'operator', blocked ? `user.block · ${userId}` : `user.unblock · ${userId}`, 'medium');
        showToast('success', blocked ? 'Usuario bloqueado' : 'Usuario desbloqueado');
      }
      return res;
    },
    [run, showToast],
  );

  const toggleAccountActive = useCallback(
    async (userId, active) => {
      const res = await run(`acct-${userId}`, () => actions.setAccountActive(userId, active));
      if (res?.ok) {
        dispatch({ type: 'MERGE_USER', payload: { userId, patch: { accountEnabled: active } } });
        pushLog(dispatch, 'operator', `user.account.${active ? 'on' : 'off'} · ${userId}`, 'medium');
        showToast('success', active ? 'Cuenta activada' : 'Cuenta desactivada');
      }
      return res;
    },
    [run, showToast],
  );

  const sendEmailUser = useCallback(
    async (to, subject, body) => {
      const res = await run('email', () => actions.sendEmail(to, subject, body));
      if (res?.ok) {
        pushLog(dispatch, 'operator', `comms.email · ${to}`, 'low');
        showToast('success', 'Email enviado (mock)');
      }
      return res;
    },
    [run, showToast],
  );

  const sendInternal = useCallback(
    async (userId, title, body) => {
      const res = await run('inapp', () => actions.sendInternalNotification(userId, title, body));
      if (res?.ok) {
        pushLog(dispatch, 'operator', `comms.inapp · ${userId}`, 'low');
        showToast('success', 'Notificación interna enviada');
      }
      return res;
    },
    [run, showToast],
  );

  const sendBulk = useCallback(
    async (recipients, subject, body) => {
      const res = await run('bulk-email', () => actions.sendBulkEmail(recipients, subject, body));
      if (res?.ok) {
        pushLog(dispatch, 'operator', `comms.bulk · ${res.count}`, 'medium');
        showToast('success', `Cola masiva: ${res.count} destinatarios`);
      }
      return res;
    },
    [run, showToast],
  );

  const resendVerify = useCallback(
    async (email) => {
      const res = await run('verify-resend', () => actions.resendVerificationCode(email));
      if (res?.ok) showToast('success', 'Código reenviado (mock)');
      return res;
    },
    [run, showToast],
  );

  const resetPassword = useCallback(
    async (userId) => {
      const res = await run(`pwd-${userId}`, () => actions.resetPasswordMock(userId));
      if (res?.ok) {
        pushLog(dispatch, 'operator', `user.reset_pwd · ${userId}`, 'medium');
        showToast('success', 'Reset solicitado — flujo mock');
      }
      return res;
    },
    [run, showToast],
  );

  const adjustUserBalance = useCallback(
    async (userId, delta) => {
      const res = await run(`bal-${userId}`, () => actions.adjustBalance(userId, delta));
      if (res?.ok) {
        const u = state.users.find((x) => x.id === userId);
        if (u) {
          dispatch({
            type: 'MERGE_USER',
            payload: {
              userId,
              patch: {
                balances: {
                  aig: (u.balances?.aig || 0) + (res.delta?.aig || 0),
                  usd: (u.balances?.usd || 0) + (res.delta?.usd || 0),
                },
                history: [
                  {
                    ts: new Date().toISOString().slice(0, 16).replace('T', ' '),
                    action: 'admin_adjust',
                    detail: `Δ AIG ${res.delta?.aig ?? 0} · USD ${res.delta?.usd ?? 0}`,
                  },
                ],
              },
            },
          });
        }
        pushLog(dispatch, 'operator', `wallet.adjust · ${userId}`, 'high');
        showToast('success', 'Balance ajustado');
      }
      return res;
    },
    [run, state.users, showToast],
  );

  const cancelP2POrder = useCallback(
    async (orderId) => {
      const res = await run(`ord-${orderId}`, () => actions.cancelOrder(orderId));
      if (res?.ok) {
        dispatch({ type: 'UPDATE_ORDER', payload: { orderId, patch: { status: 'cancelled' } } });
        pushLog(dispatch, 'operator', `p2p.cancel · ${orderId}`, 'medium');
        showToast('success', 'Orden cancelada');
      }
      return res;
    },
    [run, showToast],
  );

  const saveGlobalConfig = useCallback(
    async (patch) => {
      const res = await run('config-save', () => actions.updateConfig(patch));
      if (res?.ok) {
        dispatch({ type: 'SET_GLOBAL_CONFIG', payload: patch });
        pushLog(dispatch, 'operator', 'config.save', 'medium');
        showToast('success', 'Configuración aplicada en tiempo real (mock)');
      }
      return res;
    },
    [run, showToast],
  );

  const resetGlobalConfig = useCallback(async () => {
    const fresh = buildInitialAdminState();
    const res = await run('config-reset', () => actions.resetConfig());
    if (res?.ok) {
      dispatch({ type: 'RESET_GLOBAL_CONFIG', payload: fresh.globalConfig });
      dispatch({ type: 'SET_REWARD_SYSTEM', payload: fresh.rewardSystemEnabled });
      dispatch({ type: 'SET_MARKET_PAUSED', payload: fresh.marketPaused });
      showToast('success', 'Config restablecida a demo');
    }
    return res;
  }, [run, showToast]);

  const setRewardSystem = useCallback(
    async (enabled) => {
      const res = await run('rewards-sys', async () => ({ ok: true }));
      if (res?.ok) {
        dispatch({ type: 'SET_REWARD_SYSTEM', payload: enabled });
        dispatch({
          type: 'SET_GLOBAL_CONFIG',
          payload: { rules: { rewardsEnabled: enabled } },
        });
        pushLog(dispatch, 'operator', `rewards.system.${enabled ? 'on' : 'off'}`, 'high');
        showToast('success', enabled ? 'Recompensas activadas' : 'Recompensas desactivadas');
      }
    },
    [run, state.globalConfig.rules, showToast],
  );

  const setMarketPaused = useCallback(
    async (paused) => {
      const res = await run('p2p-pause', () => actions.p2pPauseMarket(paused));
      if (res?.ok) {
        dispatch({ type: 'SET_MARKET_PAUSED', payload: paused });
        pushLog(dispatch, 'operator', paused ? 'p2p.market.pause' : 'p2p.market.resume', 'high');
        showToast('success', paused ? 'Mercado P2P pausado' : 'Mercado reanudado');
      }
      return res;
    },
    [run, showToast],
  );

  const p2pBlockUser = useCallback(
    async (userId, blocked) => {
      const res = await run(`p2p-block-${userId}`, () => actions.p2pBlockUser(userId, blocked));
      if (res?.ok) {
        dispatch({ type: 'MERGE_USER', payload: { userId, patch: { p2pBlocked: blocked } } });
        showToast('success', blocked ? 'Usuario bloqueado en P2P' : 'Usuario desbloqueado P2P');
      }
      return res;
    },
    [run, showToast],
  );

  const forceExecuteOrder = useCallback(
    async (orderId) => {
      const res = await run(`p2p-force-${orderId}`, () => actions.p2pForceExecuteOrder(orderId));
      if (res?.ok) {
        dispatch({ type: 'UPDATE_ORDER', payload: { orderId, patch: { status: 'filled' } } });
        showToast('success', 'Orden ejecutada (mock)');
      }
      return res;
    },
    [run, showToast],
  );

  const changeReferrer = useCallback(
    async (userId, newReferrerId) => {
      const res = await run(`ref-${userId}`, () => actions.changeReferrer(userId, newReferrerId));
      if (res?.ok) {
        dispatch({ type: 'MERGE_USER', payload: { userId, patch: { referrerId: res.newReferrerId } } });
        pushLog(dispatch, 'operator', `user.change_referrer · ${userId} → ${res.newReferrerId}`, 'high');
        showToast('success', 'Referidor actualizado');
      }
      return res;
    },
    [run, showToast],
  );

  const networkActions = useMemo(
    () => ({
      moveUser: async (userId, leg) => {
        const res = await run(`net-move-${userId}`, () => actions.networkMoveUserMock(userId, leg));
        if (res?.ok) {
          dispatch({ type: 'MERGE_USER', payload: { userId, patch: { network: { leg: res.leg } } } });
          showToast('success', `Usuario movido a pierna ${res.leg}`);
        }
        return res;
      },
      correct: async (userId) => {
        const res = await run(`net-fix-${userId}`, () => actions.networkCorrectPositionMock(userId));
        if (res?.ok) showToast('success', 'Posición corregida (mock)');
        return res;
      },
      reassignSponsor: async (userId, newSponsorId) => {
        return changeReferrer(userId, newSponsorId);
      },
    }),
    [run, showToast, changeReferrer],
  );

  const walletActions = useMemo(
    () => ({
      approveWithdrawal: async (withdrawalId) => {
        const res = await run(`wd-ap-${withdrawalId}`, () =>
          actions.walletApproveWithdrawal(withdrawalId),
        );
        if (res?.ok) {
          dispatch({ type: 'UPDATE_WITHDRAWAL', payload: { withdrawalId, patch: { status: 'approved' } } });
          showToast('success', 'Retiro aprobado');
        }
        return res;
      },
      rejectWithdrawal: async (withdrawalId) => {
        const res = await run(`wd-rj-${withdrawalId}`, () =>
          actions.walletRejectWithdrawal(withdrawalId),
        );
        if (res?.ok) {
          dispatch({ type: 'UPDATE_WITHDRAWAL', payload: { withdrawalId, patch: { status: 'rejected' } } });
          showToast('success', 'Retiro rechazado');
        }
        return res;
      },
      freezeFunds: async (userId, frozen) => {
        const res = await run(`frz-${userId}`, () => actions.walletFreezeFunds(userId, frozen));
        if (res?.ok) {
          dispatch({ type: 'MERGE_USER', payload: { userId, patch: { fundsFrozen: frozen } } });
          showToast('success', frozen ? 'Fondos congelados' : 'Fondos liberados');
        }
        return res;
      },
    }),
    [run, showToast],
  );

  const rewardActions = useMemo(
    () => ({
      setDirect: async (userId, pct) => {
        const res = await run(`rw-d-${userId}`, () => actions.rewardsAdjustDirect(userId, pct));
        if (res?.ok) {
          dispatch({ type: 'MERGE_USER', payload: { userId, patch: { rewards: { directPct: res.directPct } } } });
          showToast('success', 'Bono directo actualizado');
        }
        return res;
      },
      setBinary: async (userId, pct) => {
        const res = await run(`rw-b-${userId}`, () => actions.rewardsAdjustBinary(userId, pct));
        if (res?.ok) {
          dispatch({ type: 'MERGE_USER', payload: { userId, patch: { rewards: { binaryPct: res.binaryPct } } } });
          showToast('success', 'Bono binario actualizado');
        }
        return res;
      },
      forcePay: async (userId) => {
        const res = await run(`rw-pay-${userId}`, () => actions.rewardsForcePay(userId));
        if (res?.ok) {
          dispatch({
            type: 'MERGE_USER',
            payload: { userId, patch: { rewards: { pendingPayout: 0 } } },
          });
          showToast('success', 'Pago forzado (mock)');
        }
        return res;
      },
      resetUser: async (userId) => {
        const res = await run(`rw-rst-${userId}`, () => actions.rewardsResetUser(userId));
        if (res?.ok) {
          dispatch({
            type: 'MERGE_USER',
            payload: {
              userId,
              patch: { rewards: { directPct: 11, binaryPct: 10, pendingPayout: 0 } },
            },
          });
          showToast('success', 'Recompensas reiniciadas para el usuario');
        }
        return res;
      },
    }),
    [run, showToast],
  );

  const securityActions = useMemo(
    () => ({
      blockIp: async (ip) => {
        const res = await run(`ip-${ip}`, () => actions.securityBlockIpMock(ip));
        if (res?.ok) {
          dispatch({ type: 'ADD_BLOCKED_IP', payload: res.ip });
          showToast('success', `IP bloqueada · ${res.ip}`);
        }
        return res;
      },
      revokeSession: async (userId) => {
        const res = await run(`sess-${userId}`, () => actions.securityRevokeSessionMock(userId));
        if (res?.ok) {
          pushLog(dispatch, 'operator', `security.revoke_session · ${userId}`, 'high');
          showToast('success', 'Sesión revocada (mock)');
        }
        return res;
      },
      flagSuspicious: async (userId, note) => {
        const res = await run(`sus-${userId}`, () => actions.securityFlagSuspiciousMock(userId, note));
        if (res?.ok) {
          pushLog(dispatch, 'system', `suspicious · ${userId}`, 'high');
          showToast('success', 'Actividad marcada');
        }
        return res;
      },
    }),
    [run, showToast],
  );

  const isLoading = useCallback((key) => Boolean(state.ui.loading[key]), [state.ui.loading]);

  const clearToast = useCallback(() => dispatch({ type: 'CLEAR_TOAST' }), []);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      showToast,
      clearToast,
      updateUserField,
      toggleBlockUser,
      toggleAccountActive,
      sendEmailUser,
      sendInternal,
      sendBulk,
      resendVerify,
      resetPassword,
      adjustUserBalance,
      cancelP2POrder,
      changeReferrer,
      saveGlobalConfig,
      resetGlobalConfig,
      setRewardSystem,
      setMarketPaused,
      p2pBlockUser,
      forceExecuteOrder,
      networkActions,
      walletActions,
      rewardActions,
      securityActions,
      isLoading,
    }),
    [
      state,
      showToast,
      clearToast,
      updateUserField,
      toggleBlockUser,
      toggleAccountActive,
      sendEmailUser,
      sendInternal,
      sendBulk,
      resendVerify,
      resetPassword,
      adjustUserBalance,
      cancelP2POrder,
      changeReferrer,
      saveGlobalConfig,
      resetGlobalConfig,
      setRewardSystem,
      setMarketPaused,
      p2pBlockUser,
      forceExecuteOrder,
      networkActions,
      walletActions,
      rewardActions,
      securityActions,
      isLoading,
    ],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
