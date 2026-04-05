import React from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '../components/GlassCard.jsx';
import { staggerContainer, fadeUpBlur } from '../motion/variants.js';

const DEMO = [
  { id: 1, text: 'Direct bonus rewards credited', meta: '+12.4 USDT', tone: 'cyan' },
  { id: 2, text: 'Binary volume updated', meta: 'L 840 · R 792', tone: 'violet' },
  { id: 3, text: 'Mining reward tick', meta: '+0.18 AIG', tone: 'magenta' },
  { id: 4, text: 'Wallet sync', meta: '0x4a…91', tone: 'neutral' },
];

export function ActivityFeed({ items }) {
  const rows = items === undefined ? DEMO : items;
  return (
    <GlassCard className="p-5" contentClassName="p-0">
      <h3 className="font-display text-sm font-semibold text-white">Activity</h3>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No ledger movements yet.</p>
      ) : null}
      <motion.ul
        className="mt-4 space-y-3"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {rows.map((row) => (
          <motion.li
            key={row.id}
            variants={fadeUpBlur}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5"
          >
            <span className="text-sm text-slate-300">{row.text}</span>
            <span
              className={`font-mono text-xs ${
                row.tone === 'cyan'
                  ? 'text-cyan-300'
                  : row.tone === 'violet'
                    ? 'text-violet-300'
                    : row.tone === 'magenta'
                      ? 'text-fuchsia-300'
                      : 'text-slate-500'
              }`}
            >
              {row.meta}
            </span>
          </motion.li>
        ))}
      </motion.ul>
    </GlassCard>
  );
}
