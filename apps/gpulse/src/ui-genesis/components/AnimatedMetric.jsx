import React, { useEffect, useRef, useState } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';

/**
 * Smoothly interpolates toward `value`; optional subtle pulse on meaningful changes (throttled).
 */
export function AnimatedMetric({ value, format, className = '', pulseOnChange = true }) {
  if (import.meta.env.DEV) console.count('Metric render');
  const fmt =
    format ??
    ((v) =>
      typeof v === 'number' && !Number.isInteger(v)
        ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 })
        : String(v));
  const fromRef = useRef(value);
  const prevValueRef = useRef(value);
  const lastPulseAtRef = useRef(0);
  const displayRafRef = useRef(null);
  const [display, setDisplay] = useState(value);
  const [pulse, setPulse] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
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
      return;
    }
    const delta = Math.abs(value - prevValueRef.current);
    prevValueRef.current = value;
    if (delta < 1e-12) return;

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
      className={`inline-block tabular-nums ${className}`.trim()}
      animate={reduceMotion ? { scale: 1 } : pulse ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      {fmt(display)}
    </motion.span>
  );
}
