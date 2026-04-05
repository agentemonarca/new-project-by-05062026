import React, { useState } from 'react';
import { useWallet } from '../../context/WalletContext.jsx';
import { useGenesisDashboardStore } from '../stores/genesisDashboardStore.js';
import { GradientButton } from './GradientButton.jsx';
import { GlowBadge } from './GlowBadge.jsx';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Wallet + SIWE session bar for genesis UI (requires COMPENSATION_ENABLED backend).
 */
export function GenesisAuthBar() {
  const { address, signer, connectWallet, isConnecting, isWrongNetwork, switchNetwork } = useWallet();
  const authToken = useGenesisDashboardStore((s) => s.authToken);
  const sessionAuth = useGenesisDashboardStore((s) => s.sessionAuth);
  const signIn = useGenesisDashboardStore((s) => s.signIn);
  const signOut = useGenesisDashboardStore((s) => s.signOut);
  const loading = useGenesisDashboardStore((s) => s.loading);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;

  const onSignIn = async () => {
    setErr(null);
    if (!address || !signer) {
      await connectWallet();
      return;
    }
    if (isWrongNetwork) {
      await switchNetwork();
      return;
    }
    setBusy(true);
    try {
      await signIn(signer, address);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 backdrop-blur-md">
      {short ? <GlowBadge tone="cyan">{short}</GlowBadge> : null}
      {authToken || sessionAuth ? (
        <GlowBadge tone="violet" pulse={loading}>
          API session active
        </GlowBadge>
      ) : (
        <span className="text-xs text-amber-200/80">Sign API session to load compensation data</span>
      )}
      <div className="ml-auto flex flex-wrap gap-2">
        {!address ? (
          <GradientButton type="button" className="!py-2 !text-xs" disabled={isConnecting} onClick={() => connectWallet()}>
            {isConnecting ? 'Connecting…' : 'Connect wallet'}
          </GradientButton>
        ) : isWrongNetwork ? (
          <GradientButton type="button" className="!py-2 !text-xs" onClick={() => switchNetwork()}>
            Switch network
          </GradientButton>
        ) : !(authToken || sessionAuth) ? (
          <GradientButton type="button" className="!py-2 !text-xs" disabled={busy} onClick={onSignIn}>
            {busy ? 'Signing…' : 'Sign in (SIWE)'}
          </GradientButton>
        ) : (
          <GradientButton type="button" variant="ghost" className="!py-2 !text-xs" onClick={() => void signOut()}>
            Sign out API
          </GradientButton>
        )}
      </div>
      <AnimatePresence>
        {err ? (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="basis-full text-xs text-rose-300"
          >
            {err}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
