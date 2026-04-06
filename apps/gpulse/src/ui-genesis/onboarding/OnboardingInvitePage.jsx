import React, { useEffect, useMemo } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import OnboardingPremium from './OnboardingPremium.jsx';
import {
  formatInviteDisplayName,
  getStoredInviteRef,
  setStoredInviteRef,
} from './inviteRefStorage.js';

/**
 * `/onboarding` — requires a referral handle (URL `ref` or persisted invite).
 */
export default function OnboardingInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const refFromUrl = useMemo(() => {
    const q = searchParams.get('ref');
    return typeof q === 'string' ? q.trim() : '';
  }, [searchParams]);

  useEffect(() => {
    if (refFromUrl) setStoredInviteRef(refFromUrl);
  }, [refFromUrl]);

  const rawRef = refFromUrl || getStoredInviteRef();

  if (!rawRef) {
    return <Navigate to="/register" replace />;
  }

  const refUser = formatInviteDisplayName(rawRef);

  return (
    <OnboardingPremium
      refUser={refUser || 'Un miembro'}
      onContinue={() => {
        navigate(`/register?ref=${encodeURIComponent(rawRef)}`, { replace: false });
      }}
    />
  );
}
