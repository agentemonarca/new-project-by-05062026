import React, { useCallback, useState } from 'react';
import { isWeb3MockMode } from '../utils/web3Mode.js';
import {
  MOCK_USER_ADDRESS,
  fakeState,
  formatMockBalanceUsdt,
  mockAddBalance,
  mockResetBalance,
  mockSimulateNextTransferFailure,
  mockWithdraw,
} from '../utils/mockWeb3.js';

/**
 * Panel de depuración — solo en modo mock (`VITE_WEB3_MODE` distinto de `real`).
 */
export default function MockWeb3DevPanel() {
  const [, force] = useState(0);
  const refresh = useCallback(() => force((n) => n + 1), []);

  if (!isWeb3MockMode()) {
    return null;
  }

  const bal = formatMockBalanceUsdt();
  const shortAddr = `${MOCK_USER_ADDRESS.slice(0, 8)}…${MOCK_USER_ADDRESS.slice(-6)}`;

  return (
    <div
      className="fixed bottom-3 left-3 z-[9999] max-w-[280px] rounded-xl border border-amber-500/50 bg-black/90 p-3 text-left shadow-[0_0_24px_rgba(245,158,11,0.2)] backdrop-blur-md"
      style={{ pointerEvents: 'auto' }}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300/95">[ MOCK MODE ACTIVE ]</p>
      <p className="mt-1.5 text-[9px] font-semibold leading-snug text-amber-200/90">
        🟡 EMULADOR ACTIVO — NO BLOCKCHAIN
      </p>
      <p className="mt-2 font-mono text-[10px] text-white/75">
        Wallet: <span className="text-cyan-200/90">{shortAddr}</span>
      </p>
      <p className="mt-1 font-mono text-[11px] text-white/90">
        Balance: <span className="text-emerald-200/95">{bal}</span> USDT
      </p>
      {fakeState.nextTransferShouldFail ? (
        <p className="mt-2 text-[9px] font-semibold uppercase tracking-wide text-red-400/90">Next tx: forced fail</p>
      ) : null}
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            mockAddBalance(500);
            refresh();
          }}
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 py-2 text-[9px] font-black uppercase tracking-widest text-emerald-100 transition-colors hover:bg-emerald-500/25"
        >
          Add balance
        </button>
        <button
          type="button"
          onClick={() => {
            mockResetBalance();
            refresh();
          }}
          className="rounded-lg border border-white/20 bg-white/5 py-2 text-[9px] font-black uppercase tracking-widest text-white/80 hover:bg-white/10"
        >
          Reset balance
        </button>
        <button
          type="button"
          onClick={() => {
            mockSimulateNextTransferFailure();
            refresh();
          }}
          className="rounded-lg border border-red-500/45 bg-red-500/10 py-2 text-[9px] font-black uppercase tracking-widest text-red-200/95 hover:bg-red-500/20"
        >
          Simulate failure
        </button>
        <button
          type="button"
          onClick={async () => {
            await mockWithdraw(25n * 10n ** 6n);
            refresh();
          }}
          className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 py-2 text-[9px] font-black uppercase tracking-widest text-cyan-100 hover:bg-cyan-500/20"
        >
          Mock withdraw (+25 USDT)
        </button>
      </div>
    </div>
  );
}
