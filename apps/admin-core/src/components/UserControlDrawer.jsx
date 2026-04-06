import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAdminCore } from '../context/AdminCoreContext.jsx';
import { AdminSidePanel } from './AdminSidePanel.jsx';
import { UserDetailCard } from './UserDetailCard.jsx';
import { EditableFields } from './EditableFields.jsx';
import { ActionButtons } from './ActionButtons.jsx';
import { ConfirmModal } from './ConfirmModal.jsx';
import {
  USER_ROLES,
  PERMISSION_KEYS,
  ROLE_PRESETS,
  normalizeUserAccess,
} from '../lib/userPermissions.js';

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

const INPUT_SM =
  'w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/40';

/**
 * Centro de control de usuario — multi-proyecto (`currentProject`).
 * @param {{ userId: string | null, open: boolean, onClose: () => void }} props
 */
function UserControlDrawerInner({ userId, open, onClose }) {
  const {
    currentProject,
    projectUsers,
    projectOrders,
    showToast,
    blockUser,
    toggleAccountActive,
    resetPassword,
    sendEmail,
    sendInternalNotification,
    adjustBalance,
    updateUser,
    cancelOrder,
    changeReferrer,
    blockUserP2P,
    isLoading,
  } = useAdminCore();

  const user = useMemo(
    () => projectUsers.find((u) => u.id === userId) ?? null,
    [projectUsers, userId],
  );
  const userOrders = useMemo(
    () => (userId ? projectOrders.filter((o) => o.userId === userId) : []),
    [projectOrders, userId],
  );

  const [confirm, setConfirm] = useState(
    /** @type {null | { title: string, message: string, onOk: () => void }} */ (null),
  );

  const [draftEmail, setDraftEmail] = useState('');
  const [draftUsername, setDraftUsername] = useState('');
  const [emailSubject, setEmailSubject] = useState('Mensaje AiGenesis — operaciones');
  const [emailBody, setEmailBody] = useState('');
  const [inTitle, setInTitle] = useState('Aviso operativo');
  const [inBody, setInBody] = useState('');
  const [adjAig, setAdjAig] = useState('');
  const [adjUsd, setAdjUsd] = useState('');
  const [newReferrerId, setNewReferrerId] = useState('');
  const [draftRole, setDraftRole] = useState('member');
  const [draftPermissions, setDraftPermissions] = useState(() => ({ ...ROLE_PRESETS.member }));

  useEffect(() => {
    if (!user) return;
    setDraftEmail(user.email || '');
    setDraftUsername(user.username || '');
    setNewReferrerId('');
    const { role, permissions } = normalizeUserAccess(user);
    setDraftRole(role);
    setDraftPermissions({ ...permissions });
  }, [user]);

  const ask = useCallback((title, message, onOk) => setConfirm({ title, message, onOk }), []);
  const runConfirm = useCallback(() => {
    confirm?.onOk?.();
    setConfirm(null);
  }, [confirm]);

  const busyGlobal = useMemo(() => {
    if (!user || !currentProject) return false;
    const id = user.id;
    return [
      `block-${id}`,
      `acct-${id}`,
      `pwd-${id}`,
      `bal-${id}`,
      `user-${id}`,
      'email',
      'inapp',
      `ref-${id}`,
      `p2p-block-${id}`,
    ].some((k) => isLoading(k));
  }, [user, isLoading, currentProject]);

  const onSaveProfile = useCallback(() => {
    if (!user || !currentProject) return;
    const email = draftEmail.trim();
    const username = draftUsername.trim();
    if (!email || !username) {
      showToast('error', 'Email y username son obligatorios');
      return;
    }
    updateUser(currentProject, user.id, { email, username });
  }, [user, draftEmail, draftUsername, updateUser, showToast, currentProject]);

  const onApplyBalance = useCallback(() => {
    if (!user || !currentProject) return;
    const aig = Number(adjAig);
    const usd = Number(adjUsd);
    if (!Number.isFinite(aig) || !Number.isFinite(usd)) return;
    if (aig === 0 && usd === 0) return;
    adjustBalance(currentProject, user.id, { aig, usd });
    setAdjAig('');
    setAdjUsd('');
  }, [user, adjAig, adjUsd, adjustBalance, currentProject]);

  const onChangeReferrer = useCallback(() => {
    if (!user || !currentProject) return;
    const next = newReferrerId.trim();
    if (!next) return;
    if (next === user.id) return;
    changeReferrer(currentProject, user.id, next);
    setNewReferrerId('');
  }, [user, newReferrerId, changeReferrer, currentProject]);

  const onRoleSelect = useCallback((e) => {
    const r = e.target.value;
    setDraftRole(r);
    const preset = ROLE_PRESETS[r];
    if (preset) setDraftPermissions({ ...preset });
  }, []);

  const onTogglePermission = useCallback((key) => {
    setDraftPermissions((p) => ({ ...p, [key]: !p[key] }));
  }, []);

  const onSaveAccess = useCallback(() => {
    if (!user || !currentProject) return;
    updateUser(currentProject, user.id, { role: draftRole, permissions: draftPermissions });
  }, [user, currentProject, updateUser, draftRole, draftPermissions]);

  const permLabels = useMemo(
    () => ({
      canViewNetwork: 'Ver sección Red / binario',
      canViewFullNetwork: 'Árbol completo y listado de referidos',
      canViewEarnings: 'Ver métricas de rendimiento / minería en panel',
      canEditProfile: 'Editar perfil en la app',
      canAccessP2P: 'Acceder a mercado P2P',
      canExecuteActions: 'Ejecutar compras, claims y activaciones',
    }),
    [],
  );

  const blocked = user?.status === 'blocked';

  const panelTitle = user?.username || user?.id || 'Usuario';
  const panelSubtitle = user ? `${user.email || 'Sin email'} · ${user.id}` : undefined;

  return (
    <>
      <AdminSidePanel
        open={open && Boolean(userId)}
        onClose={onClose}
        eyebrow="Centro de control"
        title={user ? panelTitle : 'Cargando…'}
        subtitle={user ? panelSubtitle : undefined}
        widthClassName="md:max-w-xl lg:max-w-[28rem] xl:max-w-[32rem]"
      >
        {!user && userId ? (
          <p className="text-sm text-slate-500">Usuario no encontrado en el proyecto actual.</p>
        ) : !user ? null : (
          <div className="space-y-6 pb-8">
            {busyGlobal ? (
              <div className="flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-100/90">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Ejecutando operación…
              </div>
            ) : null}

            <UserDetailCard user={user} />

            <Section title="Información (editable)">
              <EditableFields
                email={draftEmail}
                username={draftUsername}
                onEmailChange={setDraftEmail}
                onUsernameChange={setDraftUsername}
                onSave={onSaveProfile}
                disabled={busyGlobal}
                saving={isLoading(`user-${user.id}`)}
              />
            </Section>

            <Section title="Acceso y permisos">
              <p className="text-[11px] text-slate-500">
                Rol preestablece permisos; puedes ajustar casillas antes de guardar. Persiste en el registro de
                usuario (mock).
              </p>
              <label className="mt-2 block text-xs">
                <span className="text-slate-500">Rol</span>
                <select
                  value={draftRole}
                  onChange={onRoleSelect}
                  disabled={busyGlobal}
                  className={`${INPUT_SM} mt-1`}
                >
                  {USER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-3 space-y-2 rounded-xl border border-white/[0.06] bg-slate-950/40 p-3">
                {PERMISSION_KEYS.map((key) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-slate-900/30 px-2 py-2"
                  >
                    <span className="text-xs text-slate-300">{permLabels[key] ?? key}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(draftPermissions[key])}
                      onChange={() => onTogglePermission(key)}
                      disabled={busyGlobal}
                      className="h-4 w-4 rounded border-white/20"
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                disabled={busyGlobal || !currentProject}
                onClick={() =>
                  ask(
                    'Guardar acceso',
                    `¿Aplicar rol ${draftRole} y permisos seleccionados a ${user.username}?`,
                    onSaveAccess,
                  )
                }
                className="mt-3 w-full rounded-lg bg-cyan-600/85 py-2.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-40"
              >
                Guardar rol y permisos
              </button>
            </Section>

            <Section title="Balances">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/[0.06] bg-slate-950/50 p-3">
                  <p className="text-[10px] font-bold uppercase text-slate-500">AIG</p>
                  <p className="mt-1 font-mono text-lg text-white">
                    {(user.balances?.aig ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-slate-950/50 p-3">
                  <p className="text-[10px] font-bold uppercase text-slate-500">USD</p>
                  <p className="mt-1 font-mono text-lg text-white">
                    {(user.balances?.usd ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">Ajuste manual (delta). Se registra en historial.</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="flex-1 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Δ AIG</span>
                  <input
                    value={adjAig}
                    onChange={(e) => setAdjAig(e.target.value)}
                    className={INPUT_SM}
                    placeholder="± cantidad"
                    disabled={busyGlobal}
                    inputMode="decimal"
                  />
                </label>
                <label className="flex-1 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Δ USD</span>
                  <input
                    value={adjUsd}
                    onChange={(e) => setAdjUsd(e.target.value)}
                    className={INPUT_SM}
                    placeholder="± cantidad"
                    disabled={busyGlobal}
                    inputMode="decimal"
                  />
                </label>
                <button
                  type="button"
                  disabled={busyGlobal}
                  onClick={() =>
                    ask(
                      'Ajustar balance',
                      '¿Confirmar ajuste manual de balance? Esta acción quedará auditada (mock).',
                      onApplyBalance,
                    )
                  }
                  className="rounded-lg bg-emerald-600/90 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45 sm:shrink-0"
                >
                  Aplicar ajuste
                </button>
              </div>
            </Section>

            <Section title="Control de cuenta">
              <ActionButtons
                items={[
                  {
                    id: 'block',
                    label: blocked ? 'Desbloquear' : 'Bloquear',
                    variant: 'danger',
                    disabled: busyGlobal || !currentProject,
                    onClick: () =>
                      ask(
                        blocked ? 'Desbloquear' : 'Bloquear usuario',
                        blocked
                          ? '¿Desbloquear y restaurar acceso estándar?'
                          : '¿Bloquear usuario? El acceso quedará revocado.',
                        () => currentProject && blockUser(currentProject, user.id, !blocked),
                      ),
                  },
                  {
                    id: 'acct',
                    label: user.accountEnabled ? 'Desactivar cuenta' : 'Activar cuenta',
                    variant: 'amber',
                    disabled: busyGlobal || !currentProject,
                    onClick: () =>
                      ask(
                        user.accountEnabled ? 'Desactivar' : 'Activar',
                        user.accountEnabled
                          ? '¿Desactivar la cuenta por completo?'
                          : '¿Reactivar la cuenta?',
                        () => currentProject && toggleAccountActive(currentProject, user.id, !user.accountEnabled),
                      ),
                  },
                ]}
              />
            </Section>

            <Section title="Seguridad">
              <ActionButtons
                items={[
                  {
                    id: 'pwd',
                    label: 'Reset contraseña (mock)',
                    variant: 'ghost',
                    disabled: busyGlobal || !currentProject,
                    onClick: () =>
                      ask(
                        'Reset contraseña',
                        '¿Disparar flujo de restablecimiento? (simulación — sin email real).',
                        () => currentProject && resetPassword(currentProject, user.id),
                      ),
                  },
                ]}
              />
            </Section>

            <Section title="Comunicación">
              <input
                placeholder="Asunto email"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className={`${INPUT_SM} mb-2`}
                disabled={busyGlobal}
              />
              <textarea
                placeholder="Cuerpo email"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={2}
                className={`${INPUT_SM} mb-2`}
                disabled={busyGlobal}
              />
              <ActionButtons
                className="mb-4"
                items={[
                  {
                    id: 'mail',
                    label: isLoading('email') ? 'Enviando…' : 'Enviar email',
                    variant: 'cyan',
                    disabled: busyGlobal || !currentProject,
                    onClick: () => currentProject && sendEmail(currentProject, user.email, emailSubject, emailBody),
                  },
                ]}
              />
              <input
                placeholder="Título notificación interna"
                value={inTitle}
                onChange={(e) => setInTitle(e.target.value)}
                className={`${INPUT_SM} mb-2`}
                disabled={busyGlobal}
              />
              <textarea
                placeholder="Mensaje in-app"
                value={inBody}
                onChange={(e) => setInBody(e.target.value)}
                rows={2}
                className={`${INPUT_SM} mb-2`}
                disabled={busyGlobal}
              />
              <ActionButtons
                items={[
                  {
                    id: 'inapp',
                    label: isLoading('inapp') ? 'Enviando…' : 'Notificación interna',
                    variant: 'violet',
                    disabled: busyGlobal || !currentProject,
                    onClick: () =>
                      currentProject && sendInternalNotification(currentProject, user.id, inTitle, inBody),
                  },
                ]}
              />
            </Section>

            <Section title="Red — cambiar referidor">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="min-w-0 flex-1 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Nuevo sponsor / referidor ID
                  </span>
                  <input
                    value={newReferrerId}
                    onChange={(e) => setNewReferrerId(e.target.value)}
                    className={INPUT_SM}
                    placeholder="ej. U-1000"
                    disabled={busyGlobal}
                  />
                </label>
                <button
                  type="button"
                  disabled={busyGlobal || !newReferrerId.trim() || !currentProject}
                  onClick={() =>
                    ask(
                      'Cambiar referidor',
                      `¿Reasignar sponsor a ${newReferrerId.trim()}? Acción sensible (mock).`,
                      onChangeReferrer,
                    )
                  }
                  className="rounded-lg border border-white/10 bg-slate-900/90 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45 sm:shrink-0"
                >
                  Aplicar cambio
                </button>
              </div>
            </Section>

            <Section title="Historial">
              <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/[0.06] bg-slate-900/60 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Acción</th>
                      <th className="px-3 py-2">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {(user.history || []).length ? (
                      [...(user.history || [])]
                        .slice()
                        .reverse()
                        .map((h, i) => (
                          <tr key={`${h.ts}-${i}`} className="bg-slate-950/30 text-slate-300">
                            <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-slate-500">
                              {h.ts ?? '—'}
                            </td>
                            <td className="px-3 py-2 text-slate-200">{h.action ?? '—'}</td>
                            <td className="px-3 py-2 text-slate-400">{h.detail ?? '—'}</td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                          Sin movimientos registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="P2P">
              <ActionButtons
                className="mb-3"
                items={[
                  {
                    id: 'p2pblk',
                    label: user.p2pBlocked ? 'Desbloquear en P2P' : 'Bloquear en P2P',
                    variant: user.p2pBlocked ? 'primary' : 'danger',
                    disabled: busyGlobal || !currentProject,
                    onClick: () =>
                      ask(
                        user.p2pBlocked ? 'Desbloquear P2P' : 'Bloquear P2P',
                        user.p2pBlocked
                          ? '¿Permitir de nuevo operaciones P2P para este usuario?'
                          : '¿Impedir crear o tomar órdenes P2P?',
                        () => currentProject && blockUserP2P(currentProject, user.id, !user.p2pBlocked),
                      ),
                  },
                ]}
              />
              <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/[0.06] bg-slate-900/60 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Orden</th>
                      <th className="px-3 py-2">Lado</th>
                      <th className="px-3 py-2 text-right">Monto</th>
                      <th className="px-3 py-2 text-right">Px</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2 text-right"> </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {userOrders.length ? (
                      userOrders.map((o) => (
                        <tr key={o.id} className="bg-slate-950/30 text-slate-300">
                          <td className="px-3 py-2 font-mono text-[11px] text-cyan-200/80">{o.id}</td>
                          <td className="px-3 py-2 uppercase">{o.side}</td>
                          <td className="px-3 py-2 text-right font-mono">{o.amount}</td>
                          <td className="px-3 py-2 text-right font-mono">{o.price}</td>
                          <td className="px-3 py-2">
                            <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px]">{o.status}</span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {o.status === 'open' ? (
                              <button
                                type="button"
                                disabled={busyGlobal || !currentProject}
                                onClick={() =>
                                  ask(
                                    'Cancelar orden',
                                    `¿Cancelar ${o.id}?`,
                                    () => currentProject && cancelOrder(currentProject, o.id),
                                  )
                                }
                                className="text-[11px] font-semibold text-rose-300 hover:text-rose-200 disabled:opacity-40"
                              >
                                Cancelar
                              </button>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                          Sin órdenes P2P para este usuario.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>
        )}
      </AdminSidePanel>

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        danger
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

export const UserControlDrawer = memo(UserControlDrawerInner);
UserControlDrawer.displayName = 'UserControlDrawer';
