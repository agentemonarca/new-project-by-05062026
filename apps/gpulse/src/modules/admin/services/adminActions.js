/**
 * Capa de acciones administrativas — mock async, lista para sustituir por fetch(API).
 * Todas las funciones devuelven `{ ok: boolean, error?: string, ...payload }`.
 */
const delay = (ms = 280) => new Promise((r) => setTimeout(r, ms));

export async function updateUser(userId, patch) {
  await delay();
  if (!userId) return { ok: false, error: 'Usuario inválido' };
  return { ok: true, userId, patch: patch ?? {} };
}

export async function blockUser(userId, blocked) {
  await delay();
  if (!userId) return { ok: false, error: 'Usuario inválido' };
  return { ok: true, userId, blocked: Boolean(blocked) };
}

export async function setAccountActive(userId, active) {
  await delay();
  if (!userId) return { ok: false, error: 'Usuario inválido' };
  return { ok: true, userId, accountEnabled: Boolean(active) };
}

export async function sendEmail(to, subject, body) {
  await delay();
  const t = String(to ?? '').trim();
  if (!t) return { ok: false, error: 'Destinatario requerido' };
  if (!String(subject ?? '').trim()) return { ok: false, error: 'Asunto requerido' };
  return { ok: true, to: t, messageId: `mock-${Date.now()}` };
}

export async function sendInternalNotification(userId, title, body) {
  await delay();
  if (!userId) return { ok: false, error: 'Usuario requerido' };
  return { ok: true, userId, notificationId: `inapp-${Date.now()}` };
}

export async function sendBulkEmail(recipients, subject, body) {
  await delay(400);
  const list = Array.isArray(recipients) ? recipients.filter(Boolean) : [];
  if (!list.length) return { ok: false, error: 'Sin destinatarios' };
  return { ok: true, count: list.length, batchId: `bulk-${Date.now()}` };
}

export async function resendVerificationCode(email) {
  await delay();
  const e = String(email ?? '').trim();
  if (!e) return { ok: false, error: 'Email requerido' };
  return { ok: true, email: e };
}

export async function resetPasswordMock(userId) {
  await delay(350);
  if (!userId) return { ok: false, error: 'Usuario inválido' };
  return { ok: true, userId, tempToken: `tmp-${Date.now()}` };
}

export async function adjustBalance(userId, { aig = 0, usd = 0 } = {}) {
  await delay();
  if (!userId) return { ok: false, error: 'Usuario inválido' };
  const da = Number(aig) || 0;
  const du = Number(usd) || 0;
  return { ok: true, userId, delta: { aig: da, usd: du } };
}

export async function cancelOrder(orderId) {
  await delay();
  if (!orderId) return { ok: false, error: 'Orden inválida' };
  return { ok: true, orderId };
}

export async function updateConfig(configPatch) {
  await delay(200);
  if (!configPatch || typeof configPatch !== 'object') return { ok: false, error: 'Config vacía' };
  return { ok: true, config: configPatch };
}

export async function resetConfig() {
  await delay(250);
  return { ok: true };
}

export async function networkMoveUserMock(userId, targetLeg) {
  await delay();
  if (!userId) return { ok: false, error: 'Usuario inválido' };
  const leg = targetLeg === 'R' ? 'R' : 'L';
  return { ok: true, userId, leg };
}

export async function networkCorrectPositionMock(userId) {
  await delay();
  if (!userId) return { ok: false, error: 'Usuario inválido' };
  return { ok: true, userId };
}

export async function networkReassignSponsorMock(userId, newSponsorId) {
  await delay();
  if (!userId || !newSponsorId) return { ok: false, error: 'Datos incompletos' };
  return { ok: true, userId, newSponsorId: String(newSponsorId) };
}

export async function walletApproveWithdrawal(withdrawalId) {
  await delay();
  if (!withdrawalId) return { ok: false, error: 'Retiro inválido' };
  return { ok: true, withdrawalId, status: 'approved' };
}

export async function walletRejectWithdrawal(withdrawalId) {
  await delay();
  if (!withdrawalId) return { ok: false, error: 'Retiro inválido' };
  return { ok: true, withdrawalId, status: 'rejected' };
}

export async function walletFreezeFunds(userId, frozen) {
  await delay();
  if (!userId) return { ok: false, error: 'Usuario inválido' };
  return { ok: true, userId, fundsFrozen: Boolean(frozen) };
}

export async function rewardsAdjustDirect(userId, pct) {
  await delay();
  if (!userId) return { ok: false, error: 'Usuario inválido' };
  const p = Number(pct);
  if (!Number.isFinite(p)) return { ok: false, error: 'Porcentaje inválido' };
  return { ok: true, userId, directPct: p };
}

export async function rewardsAdjustBinary(userId, pct) {
  await delay();
  if (!userId) return { ok: false, error: 'Usuario inválido' };
  const p = Number(pct);
  if (!Number.isFinite(p)) return { ok: false, error: 'Porcentaje inválido' };
  return { ok: true, userId, binaryPct: p };
}

export async function rewardsForcePay(userId) {
  await delay(400);
  if (!userId) return { ok: false, error: 'Usuario inválido' };
  return { ok: true, userId, payoutId: `pay-${Date.now()}` };
}

export async function rewardsResetUser(userId) {
  await delay();
  if (!userId) return { ok: false, error: 'Usuario inválido' };
  return { ok: true, userId };
}

export async function p2pPauseMarket(paused) {
  await delay(150);
  return { ok: true, marketPaused: Boolean(paused) };
}

export async function p2pBlockUser(userId, blocked) {
  await delay();
  if (!userId) return { ok: false, error: 'Usuario inválido' };
  return { ok: true, userId, p2pBlocked: Boolean(blocked) };
}

export async function p2pForceExecuteOrder(orderId) {
  await delay(500);
  if (!orderId) return { ok: false, error: 'Orden inválida' };
  return { ok: true, orderId, status: 'filled' };
}

export async function securityBlockIpMock(ip) {
  await delay();
  const i = String(ip ?? '').trim();
  if (!i) return { ok: false, error: 'IP requerida' };
  return { ok: true, ip: i };
}

export async function securityRevokeSessionMock(userId) {
  await delay();
  if (!userId) return { ok: false, error: 'Usuario inválido' };
  return { ok: true, userId };
}

export async function securityFlagSuspiciousMock(userId, note) {
  await delay();
  return { ok: true, userId, note: String(note ?? '').slice(0, 200) };
}

/** Alias explícito para panel de usuarios (misma semántica que reasignación de sponsor). */
export async function changeReferrer(userId, newReferrerId) {
  return networkReassignSponsorMock(userId, newReferrerId);
}
