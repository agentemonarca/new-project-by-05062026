import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminPanelStore } from '@/ui-genesis/stores/adminPanelStore.js';
import { ADMIN_MODULE_IDS } from './adminNavConfig.js';
import { pageCrossfade } from '@/ui-genesis/motion/variants.js';
import { AdminOverviewPage } from './pages/AdminOverviewPage.jsx';
import { AdminUsersPage } from './pages/AdminUsersPage.jsx';
import { AdminNetworkPage } from './pages/AdminNetworkPage.jsx';
import { AdminWalletPage } from './pages/AdminWalletPage.jsx';
import { AdminRewardsPage } from './pages/AdminRewardsPage.jsx';
import { AdminP2PPage } from './pages/AdminP2PPage.jsx';
import { AdminSettingsPage } from './pages/AdminSettingsPage.jsx';
import { AdminNotificationsPage } from './pages/AdminNotificationsPage.jsx';
import { AdminSecurityPage } from './pages/AdminSecurityPage.jsx';
import { AdminAnalyticsPage } from './pages/AdminAnalyticsPage.jsx';
import { AdminSystemPage } from './pages/AdminSystemPage.jsx';

/**
 * @param {{ onNavigate?: (navId: string) => void }} props
 */
export function AdminPanelRouter({ onNavigate: _onNavigate }) {
  const activeModule = useAdminPanelStore((s) => s.activeModule);
  const setActiveModule = useAdminPanelStore((s) => s.setActiveModule);

  React.useEffect(() => {
    if (!ADMIN_MODULE_IDS.includes(activeModule)) {
      setActiveModule('overview');
    }
  }, [activeModule, setActiveModule]);

  const page = (() => {
    switch (activeModule) {
      case 'users':
        return <AdminUsersPage key="users" />;
      case 'network':
        return <AdminNetworkPage key="network" />;
      case 'wallet':
        return <AdminWalletPage key="wallet" />;
      case 'bonuses':
        return <AdminRewardsPage key="bonuses" />;
      case 'p2p':
        return <AdminP2PPage key="p2p" />;
      case 'config':
        return <AdminSettingsPage key="config" />;
      case 'notifications':
        return <AdminNotificationsPage key="notifications" />;
      case 'security':
        return <AdminSecurityPage key="security" />;
      case 'analytics':
        return <AdminAnalyticsPage key="analytics" />;
      case 'system':
        return <AdminSystemPage key="system" />;
      case 'overview':
      default:
        return <AdminOverviewPage key="overview" />;
    }
  })();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeModule}
        initial={pageCrossfade.initial}
        animate={pageCrossfade.animate}
        exit={pageCrossfade.exit}
        transition={pageCrossfade.transition}
      >
        {page}
      </motion.div>
    </AnimatePresence>
  );
}
