import { useEffect, useRef } from 'react';
import { useAlertStore } from '../store/useAlertStore.js';
import { useValidationStore } from '../store/useValidationStore.js';

const LS_CYCLES = 'gpulse-lab.persist.cycles.v1';
const LS_ALERTS = 'gpulse-lab.persist.alerts.v1';

const SAVE_DEBOUNCE_MS = 500;

/**
 * Hydrates last cycles + alerts from localStorage and keeps them in sync (optional continuity).
 */
export function useGpulseLabPersistence() {
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    try {
      const rawCycles = localStorage.getItem(LS_CYCLES);
      if (rawCycles) {
        const parsed = JSON.parse(rawCycles);
        if (Array.isArray(parsed) && parsed.length > 0) {
          useValidationStore.setState({ cycles: parsed.slice(0, 50) });
        }
      }
    } catch {
      /* ignore */
    }

    try {
      const rawAlerts = localStorage.getItem(LS_ALERTS);
      if (rawAlerts) {
        const parsed = JSON.parse(rawAlerts);
        if (Array.isArray(parsed) && parsed.length > 0) {
          useAlertStore.setState({ alerts: parsed.slice(0, 50) });
        }
      }
    } catch {
      /* ignore */
    }

    let timer = null;
    const scheduleSave = () => {
      if (timer != null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        try {
          const cycles = useValidationStore.getState().cycles;
          localStorage.setItem(LS_CYCLES, JSON.stringify(cycles));
        } catch {
          /* quota / private mode */
        }
        try {
          const alerts = useAlertStore.getState().alerts;
          localStorage.setItem(LS_ALERTS, JSON.stringify(alerts));
        } catch {
          /* quota */
        }
      }, SAVE_DEBOUNCE_MS);
    };

    const unsubV = useValidationStore.subscribe(scheduleSave);
    const unsubA = useAlertStore.subscribe(scheduleSave);

    return () => {
      unsubV();
      unsubA();
      if (timer != null) clearTimeout(timer);
    };
  }, []);
}
