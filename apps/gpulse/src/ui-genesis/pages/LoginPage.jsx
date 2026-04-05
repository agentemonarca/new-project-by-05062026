import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LivingBackground } from '../backgrounds/LivingBackground.jsx';
import { AuthCard } from '../components/AuthCard.jsx';
import { NeonInput } from '../components/NeonInput.jsx';
import { GradientButton } from '../components/GradientButton.jsx';
import { WalletConnectButton } from '../components/WalletConnectButton.jsx';
import { staggerContainer, fadeUpBlur } from '../motion/variants.js';

function TextLink({ to, children, className = '' }) {
  return (
    <a href={to} className={className}>
      {children}
    </a>
  );
}

export function LoginPage({ onLogin, LinkComponent: Link = TextLink, showLinks = true }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="relative min-h-screen font-display text-slate-200">
      <LivingBackground />
      <div className="flex min-h-screen items-center justify-center p-4">
        <AuthCard>
          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-5">
            <motion.div variants={fadeUpBlur} className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/40 via-fuchsia-500/35 to-violet-600/40 text-lg font-bold text-white shadow-glowCyan animate-breathe">
                AG
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Welcome back</h1>
              <p className="mt-1 text-sm text-slate-500">AiGenesis · G-Pulse</p>
            </motion.div>
            <motion.div variants={fadeUpBlur}>
              <NeonInput
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </motion.div>
            <motion.div variants={fadeUpBlur}>
              <NeonInput
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </motion.div>
            <motion.div variants={fadeUpBlur}>
              <WalletConnectButton />
            </motion.div>
            <motion.div variants={fadeUpBlur}>
              <GradientButton className="w-full" onClick={() => onLogin?.({ email, password })}>
                Sign in
              </GradientButton>
            </motion.div>
            {showLinks ? (
              <motion.div variants={fadeUpBlur} className="flex justify-between text-xs text-slate-500">
                <Link to="/register" className="text-cyan-400/90 hover:text-cyan-300">
                  Create account
                </Link>
                <Link to="/forgot-password" className="hover:text-slate-300">
                  Forgot password?
                </Link>
              </motion.div>
            ) : null}
          </motion.div>
        </AuthCard>
      </div>
    </div>
  );
}
