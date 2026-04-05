import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { LivingBackground } from '../backgrounds/LivingBackground.jsx';
import { MerchantDashboard } from '../components/merchant/MerchantDashboard.jsx';

export default function MerchantDashboardPage() {
  return (
    <div className="relative min-h-screen font-display text-slate-200">
      <LivingBackground />
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 md:px-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => window.location.assign('/marketplace/local')}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:border-cyan-500/30 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Local marketplace
          </button>
          <button
            type="button"
            onClick={() => window.location.assign('/marketplace')}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white"
          >
            Protocol marketplace
          </button>
        </div>
        <MerchantDashboard />
      </div>
    </div>
  );
}
