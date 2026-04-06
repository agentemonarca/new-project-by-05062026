import { assertProject } from './adminCoreValidation.js';

/** Identidad mock del operador hasta integrar SSO / sesión real. */
export const MOCK_AUDIT_OPERATOR = 'operator@aigenesis.internal';

/**
 * Acciones consideradas críticas para resaltar en UI (fintech).
 * @type {ReadonlySet<string>}
 */
export const CRITICAL_AUDIT_ACTIONS = new Set([
  'blockUser',
  'freezeFunds',
  'freezeMultiple',
  'blockUserP2P',
  'approveWithdraw',
  'rejectWithdraw',
  'approveMultipleWithdraw',
  'rejectMultipleWithdraw',
  'adjustBalance',
  'resetPassword',
  'changeReferrer',
  'security.blockIp',
  'security.revokeSession',
  'security.flagSuspicious',
  'forceExecuteOrder',
  'markDisputed',
  'resolveDispute',
  'resetConfig',
  'toggleAccountActive',
]);

/**
 * @param {string} action
 */
export function isCriticalAuditAction(action) {
  return CRITICAL_AUDIT_ACTIONS.has(String(action || ''));
}

/**
 * @typedef {{
 *   id: string,
 *   action: string,
 *   project: string,
 *   admin: string,
 *   targetId: string | null,
 *   meta: Record<string, unknown>,
 *   timestamp: number,
 * }} AuditLog
 */

/**
 * Construye un registro de auditoría validado.
 * @param {object} input
 * @param {string} input.action
 * @param {string} input.project
 * @param {string} [input.admin]
 * @param {string | null} [input.targetId]
 * @param {object} [input.meta]
 * @param {string} [input.id]
 * @param {number} [input.timestamp]
 * @param {string} [input.userId] legacy
 * @param {string} [input.orderId] legacy
 * @param {string} [input.txId] legacy
 * @param {string} [input.actor] legacy
 * @returns {{ ok: true, log: AuditLog } | { ok: false, error: string }}
 */
export function buildAuditLogFromPartial(input) {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Registro vacío o inválido' };
  }

  const action = String(input.action ?? '').trim();
  if (!action) {
    return { ok: false, error: 'action es obligatoria' };
  }

  const pv = assertProject(input.project);
  if (!pv.ok) {
    return { ok: false, error: pv.error };
  }

  const rawMeta = input.meta;
  if (rawMeta != null && (typeof rawMeta !== 'object' || Array.isArray(rawMeta))) {
    return { ok: false, error: 'meta debe ser un objeto' };
  }

  const adminRaw = input.admin ?? input.actor ?? MOCK_AUDIT_OPERATOR;
  const admin = String(adminRaw).trim() || MOCK_AUDIT_OPERATOR;

  let targetId =
    input.targetId != null && input.targetId !== ''
      ? input.targetId
      : input.userId ?? input.orderId ?? input.txId ?? null;
  if (targetId != null) {
    targetId = String(targetId).trim() || null;
  }

  /** @type {Record<string, unknown>} */
  const meta = { ...(rawMeta && typeof rawMeta === 'object' ? rawMeta : {}) };
  if (input.userId != null && meta.userId === undefined) meta.userId = input.userId;
  if (input.orderId != null && meta.orderId === undefined) meta.orderId = input.orderId;
  if (input.txId != null && meta.txId === undefined) meta.txId = input.txId;
  if (input.actor != null && meta.legacyActor === undefined) meta.legacyActor = input.actor;
  if (input.risk != null && meta.risk === undefined) meta.risk = input.risk;
  if (input.label != null && meta.label === undefined) meta.label = input.label;

  const id =
    typeof input.id === 'string' && input.id.trim()
      ? input.id.trim()
      : `log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const ts = input.timestamp;
  const timestamp =
    typeof ts === 'number' && Number.isFinite(ts) && ts > 0 ? ts : Date.now();

  const log = {
    id,
    action,
    project: input.project,
    admin,
    targetId,
    meta,
    timestamp,
  };

  return { ok: true, log };
}

/**
 * Normaliza filas antiguas o parciales para visualización.
 * @param {object} row
 */
export function displayAuditRow(row) {
  if (!row || typeof row !== 'object') {
    return {
      id: '—',
      action: '—',
      project: '—',
      admin: '—',
      targetId: null,
      meta: {},
      timestamp: 0,
    };
  }
  const action = String(row.action ?? '—');
  const project = String(row.project ?? '—');
  const admin = String(row.admin ?? row.actor ?? MOCK_AUDIT_OPERATOR);
  const targetId =
    row.targetId != null
      ? String(row.targetId)
      : row.userId != null
        ? String(row.userId)
        : row.orderId != null
          ? String(row.orderId)
          : row.txId != null
            ? String(row.txId)
            : null;
  const meta =
    row.meta && typeof row.meta === 'object' && !Array.isArray(row.meta)
      ? row.meta
      : {
          ...(row.userId != null ? { userId: row.userId } : {}),
          ...(row.orderId != null ? { orderId: row.orderId } : {}),
          ...(row.txId != null ? { txId: row.txId } : {}),
          ...(row.risk != null ? { risk: row.risk } : {}),
          ...(row.label != null ? { label: row.label } : {}),
        };
  const timestamp =
    typeof row.timestamp === 'number' && Number.isFinite(row.timestamp)
      ? row.timestamp
      : row.ts != null
        ? Number(row.ts)
        : 0;
  return {
    id: String(row.id ?? '—'),
    action,
    project,
    admin,
    targetId,
    meta,
    timestamp,
  };
}
