import { useRef } from 'react';
import { isGpulseFlickerForensicEnabled } from '../engine/engineDeterministicForensic.js';

/**
 * Count renders per correlationKey when flicker forensic is on; flags possible render loops.
 * @param {string | null | undefined} correlationKey
 */
export function useEngineRenderForensic(correlationKey) {
  const countRef = useRef(0);
  const lastCkRef = useRef(/** @type {string | null} */ (null));

  if (!isGpulseFlickerForensicEnabled()) return;

  const ck = correlationKey != null && String(correlationKey).trim() !== '' ? String(correlationKey) : null;
  if (ck !== lastCkRef.current) {
    lastCkRef.current = ck;
    countRef.current = 0;
  }
  countRef.current += 1;
  if (countRef.current > 5) {
    console.error('RENDER LOOP', correlationKey ?? '(no-ck)', { renderCount: countRef.current });
  }
}
