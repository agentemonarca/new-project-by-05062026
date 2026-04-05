import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';
import { GlassCard } from '../components/GlassCard.jsx';
import { GradientButton } from '../components/GradientButton.jsx';
import { useTermsAcceptanceStore } from '../stores/termsAcceptanceStore.js';

const SECTIONS = [
  {
    title: 'Participación',
    body: 'Requiere participación activa según productos del protocolo (minería, staking u otros vigentes). Sin posiciones elegibles, pueden aplicarse limitaciones a devengos y reclamos.',
  },
  {
    title: 'Rendimientos',
    body: 'No hay ingresos garantizados. Las cantidades mostradas son estimaciones o contabilidad del sistema; el resultado real depende de la actividad de la red, contratos y políticas vigentes.',
  },
  {
    title: 'Sistema binario',
    body: 'El emparejamiento usa el volumen del lado menor (match). Tras cada match, ambas piernas se reducen en esa cantidad. El bono binario aplicable se calcula sobre el volumen emparejado según la tasa del plan (p. ej. 11%).',
  },
  {
    title: 'Flash mensual',
    body: 'A cierre de período puede aplicarse una reducción del volumen remanente en cada pierna (p. ej. factor 0,5 por lado, de forma independiente). Revise el panel binario y el historial operativo para transparencia.',
  },
  {
    title: 'Staking y economía activa',
    body: 'Para desbloquear el flujo completo de ingresos del protocolo suele exigirse staking activo y condiciones de cuenta según reglas publicadas en la interfaz.',
  },
  {
    title: 'Holding AIG (referencia)',
    body: 'Puede existir un requisito mínimo de participación en AIG respecto al portafolio (p. ej. ~7% en la interfaz). Incumplirlo puede congelar o limitar reclamos hasta regularizar.',
  },
  {
    title: 'Token AIG',
    body: 'AIG es el activo de recompensa/unidad de cuenta mostrada en el ecosistema. Conversiones y precios siguen mecanismos del protocolo; no constituye asesoramiento de inversión.',
  },
  {
    title: 'Responsabilidad del usuario',
    body: 'Usted es responsable de la seguridad de su wallet, de la veracidad de los datos que envíe y de cumplir la normativa aplicable en su jurisdicción. La información de la app es orientativa.',
  },
];

/**
 * Blocking full-screen terms — no dismiss except accept + checkbox.
 */
export function TermsAcceptanceModal() {
  const acceptTerms = useTermsAcceptanceStore((s) => s.acceptTerms);
  const [checked, setChecked] = useState(false);

  const onContinue = useCallback(() => {
    if (!checked) return;
    acceptTerms();
  }, [checked, acceptTerms]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-acceptance-title"
      className="fixed inset-0 z-[300] flex items-stretch justify-center bg-slate-950/95 p-4 backdrop-blur-xl md:p-8"
    >
      <motion.div
        className="flex w-full max-w-2xl flex-col justify-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <GlassCard className="border-cyan-500/25 shadow-[0_0_48px_-12px_rgba(34,211,238,0.25)]" contentClassName="p-0">
          <div className="max-h-[min(88vh,820px)] overflow-y-auto">
            <div className="sticky top-0 z-[1] border-b border-white/10 bg-slate-950/80 px-6 py-5 backdrop-blur-md">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-200">
                  <FileText className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div>
                  <h1 id="terms-acceptance-title" className="font-display text-lg font-semibold text-white md:text-xl">
                    Acuerdo de Uso y Responsabilidad — AiGenesis
                  </h1>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Debe leer y aceptar para continuar. Este resumen no sustituye documentos legales que su jurisdicción o el
                    protocolo publiquen aparte.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5 px-6 py-6">
              {SECTIONS.map((s) => (
                <section key={s.title}>
                  <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-cyan-200/85">{s.title}</h2>
                  <p className="mt-2 text-[10px] leading-relaxed text-slate-400 md:text-[11px]">{s.body}</p>
                </section>
              ))}
            </div>

            <div className="border-t border-white/10 bg-slate-950/60 px-6 py-5">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-slate-900 text-cyan-500 focus:ring-cyan-500/40"
                />
                <span className="text-[11px] leading-snug text-slate-300">I have read and accept the terms.</span>
              </label>
              <GradientButton
                type="button"
                className="mt-4 w-full !py-3 !text-sm"
                disabled={!checked}
                onClick={onContinue}
              >
                Continuar
              </GradientButton>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </div>,
    document.body,
  );
}
