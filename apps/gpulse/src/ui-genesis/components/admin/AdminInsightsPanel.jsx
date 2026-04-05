import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, Sparkles } from 'lucide-react';
import { ACTION_PRIORITY_STYLES } from '../../styles/actionPriorityStyles.js';
import { buildAdminInsights } from '../../admin/buildAdminInsights.js';

/**
 * Admin “AI insights” surface: same priority chrome as `NextActionCard`, content from `buildAdminInsights`.
 *
 * @param {{ snapshot: ReturnType<typeof import('../../admin/useAdminCoreSnapshot.js').useAdminCoreSnapshot>, onNavigateNetwork?: () => void, onFocusLedger?: () => void }} props
 */
export function AdminInsightsPanel({ snapshot, onNavigateNetwork, onFocusLedger }) {
  const insights = useMemo(() => buildAdminInsights(snapshot), [snapshot]);
  const [active, setActive] = useState(0);
  const insight = insights[Math.min(active, insights.length - 1)] ?? insights[0];
  if (!insight) return null;

  const styles = ACTION_PRIORITY_STYLES[insight.priority] ?? ACTION_PRIORITY_STYLES.medium;

  const runCta = () => {
    if (insight.id === 'imbalance' || insight.id === 'inactive') onNavigateNetwork?.();
    else onFocusLedger?.();
  };

  return (
    <motion.section
      layout
      className={`relative w-full overflow-hidden rounded-2xl border p-5 md:p-6 ${styles.wrap}`}
    >
      <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-fuchsia-500/15 blur-2xl" />
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${styles.badge}`}>
            <Brain className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles.badge}`}>
              <Sparkles className="h-3 w-3" />
              Insights · prioridad {insight.priority}
            </span>
            <h3 className="mt-2 font-display text-base font-semibold text-white md:text-lg">{insight.title}</h3>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-slate-400">{insight.description}</p>

        <div className={`rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center ${styles.impact}`}>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Señal</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums md:text-3xl">{insight.metric}</p>
        </div>

        {insight.alert ? (
          <p className="rounded-lg border border-rose-500/30 bg-rose-950/25 px-3 py-2 text-xs text-rose-100/95">{insight.alert}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {insights.map((ins, i) => (
            <button
              key={ins.id}
              type="button"
              onClick={() => setActive(i)}
              className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                i === active ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100' : 'border-white/10 text-slate-400 hover:bg-white/5'
              }`}
            >
              {i + 1}. {ins.id.slice(0, 4)}
            </button>
          ))}
        </div>

        <motion.button
          type="button"
          onClick={runCta}
          className={`w-full rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-wide ${styles.cta}`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {insight.cta}
        </motion.button>
      </div>
    </motion.section>
  );
}
