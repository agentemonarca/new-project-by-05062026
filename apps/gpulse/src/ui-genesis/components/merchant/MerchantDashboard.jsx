import { memo } from 'react';
import { MerchantOnboarding } from './MerchantOnboarding.jsx';

/** Full-page merchant workspace — same flow as the “Register your business” modal. */
function MerchantDashboardInner() {
  return <MerchantOnboarding mode="page" />;
}

export const MerchantDashboard = memo(MerchantDashboardInner);
