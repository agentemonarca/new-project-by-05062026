import React from 'react';
import { Wallet } from 'lucide-react';
import { useWallet } from '../../context/WalletContext.jsx';
import { GradientButton } from './GradientButton.jsx';

/**
 * Uses app WalletContext (app must be wrapped in WalletProvider — see main.jsx).
 */
export function WalletConnectButton({ className = '' }) {
  const { address, connectWallet, isConnecting } = useWallet();
  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;

  return (
    <GradientButton
      type="button"
      variant={short ? 'ghost' : 'primary'}
      className={`w-full ${className}`}
      disabled={isConnecting}
      onClick={() => {
        if (!short) connectWallet?.();
      }}
    >
      <Wallet className="h-4 w-4" strokeWidth={1.75} />
      {isConnecting ? 'Connecting…' : short ? `Linked · ${short}` : 'Connect wallet'}
    </GradientButton>
  );
}
