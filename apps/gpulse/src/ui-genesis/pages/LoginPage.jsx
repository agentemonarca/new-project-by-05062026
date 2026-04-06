import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LivingBackground } from '../backgrounds/LivingBackground.jsx';
import { AuthCard } from '../components/AuthCard.jsx';
import { NeonInput } from '../components/NeonInput.jsx';
import { GradientButton } from '../components/GradientButton.jsx';
import { WalletConnectButton } from '../components/WalletConnectButton.jsx';
import { staggerContainer, fadeUpBlur } from '../motion/variants.js';
import { BRAND } from '@/branding/brand.js';
import { BrandLogo } from '@/branding/BrandLogo.jsx';

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
              <div className="mb-4 flex justify-center">
                <BrandLogo size="lg" className="animate-breathe shadow-[0_0_32px_-10px_rgba(34,211,238,0.45)]" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Welcome back</h1>
              <p className="mt-1 text-sm text-slate-500">
                {BRAND.name} · {BRAND.productLine}
              </p>
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
