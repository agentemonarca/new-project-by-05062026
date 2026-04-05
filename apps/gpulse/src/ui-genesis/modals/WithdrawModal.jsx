import React, { useState } from 'react';
import { GlassModal } from '../components/GlassModal.jsx';
import { NeonInput } from '../components/NeonInput.jsx';
import { GradientButton } from '../components/GradientButton.jsx';
import ProtocolDisclaimer from '../components/ProtocolDisclaimer.jsx';

export function WithdrawModal({ open, onClose, onConfirm, asset = 'USDT' }) {
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');

  return (
    <GlassModal open={open} onClose={onClose} title={`Request withdrawal · ${asset}`} size="md">
      <div className="space-y-4 px-6 py-5">
        <NeonInput label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        <NeonInput
          label="Destination address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x…"
        />
        <ProtocolDisclaimer className="pt-1" />
        <div className="flex justify-end gap-3 pt-2">
          <GradientButton variant="ghost" onClick={onClose}>
            Cancel
          </GradientButton>
          <GradientButton onClick={() => onConfirm?.({ amount, address })}>Submit withdrawal request</GradientButton>
        </div>
      </div>
    </GlassModal>
  );
}
