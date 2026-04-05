import React, { useState } from 'react';
import { GlassModal } from '../components/GlassModal.jsx';
import { NeonInput } from '../components/NeonInput.jsx';
import { GradientButton } from '../components/GradientButton.jsx';
import { GlowBadge } from '../components/GlowBadge.jsx';
import { ProtocolDisclaimer } from '../components/ProtocolDisclaimer.jsx';

export function PurchaseModal({ open, onClose, onConfirm }) {
  const [usdt, setUsdt] = useState('');
  const [aig, setAig] = useState('');

  return (
    <GlassModal open={open} onClose={onClose} title="Liquidity contribution (Booster)" size="md">
      <div className="space-y-4 px-6 py-5">
        <div className="flex flex-wrap gap-2">
          <GlowBadge tone="cyan">USDT</GlowBadge>
          <GlowBadge tone="violet">AIG</GlowBadge>
        </div>
        <NeonInput label="Amount (USDT)" value={usdt} onChange={(e) => setUsdt(e.target.value)} placeholder="0.00" />
        <NeonInput label="AIG (optional)" value={aig} onChange={(e) => setAig(e.target.value)} placeholder="0" />
        <ProtocolDisclaimer variant="compact" className="pt-1" />
        <div className="flex justify-end gap-3 pt-2">
          <GradientButton variant="ghost" onClick={onClose}>
            Cancel
          </GradientButton>
          <GradientButton
            onClick={() =>
              onConfirm?.({
                usdt,
                aig,
              })
            }
          >
            Confirm contribution
          </GradientButton>
        </div>
      </div>
    </GlassModal>
  );
}
