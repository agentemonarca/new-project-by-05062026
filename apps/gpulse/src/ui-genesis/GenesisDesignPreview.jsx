import React, { useState } from 'react';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.jsx';
import { GenesisDashboardPage } from './pages/GenesisDashboardPage.jsx';
import { DisclaimerModal } from './modals/DisclaimerModal.jsx';
import { PurchaseModal } from './modals/PurchaseModal.jsx';
import { WithdrawModal } from './modals/WithdrawModal.jsx';
import { ProcessingModal } from './modals/ProcessingModal.jsx';
import { SuccessModal } from './modals/SuccessModal.jsx';
import { ErrorModal } from './modals/ErrorModal.jsx';
import { GlowBadge } from './components/GlowBadge.jsx';
import { GradientButton } from './components/GradientButton.jsx';
import { motion } from 'framer-motion';
import { useWallet } from '../context/WalletContext.jsx';
import { GenesisPreviewWalletBridgeContext } from '../context/GenesisPreviewWalletBridge.jsx';
import { useGenesisDashboardStore } from './stores/genesisDashboardStore.js';
import { getBackendBaseUrl, getTxExplorerUrl } from './api/genesisConfig.js';

/** Full design-system sandbox: switch auth / dashboard + open any modal. */
function GenesisDesignPreview() {
  const walletApi = useWallet();
  const { address, expectedChainId } = walletApi;
  const deposit = useGenesisDashboardStore((s) => s.deposit);

  const [route, setRoute] = useState('dashboard');
  const [disclaimer, setDisclaimer] = useState(false);
  const [purchase, setPurchase] = useState(false);
  const [withdraw, setWithdraw] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successPayload, setSuccessPayload] = useState({ message: '', txHash: null, explorerUrl: null });
  const [error, setError] = useState(false);
  const [errorDetail, setErrorDetail] = useState('');

  const NavBtn = ({ id, children }) => (
    <motion.button
      type="button"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => setRoute(id)}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        route === id
          ? 'bg-white/15 text-white shadow-glowCyan'
          : 'text-slate-400 hover:text-white'
      }`}
    >
      {children}
    </motion.button>
  );

  return (
    <GenesisPreviewWalletBridgeContext.Provider value={walletApi}>
    <div className="relative min-h-screen">
      <div className="fixed left-0 right-0 top-0 z-[90] flex flex-wrap items-center justify-center gap-2 border-b border-white/10 bg-slate-950/80 px-3 py-2 backdrop-blur-xl">
        <GlowBadge tone="neutral" className="mr-2">
          UI system preview
        </GlowBadge>
        <NavBtn id="login">Login</NavBtn>
        <NavBtn id="register">Register</NavBtn>
        <NavBtn id="forgot">Forgot</NavBtn>
        <NavBtn id="dashboard">Dashboard</NavBtn>
        <span className="mx-2 hidden h-4 w-px bg-white/15 sm:inline" aria-hidden />
        <GradientButton variant="ghost" className="!py-1.5 !text-xs" onClick={() => setDisclaimer(true)}>
          Disclaimer
        </GradientButton>
        <GradientButton variant="ghost" className="!py-1.5 !text-xs" onClick={() => setMining(true)}>
          Mining
        </GradientButton>
        <GradientButton variant="ghost" className="!py-1.5 !text-xs" onClick={() => setPurchase(true)}>
          Purchase
        </GradientButton>
        <GradientButton variant="ghost" className="!py-1.5 !text-xs" onClick={() => setWithdraw(true)}>
          Request withdrawal
        </GradientButton>
        <GradientButton variant="ghost" className="!py-1.5 !text-xs" onClick={() => setProcessing(true)}>
          Processing
        </GradientButton>
        <GradientButton variant="ghost" className="!py-1.5 !text-xs" onClick={() => setSuccess(true)}>
          Success
        </GradientButton>
        <GradientButton variant="ghost" className="!py-1.5 !text-xs" onClick={() => setError(true)}>
          Error
        </GradientButton>
      </div>

      <div className="pt-14">
        {route === 'login' ? (
          <LoginPage onLogin={console.log} showLinks={false} />
        ) : route === 'register' ? (
          <RegisterPage onRegister={console.log} />
        ) : route === 'forgot' ? (
          <ForgotPasswordPage onSendRecovery={console.log} />
        ) : (
          <GenesisDashboardPage
            onOpenPurchase={() => setPurchase(true)}
            onOpenWithdraw={() => setWithdraw(true)}
          />
        )}
      </div>

      <DisclaimerModal
        open={disclaimer}
        onClose={() => setDisclaimer(false)}
        onAccept={() => setDisclaimer(false)}
      />
      <PurchaseModal
        open={purchase}
        onClose={() => setPurchase(false)}
        onConfirm={async (payload) => {
          setPurchase(false);
          if (!address) {
            setErrorDetail('Connect your wallet first');
            setError(true);
            return;
          }
          const amount = String(payload?.usdt || '').trim();
          if (!amount || parseFloat(amount) <= 0) {
            setErrorDetail('Enter a valid amount');
            setError(true);
            return;
          }
          setProcessing(true);
          try {
            const { txHash } = await deposit({
              userAddress: address,
              amountEther: amount,
              expectedChainId: expectedChainId != null ? BigInt(expectedChainId) : undefined,
            });
            setProcessing(false);
            setSuccessPayload({
              message: 'Deposit verified and credited.',
              txHash,
              explorerUrl: getTxExplorerUrl(txHash),
            });
            setSuccess(true);
          } catch (e) {
            setProcessing(false);
            setErrorDetail(String(e?.message || e));
            setError(true);
          }
        }}
      />
      <WithdrawModal
        open={withdraw}
        onClose={() => setWithdraw(false)}
        onConfirm={(payload) => {
          console.log('withdraw', payload);
          setWithdraw(false);
        }}
      />
      <ProcessingModal open={processing} />
      {processing ? (
        <button
          type="button"
          className="fixed bottom-4 left-1/2 z-[110] -translate-x-1/2 rounded-full border border-white/20 bg-slate-900/90 px-4 py-2 text-xs text-slate-300"
          onClick={() => setProcessing(false)}
        >
          Dismiss processing (demo)
        </button>
      ) : null}
      <SuccessModal
        open={success}
        onClose={() => setSuccess(false)}
        message={successPayload.message}
        txHash={successPayload.txHash}
        explorerUrl={successPayload.explorerUrl}
      />
      <ErrorModal
        open={error}
        onClose={() => setError(false)}
        message={errorDetail || 'Something went wrong'}
        detail={errorDetail}
      />
    </div>
    </GenesisPreviewWalletBridgeContext.Provider>
  );
}

export { GenesisDesignPreview };
export default GenesisDesignPreview;
