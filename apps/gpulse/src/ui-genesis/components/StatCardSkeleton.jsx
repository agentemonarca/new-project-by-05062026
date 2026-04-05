import React from 'react';
import { GlassCard } from './GlassCard.jsx';

export function StatCardSkeleton({ className = '' }) {
  return (
    <GlassCard className={`animate-pulse p-5 ${className}`} hover={false} contentClassName="p-0">
      <div className="h-3 w-24 rounded bg-white/10" />
      <div className="mt-4 h-8 w-28 rounded bg-white/15" />
      <div className="mt-2 h-3 w-20 rounded bg-white/10" />
    </GlassCard>
  );
}
