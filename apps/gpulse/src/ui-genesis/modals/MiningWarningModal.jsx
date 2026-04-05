import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { GlassModal } from '../components/GlassModal.jsx';
import { GradientButton } from '../components/GradientButton.jsx';

export function MiningWarningModal({ open, onClose, onConfirm }) {
  return (
    <GlassModal open={open} onClose={onClose} title="Mining allocation rule" size="md">
      <div className="px-6 py-5">
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-500/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
          <p className="text-sm text-amber-100/90">
            <strong className="font-semibold">7% holding requirement:</strong> a minimum effective balance may be
            required for mining eligibility. Withdrawing or transferring below the threshold can pause or reduce reward
            accrual until the rule is satisfied again.
          </p>
        </div>
        <p className="text-xs text-slate-500">
          This is a policy summary for UI purposes. Final rules are enforced by smart contracts and backend engines.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <GradientButton variant="ghost" onClick={onClose}>
            Cancel
          </GradientButton>
          <GradientButton onClick={onConfirm}>Continue</GradientButton>
        </div>
      </div>
    </GlassModal>
  );
}
