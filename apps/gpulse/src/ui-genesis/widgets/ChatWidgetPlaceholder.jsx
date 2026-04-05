import React from 'react';
import { MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { GlassCard } from '../components/GlassCard.jsx';

export function ChatWidgetPlaceholder() {
  return (
    <motion.div
      className="fixed bottom-6 right-6 z-50 md:bottom-8 md:right-8"
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
    >
      <GlassCard className="cursor-pointer p-4 shadow-glowMagenta" hover contentClassName="flex items-center gap-3 p-0">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/40 to-cyan-500/30">
          <MessageCircle className="h-5 w-5 text-white" strokeWidth={1.5} />
        </div>
        <div>
          <p className="font-display text-sm font-medium text-white">Consciousness</p>
          <p className="text-[10px] text-slate-500">Tap to open channel</p>
        </div>
      </GlassCard>
    </motion.div>
  );
}
