import React, { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RegisterPage } from './RegisterPage.jsx';
import { setStoredInviteRef } from '../onboarding/inviteRefStorage.js';

/**
 * Registro con query `ref`; persiste invitación en localStorage para `/onboarding`.
 */
export default function OnboardingRegisterPreviewPage() {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref')?.trim() || '';

  useEffect(() => {
    if (ref) setStoredInviteRef(ref);
  }, [ref]);

  return (
    <div className="relative min-h-screen">
      <div className="fixed left-0 right-0 top-0 z-[100] border-b border-orange-500/35 bg-slate-950/95 px-4 py-3 text-center backdrop-blur-md">
        <p className="font-display text-sm font-semibold text-orange-100/95">Onboarding Preview</p>
        {ref ? (
          <p className="mt-1 font-mono text-xs text-slate-400">
            ref=<span className="text-cyan-300/90">{ref}</span>
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Sin parámetro ref en la URL</p>
        )}
        <Link
          to="/"
          className="mt-2 inline-block text-[11px] font-medium text-cyan-400/90 underline-offset-2 hover:text-cyan-300 hover:underline"
        >
          Volver al inicio
        </Link>
        {ref ? (
          <Link
            to={`/onboarding?ref=${encodeURIComponent(ref)}`}
            className="mt-1 block text-[11px] font-medium text-violet-300/90 underline-offset-2 hover:text-violet-200 hover:underline"
          >
            Ver pantalla premium de invitación
          </Link>
        ) : null}
      </div>
      <div className="pt-24">
        <RegisterPage onRegister={console.log} LinkComponent={Link} />
      </div>
    </div>
  );
}
