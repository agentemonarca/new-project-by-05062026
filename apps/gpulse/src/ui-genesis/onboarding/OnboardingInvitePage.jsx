import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AccessDenied,
  OnboardingElite,
  formatAigRefDisplay,
  getAigRef,
  setAigRef,
} from '../../modules/onboarding/index.js';

/**
 * `/onboarding` — referral required via `?ref=` → persisted as `localStorage.aig_ref`.
 */
export default function OnboardingInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(false);

  const refFromUrl = useMemo(() => {
    const q = searchParams.get('ref');
    return typeof q === 'string' ? q.trim() : '';
  }, [searchParams]);

  useEffect(() => {
    if (refFromUrl) {
      setAigRef(refFromUrl);
    }
    setHydrated(true);
  }, [refFromUrl]);

  if (!hydrated) {
    return (
      <div
        className="flex min-h-[100dvh] items-center justify-center font-display"
        style={{ backgroundColor: '#0b0f1a' }}
        aria-busy="true"
        aria-label="Cargando"
      >
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-cyan-400/25 border-t-[#00f0ff]" />
      </div>
    );
  }

  const savedRef = getAigRef();
  if (!savedRef) {
    return <AccessDenied />;
  }

  const refUser = formatAigRefDisplay(savedRef) || 'un miembro de la red';

  return (
    <OnboardingElite
      refUser={refUser}
      onEnter={() => {
        navigate('/register');
      }}
    />
  );
}
