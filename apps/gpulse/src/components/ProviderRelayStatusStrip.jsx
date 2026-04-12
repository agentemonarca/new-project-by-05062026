import React from 'react';
import { useProviderRelayUi } from '../hooks/useProviderRelayUi.js';
import { isWeb3MockMode } from '../utils/web3Mode.js';
import {
  isExternalSignalsBffEnabled,
  isExternalSignalsEnabled,
  isExternalSignalsTransportActive,
} from '../ui-genesis/lib/externalSignalsConfig.js';
import { formatPredictionSideLabel, predictionSideFromRawSignal } from '../utils/providerMartingaleRead.js';

function signalRelayStackHint() {
  if (!isExternalSignalsTransportActive()) return 'Relay señales: off';
  if (isExternalSignalsBffEnabled()) return 'Relay señales: BFF (mismo origen → core-api /socket.io)';
  if (isExternalSignalsEnabled()) return 'Relay señales: socket directo al proveedor';
  return 'Relay señales: activo';
}

/**
 * @param {{ variant?: 'oracle' | 'bar' }} props
 * - oracle: compacto bajo un título (p. ej. módulos embebidos)
 * - bar: franja completa bajo topbar (shell principal /gpulse y dashboard)
 */
export function ProviderRelayStatusStrip({ variant = 'oracle' }) {
  const extSigUi = useProviderRelayUi();
  const cs = extSigUi.connectionStatus;
  /** `idle` es el default del store antes del primer `setMeta` del socket — no mostrar "idle" crudo. */
  const linkPending = cs === 'idle' || cs === 'connecting' || cs === 'reconnecting';
  const linkUp = cs === 'connected';
  const linkDisabled = cs === 'disabled';
  const linkError = cs === 'error';
  /** Mientras haya última señal en store, mostrar detalle aunque esté reconectando. */
  const showSignalDetail = !linkDisabled && (linkUp || extSigUi.latest);

  const statusRow = (
    <p
      className={
        variant === 'bar'
          ? 'flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] leading-snug text-slate-300'
          : 'armani-label-dynamic flex flex-wrap items-center gap-x-1.5 font-mono text-[8px] leading-snug text-slate-400'
      }
    >
      {linkUp ? (
        <>
          <span className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" aria-hidden />
          <span className="text-emerald-300">Proveedor conectado</span>
        </>
      ) : linkPending ? (
        <span className="text-amber-400/95">Conectando con el proveedor…</span>
      ) : linkDisabled ? (
        <span className="text-slate-500">Señales externas desactivadas</span>
      ) : linkError ? (
        <span className="text-rose-400/95">Error de enlace con el proveedor</span>
      ) : (
        <span className="text-amber-400/95">Proveedor: {cs}</span>
      )}
      {extSigUi.n > 0 ? <span className="text-slate-500">· {extSigUi.n} en buffer</span> : null}
      {extSigUi.lastError ? (
        <span className="text-amber-500/90">· {String(extSigUi.lastError).slice(0, 56)}</span>
      ) : null}
      <span className="text-slate-600">·</span>
      <span className={isWeb3MockMode() ? 'text-amber-400/90' : 'text-emerald-400/85'}>
        {isWeb3MockMode() ? 'Web3: emulador' : 'Web3: cadena real'}
      </span>
      <span className="text-slate-600">·</span>
      <span className="text-slate-500" title="Independiente del modo Web3; usa Vite proxy + core-api en dev.">
        {signalRelayStackHint()}
      </span>
    </p>
  );

  const signalRow = showSignalDetail ? (
      <p
        className={
          variant === 'bar'
            ? 'mt-0.5 font-mono text-[9px] leading-tight text-slate-400 truncate max-w-[min(100%,42rem)]'
            : 'armani-label-dynamic mt-0.5 font-mono text-[6.5px] leading-tight text-slate-500 truncate max-w-[min(100%,26rem)]'
        }
        title={
          extSigUi.signalAlgorithmName ||
          (extSigUi.latest
            ? `${extSigUi.latest.mesa || '—'} · ${extSigUi.latest.round ?? '—'} · ${formatPredictionSideLabel(
                extSigUi.latest.rawSignal && typeof extSigUi.latest.rawSignal === 'object'
                  ? predictionSideFromRawSignal(extSigUi.latest.rawSignal)
                  : null,
              )}`
            : '')
        }
      >
        {extSigUi.signalAlgorithmName ? (
          <>
            Señal: <span className="text-cyan-400/95">{extSigUi.signalAlgorithmName}</span>
          </>
        ) : extSigUi.latest ? (
          <>
            Última: {String(extSigUi.latest.mesa || '—')} · #{String(extSigUi.latest.round ?? '—')} ·{' '}
            <span className="text-cyan-400/90">
              {formatPredictionSideLabel(
                extSigUi.latest.rawSignal && typeof extSigUi.latest.rawSignal === 'object'
                  ? predictionSideFromRawSignal(extSigUi.latest.rawSignal)
                  : null,
              )}
            </span>
          </>
        ) : (
          <span className="text-slate-500">Esperando primera señal del proveedor…</span>
        )}
      </p>
    ) : null;

  if (variant === 'bar') {
    return (
      <div
        className="border-b border-emerald-500/15 bg-gradient-to-r from-slate-950/80 via-slate-900/60 to-slate-950/80 px-4 py-2 md:px-8"
        data-testid="provider-relay-status-bar"
      >
        <div className="mx-auto max-w-7xl space-y-0.5">
          {statusRow}
          {signalRow}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1 max-w-[min(100%,26rem)] space-y-0.5" data-testid="provider-relay-status-oracle">
      {statusRow}
      {signalRow}
    </div>
  );
}
