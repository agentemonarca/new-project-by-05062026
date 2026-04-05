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

export function RegisterPage({ onRegister, LinkComponent: Link = TextLink }) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  return (
    <div className="relative min-h-screen font-display text-slate-200">
      <LivingBackground />
      <div className="flex min-h-screen items-center justify-center p-4 py-12">
        <AuthCard className="max-w-lg">
          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-4">
            <motion.div variants={fadeUpBlur} className="text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-white">Join AiGenesis</h1>
              <p className="mt-1 text-sm text-slate-500">Initialize your G-Pulse identity</p>
            </motion.div>
            <motion.div variants={fadeUpBlur}>
              <NeonInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </motion.div>
            <motion.div variants={fadeUpBlur}>
              <NeonInput label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </motion.div>
            <motion.div variants={fadeUpBlur}>
              <NeonInput
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </motion.div>
            <motion.div variants={fadeUpBlur}>
              <NeonInput
                label="Confirm password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </motion.div>
            <motion.div variants={fadeUpBlur}>
              <WalletConnectButton />
            </motion.div>
            <motion.div variants={fadeUpBlur}>
              <GradientButton
                className="w-full"
                onClick={() => onRegister?.({ email, username, password, confirm })}
              >
                Create account
              </GradientButton>
            </motion.div>
            <motion.p variants={fadeUpBlur} className="text-center text-xs text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="text-cyan-400/90 hover:text-cyan-300">
                Sign in
              </Link>
            </motion.p>
          </motion.div>
        </AuthCard>
      </div>
    </div>
  );
}
