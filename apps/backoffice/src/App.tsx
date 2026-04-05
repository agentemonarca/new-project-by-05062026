import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { initAuthBridge, syncAuthIntoStore } from '@ai-genesis/bridge';
import MainLayout from '@/layout/MainLayout';
import GenesisDashboardPage from '@/pages/GenesisDashboardPage';
import ControlPlanePage from '@/pages/ControlPlanePage';
import WalletPage from '@/pages/WalletPage';
import NetworkPage from '@/pages/NetworkPage';
import PlaceholderPage from '@/pages/PlaceholderPage';
import GenesisWrapper from '@/wrappers/GenesisWrapper';
import GPulseWrapper from '@/wrappers/GPulseWrapper';
import GpulseControlRelay from '@/system/GpulseControlRelay';
import RealtimeWsBridge from '@/system/RealtimeWsBridge';

function AuthBootstrap() {
  useEffect(() => {
    const unsub = initAuthBridge();
    syncAuthIntoStore();
    return unsub;
  }, []);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthBootstrap />
      <RealtimeWsBridge />
      <GpulseControlRelay />
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<GenesisDashboardPage />} />
          <Route path="/system" element={<ControlPlanePage />} />
          <Route path="/network" element={<NetworkPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/history" element={<PlaceholderPage title="History" />} />
          <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
          <Route path="/support" element={<PlaceholderPage title="Support" />} />
          <Route path="/genesis" element={<GenesisWrapper />} />
          <Route path="/g-pulse" element={<GPulseWrapper />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
