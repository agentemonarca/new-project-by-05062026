import React from 'react';
import { Gauge, Link2, ShieldOff } from 'lucide-react';

export function BoosterImpact() {
  const rows = [
    { icon: Gauge, text: '+80% velocidad de generación (referencia de protocolo)' },
    { icon: Link2, text: 'Afecta la minería base de tus núcleos vinculados' },
    { icon: ShieldOff, text: 'No sustituye bonos directos ni reglas binarias' },
  ];

  return (
    <section className="rounded-2xl border border-cyan-500/15 bg-slate-950/50 p-5 md:p-6">
      <h2 className="font-display text-sm font-semibold text-white">Impacto en tu núcleo</h2>
      <ul className="mt-4 space-y-3">
        {rows.map(({ icon: Icon, text }) => (
          <li key={text} className="flex gap-3 text-sm text-slate-300">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/10">
              <Icon className="h-4 w-4 text-cyan-300" strokeWidth={1.5} />
            </span>
            <span className="leading-relaxed">{text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[10px] leading-relaxed text-slate-600">
        Información de interfaz; la regla final la aplican contratos y motor del protocolo.
      </p>
    </section>
  );
}
