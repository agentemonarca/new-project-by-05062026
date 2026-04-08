import React from 'react';
import { normalizeCycle } from '@/utils/signalNormalizer';

export default function SignalIntelPanel({ activeCycle, engineState }) {
  const data = normalizeCycle(activeCycle);

  return (
    <div className="bg-[#0A0D18] border border-[#1A1F35] rounded-xl p-4">
      <h3 className="text-[10px] text-blue-400 flex items-center gap-2 mb-4 font-bold">
        LECTURA DEL SISTEMA
      </h3>

      <div className="intel-panel text-[#8C9BB4] space-y-1">
        <div>Mesa: {data.mesa}</div>
        <div>Ronda señal: {data.roundSignal}</div>
        <div>Ronda resultado: {data.roundResult}</div>

        <div>Estado: {engineState}</div>

        <div>Señal: {data.side}</div>
        <div>Resultado: {data.winner || '—'}</div>

        <div className="mt-2">Cartas:</div>
        <pre className="bg-[#05050A] border border-[#1D243F] rounded p-2 overflow-x-auto text-[#E2E8F0]">
          {JSON.stringify(
            {
              player: data.playerCards,
              banker: data.bankerCards,
            },
            null,
            2,
          )}
        </pre>

        <div>Historial:</div>
        <pre className="bg-[#05050A] border border-[#1D243F] rounded p-2 overflow-x-auto text-[#E2E8F0]">
          {JSON.stringify(data.history)}
        </pre>

        <div>Martingala:</div>
        <pre className="bg-[#05050A] border border-[#1D243F] rounded p-2 overflow-x-auto text-[#E2E8F0]">
          {JSON.stringify(data.martingale)}
        </pre>
      </div>
    </div>
  );
}
