import React from 'react';
import { GlassModal } from '../components/GlassModal.jsx';
import { AnimatedLoader } from '../components/AnimatedLoader.jsx';

export function ProcessingModal({ open, message = 'Submitting transaction' }) {
  return (
    <GlassModal open={open} onClose={() => {}} title="Processing" size="sm" dismissible={false}>
      <div className="flex flex-col items-center px-8 py-10">
        <AnimatedLoader label={message} />
      </div>
    </GlassModal>
  );
}
