import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RegisterPage } from './RegisterPage.jsx';
import { AccessDenied, getAigRef, setAigRef } from '../../modules/onboarding/index.js';
import { SESSION_EMAIL_KEY, VerifyCode, WelcomeGenesis } from '../../modules/auth/index.js';

/**
 * Registro — solo con referido (`aig_ref`); flujo: registro → verificación OTP → bienvenida → /dashboard
 */
export default function OnboardingRegisterPreviewPage() {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref')?.trim() || '';
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(/** @type {'register' | 'verify' | 'welcome'} */ ('register'));
  const [registerEmail, setRegisterEmail] = useState('');
  const [regError, setRegError] = useState('');

  useEffect(() => {
    if (ref) setAigRef(ref);
    setHydrated(true);
  }, [ref]);

  const handleRegister = useCallback((data) => {
    const email = String(data?.email ?? '').trim();
    const password = String(data?.password ?? '');
    const confirm = String(data?.confirm ?? '');
    if (!email) {
      setRegError('Introduce un correo válido.');
      return;
    }
    if (!password) {
      setRegError('Introduce una contraseña.');
      return;
    }
    if (password !== confirm) {
      setRegError('Las contraseñas no coinciden.');
      return;
    }
    setRegError('');
    try {
      sessionStorage.setItem(SESSION_EMAIL_KEY, email);
    } catch {
      /* ignore */
    }
    setRegisterEmail(email);
    setStep('verify');
  }, []);

  const handleVerifySuccess = useCallback(() => {
    setStep('welcome');
  }, []);

  const handleVerifyBack = useCallback(() => {
    setStep('register');
  }, []);

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

  if (!getAigRef()) {
    return <AccessDenied />;
  }

  if (step === 'verify') {
    return (
      <VerifyCode
        email={registerEmail || sessionStorage.getItem(SESSION_EMAIL_KEY) || ''}
        onSuccess={handleVerifySuccess}
        onBack={handleVerifyBack}
      />
    );
  }

  if (step === 'welcome') {
    return <WelcomeGenesis />;
  }

  return (
    <div className="relative min-h-screen">
      <div className="fixed left-0 right-0 top-0 z-[100] border-b border-orange-500/35 bg-slate-950/95 px-4 py-3 text-center backdrop-blur-md">
        <p className="font-display text-sm font-semibold text-orange-100/95">Onboarding Preview</p>
        {ref ? (
          <p className="mt-1 font-mono text-xs text-slate-400">
            ref=<span className="text-cyan-300/90">{ref}</span>
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Referido en sesión (localStorage)</p>
        )}
        <Link
          to="/"
          className="mt-2 inline-block text-[11px] font-medium text-cyan-400/90 underline-offset-2 hover:text-cyan-300 hover:underline"
        >
          Volver al inicio
        </Link>
        <Link
          to={`/onboarding?ref=${encodeURIComponent(getAigRef() || '')}`}
          className="mt-1 block text-[11px] font-medium text-violet-300/90 underline-offset-2 hover:text-violet-200 hover:underline"
        >
          Ver invitación elite
        </Link>
      </div>

      {regError ? (
        <div className="fixed left-0 right-0 top-[120px] z-[99] mx-auto max-w-lg px-4">
          <div
            role="alert"
            className="rounded-xl border border-red-400/35 bg-red-950/80 px-4 py-2 text-center text-sm text-red-200"
          >
            {regError}
          </div>
        </div>
      ) : null}

      <div className="pt-24">
        <RegisterPage onRegister={handleRegister} LinkComponent={Link} />
      </div>
    </div>
  );
}
