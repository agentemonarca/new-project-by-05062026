import React, { useEffect, useState } from 'react';
import { parseProviderTiempoActual } from '../../utils/vistaLabProviderExtras.js';

/**
 * Segundos transcurridos desde `tiempo_actual` del proveedor; se reinicia cuando cambia la clave.
 * @param {string | null | undefined} tiempoActualIso
 * @param {string | null | undefined} resetKey
 */
export function useVistaLabLiveElapsedSec(tiempoActualIso, resetKey) {
  const anchor = parseProviderTiempoActual(tiempoActualIso);
  const [sec, setSec] = useState(0);

  useEffect(() => {
    if (anchor == null) {
      setSec(0);
      return;
    }
    const tick = () => setSec(Math.max(0, Math.floor((Date.now() - anchor) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [anchor, resetKey]);

  return anchor == null ? null : sec;
}

/**
 * @param {{
 *   vectorResultado: string[],
 *   vectorWin: string[],
 * }} props
 */
export function VistaLabTrajectoryStrip({ vectorResultado, vectorWin }) {
  const vr = Array.isArray(vectorResultado) ? vectorResultado : [];
  const vw = Array.isArray(vectorWin) ? vectorWin : [];
  const n = Math.max(vr.length, vw.length);
  if (n === 0) {
    return <span className="text-[11px] text-[#5E6673]">Sin trayecto (vector_resultado / vector_win)</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="vistalab-trajectory">
      {vr.map((sideRaw, i) => {
        const side = String(sideRaw ?? '').trim().toUpperCase();
        const w = String(vw[i] ?? '').trim().toUpperCase();
        const win = w === 'W' || w === 'WIN';
        const loss = w === 'L' || w === 'LOSS';
        const tie = w === 'T' || w === 'TIE' || side === 'E';
        const label = side.length <= 2 ? side : side.slice(0, 1);
        return (
          <span
            key={`tr-${i}-${label}`}
            className="inline-flex min-w-[1.75rem] items-center justify-center rounded-md border px-1.5 py-0.5 text-[11px] font-bold tabular-nums"
            style={{
              borderColor: tie
                ? 'rgba(252,213,53,0.45)'
                : win
                  ? 'rgba(14,203,129,0.55)'
                  : loss
                    ? 'rgba(246,70,93,0.55)'
                    : 'rgba(71,77,87,0.55)',
              backgroundColor: tie
                ? 'rgba(252,213,53,0.08)'
                : win
                  ? 'rgba(14,203,129,0.12)'
                  : loss
                    ? 'rgba(246,70,93,0.12)'
                    : 'rgba(11,14,17,0.5)',
              color: tie ? '#FCD535' : win ? '#0ECB81' : loss ? '#F6465D' : '#EAECEF',
            }}
            title={`Tiro ${i + 1}: resultado ${label} · ${win ? 'win' : loss ? 'lose' : w || '—'}`}
          >
            {label}
            {w ? <span className="ml-0.5 text-[9px] opacity-90">{win ? '✓' : loss ? '✗' : ''}</span> : null}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Barra superior: martingala (proveedor), tiempo en vivo, estado activa, contador tiro.
 *
 * @param {{
 *   extras: Record<string, unknown> | null | undefined,
 *   resetKey?: string | null,
 *   className?: string,
 * }} props
 */
export default function VistaLabProviderBar({ extras, resetKey, className = '' }) {
  const x = extras && typeof extras === 'object' ? extras : null;
  const tiempoIso = x?.tiempoActualIso != null ? String(x.tiempoActualIso) : null;
  const liveSec = useVistaLabLiveElapsedSec(tiempoIso, resetKey ?? tiempoIso ?? '');

  const mgLabel = x?.martingaleStepLabel != null ? String(x.martingaleStepLabel) : '—';
  const active = x?.martingaleActive === true;
  const shotCur = x?.shotCurrent != null ? Number(x.shotCurrent) : 0;
  const shotTot = x?.shotTotal != null ? Number(x.shotTotal) : 6;
  const vr = Array.isArray(x?.vectorResultado) ? x.vectorResultado : [];
  const vw = Array.isArray(x?.vectorWin) ? x.vectorWin : [];

  const missingTiempo = tiempoIso == null;

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${className}`}
      style={{ borderColor: '#2B3139', backgroundColor: 'rgba(17, 20, 24, 0.92)' }}
      data-testid="vistalab-provider-bar"
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-[#2B3139]/80 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#848E9C]">
          Datos proveedor · <span className="font-mono text-[#EAECEF]">mesa_info</span>
        </p>
        <p className="max-w-[min(100%,28rem)] text-[9px] leading-snug text-[#5E6673]">
          Tiempo = segundos desde <span className="font-mono">data_evento.tiempo_actual</span> (no es el reloj BETTING del ciclo).
        </p>
      </div>
      {!x ? (
        <p className="text-[11px] text-amber-200/90">
          Aún no hay fila de resultado con extras — cuando llegue un <span className="font-mono">NEW_RESULT</span> con{' '}
          <span className="font-mono">mesa_info.martingala</span> / <span className="font-mono">data_evento</span>, verás MG,
          trayecto y tiempo aquí.
        </p>
      ) : null}
      {x && missingTiempo ? (
        <p className="mb-2 text-[10px] text-amber-200/85">
          Sin <span className="font-mono">tiempo_actual</span> en el payload → el contador verde queda en <strong>—</strong>.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#5E6673]">MG</span>
          <span className="rounded-md border border-[#FCD535]/35 bg-[#FCD535]/10 px-2 py-0.5 text-xs font-bold text-[#FCD535]">
            {mgLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-xs text-[#EAECEF]">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#5E6673]">Tiempo</span>
          <span className="tabular-nums text-[#0ECB81]">{liveSec != null ? `${liveSec}s` : '—'}</span>
          {tiempoIso ? (
            <span className="max-w-[140px] truncate text-[9px] text-[#5E6673]" title={tiempoIso}>
              · evento
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#5E6673]">Estado</span>
          <span
            className="rounded-md border px-2 py-0.5 text-[11px] font-semibold"
            style={{
              borderColor: active ? 'rgba(14,203,129,0.45)' : 'rgba(71,77,87,0.55)',
              color: active ? '#0ECB81' : '#848E9C',
              backgroundColor: active ? 'rgba(14,203,129,0.08)' : 'rgba(11,14,17,0.5)',
            }}
          >
            {active ? 'Martingala activa' : 'Martingala inactiva'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#5E6673]">Tiro</span>
          <span className="tabular-nums text-[#EAECEF]">
            {shotCur}/{shotTot}
          </span>
        </div>
      </div>

      <div className="mt-2.5 border-t border-[#2B3139] pt-2.5">
        <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-[#5E6673]">Trayecto</p>
        <VistaLabTrajectoryStrip vectorResultado={vr} vectorWin={vw} />
      </div>
    </div>
  );
}
