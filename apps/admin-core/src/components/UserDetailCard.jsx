import React, { memo, useMemo } from 'react';

function shortenWallet(w) {
  const s = String(w || '');
  if (s.length < 14) return s || '—';
  return `${s.slice(0, 8)}…${s.slice(-6)}`;
}

/**
 * @param {{ user: object | null }} props
 */
function UserDetailCardInner({ user }) {
  const badges = useMemo(() => {
    if (!user) return [];
    const out = [];
    if (user.status) out.push({ key: 'status', label: user.status, tone: 'slate' });
    if (user.role) out.push({ key: 'role', label: String(user.role).replace(/_/g, ' '), tone: 'cyan' });
    if (user.accountEnabled === false) out.push({ key: 'acct', label: 'cuenta off', tone: 'amber' });
    if (user.p2pBlocked) out.push({ key: 'p2p', label: 'P2P bloq.', tone: 'rose' });
    if (user.fundsFrozen) out.push({ key: 'frz', label: 'fondos congel.', tone: 'violet' });
    return out;
  }, [user]);

  if (!user) return null;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-gradient-to-br from-slate-950/80 to-slate-900/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-medium text-cyan-200/90">{user.id}</span>
        {badges.map((b) => (
          <span
            key={b.key}
            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              b.tone === 'amber'
                ? 'bg-amber-500/15 text-amber-200/90'
                : b.tone === 'rose'
                  ? 'bg-rose-500/15 text-rose-200/90'
                  : b.tone === 'violet'
                    ? 'bg-violet-500/15 text-violet-200/90'
                    : 'bg-white/10 text-slate-300'
            }`}
          >
            {b.label}
          </span>
        ))}
      </div>
      <dl className="mt-3 grid gap-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Wallet</dt>
          <dd className="max-w-[70%] truncate font-mono text-xs text-slate-300" title={user.wallet || ''}>
            {shortenWallet(user.wallet)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Referidor actual</dt>
          <dd className="font-mono text-xs text-cyan-200/80">{user.referrerId || '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Red</dt>
          <dd className="text-right text-xs text-slate-300">
            Pierna <span className="font-mono text-white">{user.network?.leg ?? '—'}</span>
            <span className="text-slate-500"> · </span>
            L <span className="font-mono">{user.network?.volumeLeft ?? 0}</span>
            <span className="text-slate-500"> / </span>R <span className="font-mono">{user.network?.volumeRight ?? 0}</span>
          </dd>
        </div>
      </dl>
    </div>
  );
}

export const UserDetailCard = memo(UserDetailCardInner);
UserDetailCard.displayName = 'UserDetailCard';
