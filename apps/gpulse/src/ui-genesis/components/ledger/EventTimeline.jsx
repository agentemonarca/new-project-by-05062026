import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { EventCard } from './EventCard.jsx';
import { staggerContainer, fadeUpBlur } from '../../motion/variants.js';
import { groupLedgerEventsByCategory, groupLedgerEventsByDay } from '../../ledger/groupEvents.js';

/**
 * @param {{
 *   events: import('../../ledger/ledgerModel.js').LedgerEvent[],
 *   groupBy?: 'none' | 'day' | 'category',
 * }} props
 */
function EventTimelineInner({ events, groupBy = 'none' }) {
  const grouped = useMemo(() => {
    if (groupBy === 'day') return { mode: 'day', groups: groupLedgerEventsByDay(events) };
    if (groupBy === 'category') return { mode: 'category', groups: groupLedgerEventsByCategory(events) };
    return { mode: 'none', groups: null };
  }, [events, groupBy]);

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 bg-slate-950/30 px-6 py-10 text-center text-sm text-slate-500">
        No events match the current filters.
      </div>
    );
  }

  if (grouped.mode === 'none') {
    return (
      <div className="relative pl-4 md:pl-6">
        <div
          className="absolute bottom-2 left-[7px] top-2 w-px bg-gradient-to-b from-cyan-500/40 via-violet-500/30 to-transparent md:left-[11px]"
          aria-hidden
        />
        <motion.ul className="space-y-4" variants={staggerContainer} initial="hidden" animate="show">
          {events.map((ev) => (
            <motion.li key={ev.id} variants={fadeUpBlur} className="relative">
              <span
                className="absolute -left-[9px] top-4 z-[1] h-2 w-2 rounded-full border border-cyan-400/50 bg-slate-950 shadow-[0_0_10px_rgba(34,211,238,0.5)] md:-left-[13px]"
                aria-hidden
              />
              <EventCard event={ev} />
            </motion.li>
          ))}
        </motion.ul>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {grouped.mode === 'day'
        ? grouped.groups.map((g) => (
            <section key={g.dayKey}>
              <h4 className="mb-3 border-b border-white/10 pb-2 font-display text-xs font-semibold uppercase tracking-wider text-slate-400">
                {g.label}
                <span className="ml-2 font-mono text-[10px] font-normal text-slate-600">({g.events.length})</span>
              </h4>
              <div className="relative pl-4 md:pl-6">
                <div
                  className="absolute bottom-2 left-[7px] top-2 w-px bg-gradient-to-b from-cyan-500/30 via-violet-500/20 to-transparent md:left-[11px]"
                  aria-hidden
                />
                <ul className="space-y-4">
                  {g.events.map((ev) => (
                    <li key={ev.id} className="relative">
                      <span
                        className="absolute -left-[9px] top-4 z-[1] h-2 w-2 rounded-full border border-cyan-400/40 bg-slate-950 md:-left-[13px]"
                        aria-hidden
                      />
                      <EventCard event={ev} />
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))
        : grouped.groups.map((g) => (
            <section key={g.category}>
              <h4 className="mb-3 border-b border-white/10 pb-2 font-display text-xs font-semibold uppercase tracking-wider text-violet-200/90">
                {g.category}
                <span className="ml-2 font-mono text-[10px] font-normal text-slate-600">({g.events.length})</span>
              </h4>
              <div className="relative pl-4 md:pl-6">
                <div
                  className="absolute bottom-2 left-[7px] top-2 w-px bg-gradient-to-b from-violet-500/30 to-transparent md:left-[11px]"
                  aria-hidden
                />
                <ul className="space-y-4">
                  {g.events.map((ev) => (
                    <li key={ev.id} className="relative">
                      <span
                        className="absolute -left-[9px] top-4 z-[1] h-2 w-2 rounded-full border border-violet-400/50 bg-slate-950 md:-left-[13px]"
                        aria-hidden
                      />
                      <EventCard event={ev} />
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
    </div>
  );
}

export const EventTimeline = memo(EventTimelineInner);
