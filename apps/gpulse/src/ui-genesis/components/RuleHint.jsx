import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { HelpCircle, Info } from 'lucide-react';
import { RulesDetailModal } from '../modals/RulesDetailModal.jsx';

/**
 * Contextual rule copy — small, low-emphasis; opens optional detail modal.
 *
 * @param {{
 *   variant?: 'inline' | 'tooltip' | 'alert',
 *   message: React.ReactNode,
 *   linkText?: string,
 *   modalTitle: string,
 *   modalContent: React.ReactNode,
 *   className?: string,
 *   icon?: 'info' | 'help',
 * }} props
 */
export function RuleHint({
  variant = 'inline',
  message,
  linkText = 'Ver reglas',
  modalTitle,
  modalContent,
  className = '',
  icon = 'info',
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const wrapRef = useRef(/** @type {HTMLSpanElement | null} */ (null));
  const tipId = useId();

  const openDetail = useCallback(() => setModalOpen(true), []);

  useEffect(() => {
    if (!tipOpen) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(/** @type {Node} */ (e.target))) setTipOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [tipOpen]);

  const Icon = icon === 'help' ? HelpCircle : Info;

  const linkCls =
    'border-none bg-transparent p-0 font-medium text-slate-400/95 underline decoration-white/15 underline-offset-2 transition hover:text-cyan-200/90 hover:decoration-cyan-400/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/50';

  if (variant === 'tooltip') {
    return (
      <>
        <span ref={wrapRef} className={`relative inline-flex items-center gap-1 text-[11px] text-slate-500/90 ${className}`}>
          <span>{message}</span>
          <button
            type="button"
            className={`inline-flex rounded p-0.5 text-slate-500 opacity-80 transition hover:text-cyan-300/90 hover:opacity-100 hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.35)] ${tipOpen ? 'text-cyan-300/90' : ''}`}
            aria-expanded={tipOpen}
            aria-describedby={tipOpen ? tipId : undefined}
            onClick={() => setTipOpen((v) => !v)}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            <span className="sr-only">{linkText}</span>
          </button>
          {tipOpen ? (
            <span
              id={tipId}
              role="tooltip"
              className="absolute left-0 top-full z-50 mt-1.5 w-[min(100vw-2rem,280px)] rounded-lg border border-cyan-500/20 bg-slate-950/95 px-3 py-2 shadow-[0_0_24px_-8px_rgba(34,211,238,0.25)]"
            >
              <div className="max-h-36 overflow-y-auto text-[10px] leading-relaxed text-slate-300">{modalContent}</div>
              <button
                type="button"
                className="mt-2 text-[10px] font-medium text-cyan-400/95 hover:text-cyan-300"
                onClick={() => {
                  setTipOpen(false);
                  setModalOpen(true);
                }}
              >
                Ver completo
              </button>
            </span>
          ) : null}
        </span>
        <RulesDetailModal open={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle}>
          {modalContent}
        </RulesDetailModal>
      </>
    );
  }

  if (variant === 'alert') {
    return (
      <>
        <div
          className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-100/85 ${className}`}
        >
          <span className="text-amber-200/80">ⓘ</span>
          <span className="text-[11px] text-amber-100/90">{message}</span>
          {linkText ? (
            <button type="button" className={linkCls} onClick={openDetail}>
              {linkText}
            </button>
          ) : null}
        </div>
        <RulesDetailModal open={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle}>
          {modalContent}
        </RulesDetailModal>
      </>
    );
  }

  /* inline */
  return (
    <>
      <p className={`text-[11px] leading-relaxed text-slate-500/90 ${className}`}>
        <span className="text-slate-500/80">{message}</span>{' '}
        <button type="button" className={linkCls} onClick={openDetail}>
          {linkText}
        </button>
      </p>
      <RulesDetailModal open={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle}>
        {modalContent}
      </RulesDetailModal>
    </>
  );
}
