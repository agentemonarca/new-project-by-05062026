import { useNavigate } from 'react-router-dom';
import { GlassCard, GlowContainer, NeonButton } from '@ai-genesis/ui';
import { STORAGE_KEYS } from '@ai-genesis/config';
import { useExternalContext } from '@ai-genesis/bridge';
import { useGenesisStore } from '@ai-genesis/state';
import SystemPanel from '@/components/system/SystemPanel';
import ControlPanel from '@/components/system/ControlPanel';

function gpulseStatusLabel(connected: boolean, status: string): 'Connected' | 'Syncing' | 'Offline' {
  if (status === 'syncing') return 'Syncing';
  if (connected) return 'Connected';
  return 'Offline';
}

/** G-Pulse + system panels (previous home hub). */
export default function ControlPlanePage() {
  const ctx = useExternalContext();
  const navigate = useNavigate();
  const applyAuthSync = useGenesisStore((s) => s.applyAuthSync);
  const gpulse = useGenesisStore((s) => s.gpulse);

  const engineStatus = gpulseStatusLabel(gpulse.connected, gpulse.status);
  const lastSyncLabel =
    gpulse.lastSync > 0
      ? new Date(gpulse.lastSync).toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : '—';

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-8">
      <GlowContainer className="rounded-2xl" accent="cyan">
        <GlassCard glow className="max-w-2xl border-cyan-400/15">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-200/60">G-Pulse Engine</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-white">Real-time execution plane</h2>
          <div className="mt-4 flex flex-wrap items-center gap-4 font-mono text-[11px]">
            <span className="text-white/35">status</span>
            <span
              className={
                engineStatus === 'Connected'
                  ? 'font-bold text-emerald-400'
                  : engineStatus === 'Syncing'
                    ? 'font-bold text-amber-300'
                    : 'font-bold text-red-400/90'
              }
            >
              {engineStatus}
            </span>
            <span className="text-white/25">·</span>
            <span className="text-white/35">last handshake</span>
            <span className="text-white/70">{lastSyncLabel}</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/50">
            Open the module to establish a live PING/PONG link. The top bar mirrors connection health across the
            shell.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <NeonButton type="button" onClick={() => navigate('/g-pulse')}>
              Enter system
            </NeonButton>
            <NeonButton variant="ghost" type="button" onClick={() => navigate('/wallet')}>
              Wallet
            </NeonButton>
            <NeonButton variant="ghost" type="button" onClick={() => navigate('/network')}>
              Network
            </NeonButton>
            <NeonButton variant="ghost" type="button" onClick={() => navigate('/')}>
              Dashboard
            </NeonButton>
          </div>
          <p className="mt-4 text-[10px] text-white/35">
            <button
              type="button"
              className="font-mono uppercase tracking-widest text-amber-200/50 underline decoration-white/15 decoration-1 underline-offset-2 transition-colors hover:text-amber-200/80"
              onClick={() => navigate('/genesis')}
            >
              Legacy Genesis (emergency only)
            </button>
          </p>
        </GlassCard>
      </GlowContainer>

      <GlowContainer className="rounded-2xl" accent="purple">
        <GlassCard className="max-w-2xl">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-white/50">Backoffice 2.0</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-white">Modular control plane</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            Primary flows run in Backoffice (dashboard, wallet, network). G-Pulse uses a dedicated module; legacy Genesis
            iframe is available only as a manual fallback from the sidebar or error states.
          </p>
          <div className="mt-6 grid gap-2 font-mono text-[11px] text-white/45">
            <p>
              <span className="text-white/30">auth</span>{' '}
              {ctx.isAuthenticated ? '● session active' : '○ waiting for token'}
            </p>
            <p>
              <span className="text-white/30">mode</span> {String(ctx.systemMode)}
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <NeonButton
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem(STORAGE_KEYS.TOKEN, 'dev-placeholder-token');
                  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ id: 'dev', role: 'operator' }));
                } catch {
                  /* ignore */
                }
                applyAuthSync({
                  token: 'dev-placeholder-token',
                  user: { id: 'dev', role: 'operator' },
                });
              }}
            >
              Simulate auth
            </NeonButton>
          </div>
        </GlassCard>
      </GlowContainer>

      <SystemPanel />

      <ControlPanel />
    </div>
  );
}
