import React from 'react';

const DEFAULT_COPY = (
  <>
    AiGenesis es un protocolo basado en participación de liquidez. Las recompensas no están garantizadas y pueden variar
    según el sistema.
  </>
);

/**
 * @param {{ variant?: 'banner' | 'compact' | 'modal', className?: string, compactMessage?: string, children?: React.ReactNode }} [props]
 */
export default function ProtocolDisclaimer({ variant = 'banner', className = '', compactMessage, children }) {
  const body = children ?? DEFAULT_COPY;

  if (variant === 'compact') {
    const content = compactMessage != null ? compactMessage : body;
    return (
      <p className={`text-[10px] leading-snug text-slate-500 ${className}`.trim()} role="note">
        {content}
      </p>
    );
  }

  if (variant === 'modal') {
    return (
      <div
        className={`rounded-xl border border-amber-500/20 bg-amber-950/20 px-4 py-3 text-xs leading-relaxed text-amber-100/90 ${className}`.trim()}
        role="note"
      >
        <p className="text-amber-100/85">{body}</p>
      </div>
    );
  }

  return (
    <div className={`text-xs text-white/60 mt-4 ${className}`.trim()} role="note">
      {body}
    </div>
  );
}

export { ProtocolDisclaimer };
