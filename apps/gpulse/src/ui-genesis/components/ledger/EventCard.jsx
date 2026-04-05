import React, { memo, useCallback, useState } from 'react';
import { CheckCircle2, Clock, Copy, ExternalLink } from 'lucide-react';
import { getTxExplorerUrl } from '../../api/genesisConfig.js';

/**
 * @param {{ event: import('../../ledger/ledgerModel.js').LedgerEvent }} props
 */
function EventCardInner({ event }) {
  const e = event;
  const explorer = e.txHash ? getTxExplorerUrl(e.txHash, e.chainId ?? undefined) : null;
  const when = new Date(e.ts).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const status = e.txStatus ?? (e.txHash ? 'confirmed' : null);
  const [copied, setCopied] = useState(false);

  const copyHash = useCallback(async () => {
    if (!e.txHash) return;
    try {
      await navigator.clipboard.writeText(e.txHash);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [e.txHash]);

  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-cyan-500/25">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-200">
              {e.category}
            </span>
            <span className="text-[10px] font-mono uppercase text-slate-500">{e.kind}</span>
            {status === 'pending' ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/35 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-200">
                <Clock className="h-3 w-3" aria-hidden />
                Pending
              </span>
            ) : null}
            {status === 'confirmed' ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-200">
                <CheckCircle2 className="h-3 w-3" aria-hidden />
                Confirmed
              </span>
            ) : null}
          </div>
          <h4 className="mt-1.5 font-display text-sm font-semibold text-white">{e.title}</h4>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{e.summary}</p>
        </div>
        <time className="shrink-0 font-mono text-[10px] text-slate-500">{when}</time>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/5 pt-2 font-mono text-[11px]">
        {e.amountUsdt != null && Number.isFinite(e.amountUsdt) ? (
          <span className="text-cyan-200/95">{e.amountUsdt.toLocaleString(undefined, { maximumFractionDigits: 4 })} USDT</span>
        ) : null}
        {e.amountAig != null && Number.isFinite(e.amountAig) ? (
          <span className="text-fuchsia-200/95">{e.amountAig.toLocaleString(undefined, { maximumFractionDigits: 2 })} AIG</span>
        ) : null}
        {e.txHash ? (
          <span className="flex min-w-0 flex-wrap items-center gap-2 text-slate-500">
            <span className="truncate" title={e.txHash}>
              {e.txHash.slice(0, 10)}…{e.txHash.slice(-8)}
            </span>
            <button
              type="button"
              onClick={copyHash}
              className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-white/10 px-2 py-0.5 text-cyan-400 transition hover:border-cyan-500/40 hover:text-cyan-300"
            >
              <Copy className="h-3 w-3" aria-hidden />
              {copied ? 'Copied' : 'Copy'}
            </button>
            {explorer ? (
              <a
                href={explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-0.5 text-cyan-400 hover:text-cyan-300"
              >
                <ExternalLink className="h-3 w-3" aria-hidden />
                Explorer
              </a>
            ) : null}
          </span>
        ) : null}
      </div>
    </article>
  );
}

export const EventCard = memo(EventCardInner);
