import { useNavigate } from 'react-router-dom';
import { GlassCard, GlowContainer, NeonButton } from '@ai-genesis/ui';

export function LegacyGenesisFallback({ message }: { message: string }) {
  const navigate = useNavigate();
  return (
    <GlowContainer className="rounded-2xl" accent="purple">
      <GlassCard className="max-w-lg border-amber-500/20">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-200/80">Legacy access required</p>
        <h2 className="mt-2 text-lg font-bold text-white">Use emergency Genesis UI</h2>
        <p className="mt-2 text-sm text-white/55">{message}</p>
        <p className="mt-2 text-xs text-white/35">
          The iframe app is fallback-only — open it only when native Backoffice cannot reach core services.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <NeonButton type="button" onClick={() => navigate('/genesis')}>
            Open legacy Genesis
          </NeonButton>
        </div>
      </GlassCard>
    </GlowContainer>
  );
}
