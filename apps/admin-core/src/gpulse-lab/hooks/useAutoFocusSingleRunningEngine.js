import { useEffect, useMemo } from 'react';
import { getEngine, useExecutionEngineStore } from '../store/useExecutionEngineStore.js';
import {
  createEmptyMesaState,
  getEffectiveMesaId,
  useLabStore,
} from '../store/useLabStore.js';
import { normalizeCorrelationKey, parseLabCorrelationKeyParts } from '../utils/labCorrelationKey.js';

/**
 * When exactly one engine is RUNNING, align lab selection to that correlation (less manual mesa picking).
 * Re-evaluates when the singleton runner identity changes, not on every mesa click (skip uses live store read).
 */
export function useAutoFocusSingleRunningEngine() {
  const engineMap = useExecutionEngineStore((s) => s.engineMap);
  const focusMesaForEngineView = useLabStore((s) => s.focusMesaForEngineView);

  const soleRunningCk = useMemo(() => {
    const keys = Object.entries(engineMap)
      .filter(([, st]) => st && String(st.status) === 'RUNNING')
      .map(([ck]) => ck)
      .sort();
    return keys.length === 1 ? keys[0] : null;
  }, [engineMap]);

  useEffect(() => {
    if (soleRunningCk == null) return;

    const { mesas, selectedMesaId } = useLabStore.getState();
    const effectiveId = getEffectiveMesaId(mesas, selectedMesaId);
    const row = effectiveId ? mesas[effectiveId] : createEmptyMesaState();
    const selectedCk = normalizeCorrelationKey(null, row.mesa ?? effectiveId, row.round);
    if (selectedCk === soleRunningCk) return;

    const st = getEngine(soleRunningCk);
    const parts = parseLabCorrelationKeyParts(soleRunningCk);
    const mesaRaw = st?.mesa != null && String(st.mesa).trim() !== '' ? String(st.mesa).trim() : null;
    const mesaId = mesaRaw ?? parts?.mesaId ?? null;
    const round =
      st?.round != null && String(st.round).trim() !== '' ? String(st.round).trim() : parts?.round ?? null;
    if (!mesaId) return;

    focusMesaForEngineView({ mesaId, round });
  }, [soleRunningCk, focusMesaForEngineView]);
}
