import { useRef } from 'react';

/**
 * Dev-only render counter for performance debugging.
 * @param {string} label
 */
export function useRenderCount(label = 'Component') {
  const n = useRef(0);
  if (!import.meta.env.DEV) return;
  n.current += 1;
  if (n.current === 1 || n.current % 30 === 0) {
    console.debug(`[render] ${label} #${n.current}`);
  }
}
