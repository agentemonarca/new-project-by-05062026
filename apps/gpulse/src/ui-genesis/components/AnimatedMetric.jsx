import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';

const DEFAULT_FORMAT = (v) =>
  typeof v === 'number' && !Number.isInteger(v)
    ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 })
    : String(v);

/** Stable object identities for Framer Motion (avoids new {} each render). */
const SCALE_IDLE = { scale: 1 };
const SCALE_PULSE = { scale: [1, 1.06, 1] };
const PULSE_TRANSITION = { duration: 0.42, ease: [0.22, 1, 0.36, 1] };

/** Ignore float noise when deciding to restart the tween (parent may pass unstable decimals). */
const VALUE_EPS = 1e-9;

/**
 * Smoothly interpolates toward `value`; optional subtle pulse on meaningful changes (throttled).
 *
 * Performance:
 * - `format` is kept in a ref so inline `format={(v) => ...}` does not defeat `memo`.
 * - Memo compares only `value`, `className`, `pulseOnChange` (see propTypes note below).
 * - Motion `animate` / `transition` use stable references.
 *
 * Edge case: if `value` is unchanged but `format` behavior changes without a parent re-render
 * that changes other compared props, the label could be stale until `value` updates (rare in practice).
 */
export const AnimatedMetric = memo(function AnimatedMetric({
  value,
  format,
  className = '',
  pulseOnChange = true,
}) {
  const formatRef = useRef(format);
  formatRef.current = format;

  const formatDisplay = useCallback((v) => {
    const fn = formatRef.current ?? DEFAULT_FORMAT;
    return fn(v);
  }, []);

  const fromRef = useRef(value);
  const prevValueRef = useRef(value);
  const lastPulseAtRef = useRef(0);
  const displayRafRef = useRef(null);
  const [display, setDisplay] = useState(value);
  const [pulse, setPulse] = useState(false);
  const reduceMotion = useReducedMotion();

  const rootClassName = useMemo(
    () => `inline-block tabular-nums ${className}`.trim(),
    [className],
  );

  const animateTarget = useMemo(() => {
    if (reduceMotion) return SCALE_IDLE;
    return pulse ? SCALE_PULSE : SCALE_IDLE;
  }, [reduceMotion, pulse]);

  useEffect(() => {
    const from = fromRef.current;
    const bothNumbers = typeof value === 'number' && typeof from === 'number';
    if (bothNumbers) {
      if (Number.isFinite(value) && Number.isFinite(from) && Math.abs(value - from) < VALUE_EPS) {
        return undefined;
      }
    } else if (Object.is(value, from)) {
      return undefined;
    }

    const controls = animate(fromRef.current, value, {
      type: 'tween',
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        fromRef.current = v;
        if (displayRafRef.current != null) return;
        displayRafRef.current = requestAnimationFrame(() => {
          displayRafRef.current = null;
          setDisplay(fromRef.current);
        });
      },
      onComplete: () => {
        fromRef.current = value;
        if (displayRafRef.current != null) {
          cancelAnimationFrame(displayRafRef.current);
          displayRafRef.current = null;
        }
        setDisplay(value);
      },
    });
    return () => {
      if (displayRafRef.current != null) {
        cancelAnimationFrame(displayRafRef.current);
        displayRafRef.current = null;
      }
      controls.stop();
    };
  }, [value]);

  useEffect(() => {
    if (!pulseOnChange || reduceMotion) {
      prevValueRef.current = value;
      return undefined;
    }
    const delta = Math.abs(value - prevValueRef.current);
    prevValueRef.current = value;
    if (delta < 1e-12) return undefined;

    const now = Date.now();
    const bigJump = delta >= 0.15;
    const cooled = now - lastPulseAtRef.current >= 1600;
    if (bigJump || (delta > 0 && cooled)) {
      lastPulseAtRef.current = now;
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 420);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [value, pulseOnChange, reduceMotion]);

  return (
    <motion.span
      className={rootClassName}
      animate={animateTarget}
      transition={PULSE_TRANSITION}
    >
      {formatDisplay(display)}
    </motion.span>
  );
}, areAnimatedMetricPropsEqual);

function areAnimatedMetricPropsEqual(prev, next) {
  // Intentionally omit `format`: callers almost always pass an inline function; comparing by
  // reference would force a re-render on every parent render. Latest format is read via ref.
  return (
    prev.value === next.value &&
    prev.className === next.className &&
    prev.pulseOnChange === next.pulseOnChange
  );
}

AnimatedMetric.displayName = 'AnimatedMetric';
