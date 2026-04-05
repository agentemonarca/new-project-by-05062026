import React from 'react';
import { TrendingUp, Cpu, Shield } from 'lucide-react';

const ITEMS = [
  {
    icon: TrendingUp,
    text: 'Hasta +18% de peso en distribución (referencia orientativa según programa y actividad del sistema).',
  },
  {
    icon: Cpu,
    text: 'Contribuye a la estabilidad operativa del protocolo al mantener liquidez comprometida.',
  },
  {
    icon: Shield,
    text: 'Refuerza tu núcleo activo; no está sujeto a los mismos ajustes que ciertos bonos.',
  },
];

export function StakingImpact() {
  return (
    <section className="rounded-2xl border border-blue-500/15 bg-slate-950/50 p-5 md:p-6">
      <h2 className="font-display text-base font-semibold text-white">Impacto en tu participación</h2>
      <p className="mt-2 text-xs text-slate-500">Cómo el bloqueo se traduce en participación dentro del sistema.</p>
      <ul className="mt-4 space-y-3">
        {ITEMS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex gap-3 text-sm text-slate-300">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-500/20 bg-sky-500/8 text-sky-300">
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="leading-relaxed">{text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
