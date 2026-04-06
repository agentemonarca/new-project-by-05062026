import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { validateAccessCode } from './verifyConfig.js';

const DIGIT_COUNT = 6;

/**
 * @param {{
 *   email?: string | null,
 *   onSuccess: () => void,
 *   onBack?: () => void,
 * }} props
 */
function VerifyCodeInner({ email: emailProp, onSuccess, onBack }) {
  const reduceMotion = useReducedMotion();
  const [digits, setDigits] = useState(() => Array(DIGIT_COUNT).fill(''));
  const [error, setError] = useState(false);
  const inputsRef = useRef(/** @type {(HTMLInputElement | null)[]} */ ([]));
  const successLockRef = useRef(false);

  const emailDisplay = String(emailProp ?? '').trim() || 'tu correo';

  const focusIndex = useCallback((idx) => {
    const el = inputsRef.current[idx];
    if (el && typeof el.focus === 'function') el.focus();
    if (el && typeof el.select === 'function') el.select();
  }, []);

  useEffect(() => {
    focusIndex(0);
  }, [focusIndex]);

  const runValidate = useCallback(
    (code) => {
      if (successLockRef.current) return;
      const ok = validateAccessCode(code);
      if (ok) {
        successLockRef.current = true;
        setError(false);
        onSuccess?.();
        return;
      }
      setError(true);
    },
    [onSuccess],
  );

  const handleChange = useCallback(
    (index, e) => {
      const raw = e.target.value;
      const d = raw.replace(/\D/g, '').slice(-1);
      setError(false);
      setDigits((prev) => {
        const next = [...prev];
        next[index] = d || '';
        const joined = next.join('');
        if (joined.length === DIGIT_COUNT) {
          requestAnimationFrame(() => runValidate(joined));
        }
        return next;
      });
      if (d && index < DIGIT_COUNT - 1) {
        requestAnimationFrame(() => focusIndex(index + 1));
      }
    },
    [focusIndex, runValidate],
  );

  const handleKeyDown = useCallback(
    (index, e) => {
      if (e.key === 'Backspace') {
        setDigits((prev) => {
          const next = [...prev];
          if (!next[index] && index > 0) {
            requestAnimationFrame(() => focusIndex(index - 1));
            next[index - 1] = '';
            return next;
          }
          next[index] = '';
          return next;
        });
        setError(false);
        return;
      }
      if (e.key === 'ArrowLeft' && index > 0) {
        e.preventDefault();
        focusIndex(index - 1);
      }
      if (e.key === 'ArrowRight' && index < DIGIT_COUNT - 1) {
        e.preventDefault();
        focusIndex(index + 1);
      }
    },
    [focusIndex],
  );

  const handlePaste = useCallback(
    (e) => {
      e.preventDefault();
      const text = e.clipboardData?.getData('text') ?? '';
      const only = text.replace(/\D/g, '').slice(0, DIGIT_COUNT);
      if (!only) return;
      const next = Array(DIGIT_COUNT)
        .fill('')
        .map((_, i) => only[i] ?? '');
      setDigits(next);
      setError(false);
      const focusAt = Math.min(only.length, DIGIT_COUNT - 1);
      requestAnimationFrame(() => {
        focusIndex(focusAt);
        if (only.length === DIGIT_COUNT) {
          runValidate(only);
        }
      });
    },
    [focusIndex, runValidate],
  );

  return (
    <div
      className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 py-12 font-display"
      style={{ backgroundColor: '#0b0f1a' }}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_-10%,rgba(0,240,255,0.1),transparent_55%),radial-gradient(ellipse_70%_45%_at_100%_100%,rgba(168,85,247,0.12),transparent_50%)]"
        aria-hidden
      />

      <motion.div
        className="relative z-10 w-full max-w-md rounded-[20px] border border-[rgba(0,240,255,0.2)] bg-white/[0.03] px-6 py-8 shadow-[0_0_48px_-12px_rgba(0,240,255,0.15)] backdrop-blur-[20px] sm:px-8 sm:py-10"
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="mb-4 text-left text-xs font-medium text-slate-500 transition-colors hover:text-cyan-300/90"
          >
            ← Volver
          </button>
        ) : null}

        <h1 className="text-center text-xl font-semibold tracking-tight text-white sm:text-2xl">Verificación de Acceso</h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-slate-400">
          Introduce el código enviado a tu correo
        </p>
        <p className="mt-1 text-center font-mono text-[11px] text-slate-500">{emailDisplay}</p>
        <p className="mt-4 text-center text-xs italic text-slate-500/90">Tu identidad está siendo validada</p>

        <motion.div
          className="mt-8 flex justify-center gap-2 sm:gap-3"
          role="group"
          aria-label="Código de verificación de 6 dígitos"
          onPaste={handlePaste}
          animate={error ? { x: [0, -5, 5, -4, 4, 0] } : { x: 0 }}
          transition={{ duration: 0.4 }}
        >
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputsRef.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              value={d}
              aria-invalid={error}
              aria-label={`Dígito ${i + 1} de ${DIGIT_COUNT}`}
              onChange={(e) => handleChange(i, e)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`h-12 w-10 rounded-xl border bg-white/[0.04] text-center text-lg font-semibold text-white shadow-inner outline-none transition-all sm:h-14 sm:w-12 sm:text-xl ${
                error
                  ? 'border-red-400/55 ring-1 ring-red-400/30'
                  : 'border-[rgba(0,240,255,0.25)] focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-500/25'
              }`}
            />
          ))}
        </motion.div>

        {error ? (
          <p className="mt-4 text-center text-sm font-medium text-red-400/95" role="alert">
            Código incorrecto. Revisa el mensaje o solicita uno nuevo.
          </p>
        ) : null}
      </motion.div>
    </div>
  );
}

export const VerifyCode = memo(VerifyCodeInner);
VerifyCode.displayName = 'VerifyCode';
