import { motion, AnimatePresence } from 'framer-motion';
import { tokens } from './tokens.js';

export interface SignalEntry {
  id: string;
  at: number;
  message: string;
  detail?: string;
}

export interface SignalListProps {
  entries: SignalEntry[];
  maxVisible?: number;
  emptyLabel?: string;
}

export function SignalList({ entries, maxVisible = 10, emptyLabel = 'Awaiting signals…' }: SignalListProps) {
  const { colors } = tokens;
  const slice = entries.slice(0, maxVisible);

  return (
    <ul className="max-h-[220px] space-y-2 overflow-y-auto pr-1 font-mono text-[10px]">
      {slice.length === 0 ? (
        <li className="rounded-lg border border-dashed border-white/[0.08] px-3 py-6 text-center text-white/35">{emptyLabel}</li>
      ) : (
        <AnimatePresence initial={false}>
          {slice.map((e) => (
            <motion.li
              key={e.id}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2"
              style={{ boxShadow: `inset 0 0 0 1px ${colors.cyan}08` }}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-white/80">{e.message}</span>
                <time className="shrink-0 text-[9px] text-white/35">
                  {new Date(e.at).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </time>
              </div>
              {e.detail ? <p className="mt-1 text-[9px] leading-snug text-white/40">{e.detail}</p> : null}
            </motion.li>
          ))}
        </AnimatePresence>
      )}
    </ul>
  );
}
