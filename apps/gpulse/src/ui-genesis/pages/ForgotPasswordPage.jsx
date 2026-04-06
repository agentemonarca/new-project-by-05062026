import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LivingBackground } from '../backgrounds/LivingBackground.jsx';
import { AuthCard } from '../components/AuthCard.jsx';
import { NeonInput } from '../components/NeonInput.jsx';
import { GradientButton } from '../components/GradientButton.jsx';
import { staggerContainer, fadeUpBlur } from '../motion/variants.js';
import { BrandLogo } from '@/branding/BrandLogo.jsx';

function TextLink({ to, children, className = '' }) {
  return (
    <a href={to} className={className}>
      {children}
    </a>
  );
}

export function ForgotPasswordPage({ onSendRecovery, LinkComponent: Link = TextLink }) {
  const [email, setEmail] = useState('');

  return (
    <div className="relative min-h-screen font-display text-slate-200">
      <LivingBackground />
      <div className="flex min-h-screen items-center justify-center p-4">
        <AuthCard>
          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-5">
            <motion.div variants={fadeUpBlur} className="text-center">
              <div className="mb-4 flex justify-center">
                <BrandLogo size="md" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Recover access</h1>
              <p className="mt-1 text-sm text-slate-500">We&apos;ll send recovery instructions to your email.</p>
            </motion.div>
            <motion.div variants={fadeUpBlur}>
              <NeonInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </motion.div>
            <motion.div variants={fadeUpBlur}>
              <GradientButton className="w-full" onClick={() => onSendRecovery?.({ email })}>
                Send recovery
              </GradientButton>
            </motion.div>
            <motion.p variants={fadeUpBlur} className="text-center text-xs text-slate-500">
              <Link to="/login" className="text-cyan-400/90 hover:text-cyan-300">
                Back to login
              </Link>
            </motion.p>
          </motion.div>
        </AuthCard>
      </div>
    </div>
  );
}
