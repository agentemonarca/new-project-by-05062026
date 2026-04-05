import { useNavigate } from 'react-router-dom';
import { GlassCard, GlowContainer, NeonButton } from '@ai-genesis/ui';

export default function PlaceholderPage({ title }: { title: string }) {
  const navigate = useNavigate();
  const historyTodo = title === 'History';

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-8">
      <GlowContainer className="rounded-2xl">
        <GlassCard className="max-w-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-white/45">{title}</p>
          <h2 className="mt-3 text-xl font-black tracking-tight text-white/90">Module in preparation</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/50">
            Native Backoffice route — no legacy iframe. Activity is available on the dashboard and wallet pages until this
            module ships.
          </p>
          {historyTodo ? (
            <p className="mt-3 rounded-lg border border-dashed border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 font-mono text-[10px] text-amber-200/80">
              TODO: dedicated transaction history view (extend ActivityItem feeds + filters).
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <NeonButton variant="ghost" type="button" onClick={() => navigate('/')}>
              Dashboard
            </NeonButton>
            <NeonButton variant="ghost" type="button" onClick={() => navigate('/wallet')}>
              Wallet
            </NeonButton>
          </div>
        </GlassCard>
      </GlowContainer>
    </div>
  );
}
