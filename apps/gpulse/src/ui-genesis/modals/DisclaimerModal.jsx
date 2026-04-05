import React from 'react';
import { GlassModal } from '../components/GlassModal.jsx';
import { GradientButton } from '../components/GradientButton.jsx';

export function DisclaimerModal({ open, onClose, onAccept }) {
  return (
    <GlassModal open={open} onClose={onClose} title="Protocol disclaimer" size="lg">
      <div className="space-y-4 px-6 py-5 text-sm leading-relaxed text-slate-300">
        <p>
          AiGenesis and G-Pulse are interfaces to decentralized software. Digital-asset and protocol interactions carry
          risk, including possible loss of funds used as liquidity contributions.
        </p>
        <p>
          Nothing in this interface is financial, legal, tax, or investment advice, or an offer of securities.
          References to &quot;rewards&quot; or &quot;generated rewards&quot; describe protocol accounting, not guaranteed
          outcomes. By continuing you confirm you understand experimental Web3 software and accept responsibility for
          your keys and transactions.
        </p>
        <div className="flex flex-wrap justify-end gap-3 pt-2">
          <GradientButton variant="ghost" onClick={onClose}>
            Dismiss
          </GradientButton>
          <GradientButton onClick={onAccept}>I understand</GradientButton>
        </div>
      </div>
    </GlassModal>
  );
}
