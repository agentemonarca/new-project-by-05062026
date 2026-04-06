/**
 * Simulación API multi-proyecto — sustituir por fetch(`/api/admin/projects/${project}/...`).
 * Contrato: `{ ok, error?, ...payload }`
 */
import { ALL_USERS, ALL_WALLET_LEDGER, ALL_ORDERS, getDefaultProjectConfig } from '../data/mockMaster.js';
import { assertProject, assertUserId } from '../lib/adminCoreValidation.js';

const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));

function guardProject(project) {
  const v = assertProject(project);
  if (!v.ok) return v;
  return null;
}

export async function getUsers(project) {
  await delay(180);
  const g = guardProject(project);
  if (g) return g;
  const data = ALL_USERS.filter((u) => u.project === project);
  return { ok: true, data };
}

export async function getWalletLedger(project) {
  await delay(160);
  const g = guardProject(project);
  if (g) return g;
  const data = ALL_WALLET_LEDGER.filter((r) => r.project === project);
  return { ok: true, data };
}

/** @deprecated usar getWalletLedger */
export async function getTransactions(project) {
  return getWalletLedger(project);
}

export async function getOrders(project) {
  await delay(160);
  const g = guardProject(project);
  if (g) return g;
  const data = ALL_ORDERS.filter((o) => o.project === project);
  return { ok: true, data };
}

export async function updateConfig(project, patch) {
  await delay(200);
  const g = guardProject(project);
  if (g) return g;
  if (!patch || typeof patch !== 'object') return { ok: false, error: 'Config inválida' };
  return { ok: true, project, patch };
}

export async function resetConfig(project) {
  await delay(220);
  const g = guardProject(project);
  if (g) return g;
  return { ok: true, project, config: getDefaultProjectConfig(project) };
}

export async function blockUser(project, userId, blocked) {
  await delay();
  const g = guardProject(project);
  if (g) return g;
  const u = assertUserId(userId);
  if (!u.ok) return u;
  return { ok: true, project, userId, blocked: Boolean(blocked) };
}

export async function updateUser(project, userId, patch) {
  await delay();
  const g = guardProject(project);
  if (g) return g;
  const u = assertUserId(userId);
  if (!u.ok) return u;
  return { ok: true, project, userId, patch: patch ?? {} };
}

export async function adjustBalance(project, userId, delta) {
  await delay();
  const g = guardProject(project);
  if (g) return g;
  const u = assertUserId(userId);
  if (!u.ok) return u;
  const usd = Number(delta?.usd) || 0;
  const aig = Number(delta?.aig) || 0;
  return { ok: true, project, userId, delta: { usd, aig } };
}

export async function sendEmail(project, to, subject, body) {
  await delay();
  const g = guardProject(project);
  if (g) return g;
  const t = String(to ?? '').trim();
  if (!t) return { ok: false, error: 'Destinatario requerido' };
  if (!String(subject ?? '').trim()) return { ok: false, error: 'Asunto requerido' };
  void body;
  return { ok: true, project, to: t };
}

export async function sendInternalNotification(project, userId, title, body) {
  await delay();
  const g = guardProject(project);
  if (g) return g;
  const u = assertUserId(userId);
  if (!u.ok) return u;
  if (!String(title ?? '').trim()) return { ok: false, error: 'Título requerido' };
  void body;
  return { ok: true, project, userId };
}

export async function resetPassword(project, userId) {
  await delay(280);
  const g = guardProject(project);
  if (g) return g;
  const u = assertUserId(userId);
  if (!u.ok) return u;
  return { ok: true, project, userId };
}

export async function changeReferrer(project, userId, newReferrerId) {
  await delay();
  const g = guardProject(project);
  if (g) return g;
  const u = assertUserId(userId);
  if (!u.ok) return u;
  const nr = String(newReferrerId ?? '').trim();
  if (!nr) return { ok: false, error: 'Referidor requerido' };
  if (nr === userId) return { ok: false, error: 'Referidor inválido' };
  return { ok: true, project, userId, newReferrerId: nr };
}

export async function approveWithdraw(project, ledgerRowId) {
  await delay();
  const g = guardProject(project);
  if (g) return g;
  if (!ledgerRowId) return { ok: false, error: 'Movimiento inválido' };
  return { ok: true, project, txId: ledgerRowId, status: 'approved' };
}

export async function rejectWithdraw(project, ledgerRowId) {
  await delay();
  const g = guardProject(project);
  if (g) return g;
  if (!ledgerRowId) return { ok: false, error: 'Movimiento inválido' };
  return { ok: true, project, txId: ledgerRowId, status: 'rejected' };
}

/** @param {string[]} ledgerRowIds */
export async function approveMultipleWithdraw(project, ledgerRowIds) {
  await delay(320);
  const g = guardProject(project);
  if (g) return g;
  const ids = Array.isArray(ledgerRowIds) ? ledgerRowIds.filter(Boolean) : [];
  if (!ids.length) return { ok: false, error: 'Sin movimientos' };
  return { ok: true, project, rowIds: ids };
}

/** @param {string[]} ledgerRowIds */
export async function rejectMultipleWithdraw(project, ledgerRowIds) {
  await delay(320);
  const g = guardProject(project);
  if (g) return g;
  const ids = Array.isArray(ledgerRowIds) ? ledgerRowIds.filter(Boolean) : [];
  if (!ids.length) return { ok: false, error: 'Sin movimientos' };
  return { ok: true, project, rowIds: ids };
}

/** @param {string[]} userIds deduplicados en cliente */
export async function freezeMultiple(project, userIds) {
  await delay(380);
  const g = guardProject(project);
  if (g) return g;
  const ids = Array.isArray(userIds) ? [...new Set(userIds.map((x) => String(x).trim()).filter(Boolean))] : [];
  if (!ids.length) return { ok: false, error: 'Sin usuarios' };
  return { ok: true, project, userIds: ids };
}

export async function freezeFunds(project, userId, frozen) {
  await delay();
  const g = guardProject(project);
  if (g) return g;
  const u = assertUserId(userId);
  if (!u.ok) return u;
  return { ok: true, project, userId, fundsFrozen: Boolean(frozen) };
}

export async function cancelOrder(project, orderId) {
  await delay();
  const g = guardProject(project);
  if (g) return g;
  if (!orderId) return { ok: false, error: 'Orden inválida' };
  return { ok: true, project, orderId, status: 'cancelled' };
}

export async function forceExecuteOrder(project, orderId) {
  await delay(300);
  const g = guardProject(project);
  if (g) return g;
  if (!orderId) return { ok: false, error: 'Orden inválida' };
  return { ok: true, project, orderId, status: 'filled' };
}

/** Marca orden P2P en disputa (operador). */
export async function markOrderDisputed(project, orderId, note = '') {
  await delay(260);
  const g = guardProject(project);
  if (g) return g;
  if (!orderId) return { ok: false, error: 'Orden inválida' };
  const disputeNote = String(note ?? '').trim().slice(0, 500);
  return { ok: true, project, orderId, status: 'disputed', disputeNote };
}

/**
 * Resuelve disputa: reopen → open, complete → filled, cancel → cancelled
 * @param {'reopen' | 'complete' | 'cancel'} outcome
 */
export async function resolveOrderDispute(project, orderId, outcome) {
  await delay(280);
  const g = guardProject(project);
  if (g) return g;
  if (!orderId) return { ok: false, error: 'Orden inválida' };
  const o = String(outcome || '');
  if (!['reopen', 'complete', 'cancel'].includes(o)) return { ok: false, error: 'Resolución inválida' };
  const statusMap = { reopen: 'open', complete: 'filled', cancel: 'cancelled' };
  return { ok: true, project, orderId, status: statusMap[o], outcome: o };
}

export async function pauseMarket(project, paused) {
  await delay(150);
  const g = guardProject(project);
  if (g) return g;
  return { ok: true, project, marketPaused: Boolean(paused) };
}

export async function blockUserP2P(project, userId, blocked) {
  await delay();
  const g = guardProject(project);
  if (g) return g;
  const u = assertUserId(userId);
  if (!u.ok) return u;
  return { ok: true, project, userId, p2pBlocked: Boolean(blocked) };
}

export async function blockIp(project, ip) {
  await delay();
  const g = guardProject(project);
  if (g) return g;
  const v = String(ip ?? '').trim();
  if (!v) return { ok: false, error: 'IP requerida' };
  return { ok: true, project, ip: v };
}

export async function revokeSession(project, userId) {
  await delay();
  const g = guardProject(project);
  if (g) return g;
  const u = assertUserId(userId);
  if (!u.ok) return u;
  return { ok: true, project, userId };
}

export async function flagSuspicious(project, userId, note) {
  await delay();
  const g = guardProject(project);
  if (g) return g;
  const u = assertUserId(userId);
  if (!u.ok) return u;
  return { ok: true, project, userId, note: String(note ?? '') };
}

export async function moveUserLeg(project, userId, leg) {
  await delay();
  const g = guardProject(project);
  if (g) return g;
  const u = assertUserId(userId);
  if (!u.ok) return u;
  const L = leg === 'L' || leg === 'R' ? leg : null;
  if (!L) return { ok: false, error: 'Pierna inválida' };
  return { ok: true, project, userId, leg: L };
}

export async function correctNetworkPosition(project, userId) {
  await delay(260);
  const g = guardProject(project);
  if (g) return g;
  const u = assertUserId(userId);
  if (!u.ok) return u;
  return {
    ok: true,
    project,
    userId,
    network: {
      volumeLeft: Math.round(1000 + Math.random() * 8000),
      volumeRight: Math.round(1000 + Math.random() * 8000),
    },
  };
}
