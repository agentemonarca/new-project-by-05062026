import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getNextAigPrice } from '@/utils/aigPriceEngine';
import { applySimulatedAigPrice } from '@/utils/pricing';
import { useSimulationModeStore } from '../ui-genesis/stores/simulationModeStore.js';

export const AigPriceContext = createContext(null);

/**
 * @returns {{ price: number, change: number, percent: string, direction: 'up'|'down', isSimulationPrice: boolean } | null}
 */
export function useAigPriceFromContext() {
  return useContext(AigPriceContext);
}

function readStaticOracleUsd() {
  const raw = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_AIG_USD_ORACLE : undefined;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  return 23.5;
}

/**
 * Drives the global AIG/USD oracle and optional UI ticker metadata.
 *
 * - **Modo simulación (store `isSimulationMode`):** random walk vía `getNextAigPrice` (~3s), mismo sentido que datos simulados del dashboard.
 * - **Modo live:** precio fijo = `VITE_AIG_USD_ORACLE` o 23.5 — sin ticker ficticio mezclado con “real”.
 *
 * Usar **una vez** arriba del árbol Genesis y exponer con `AigPriceContext.Provider`.
 * `applySimulatedAigPrice` mantiene `getAigPrice()` alineado para pagos / motor / `useUSDValue`.
 */
export function useAigPrice() {
  const isSimulationMode = useSimulationModeStore((s) => s.isSimulationMode);
  const staticOracle = useMemo(() => readStaticOracleUsd(), []);

  const [simPrice, setSimPrice] = useState(staticOracle);
  const [simPrev, setSimPrev] = useState(staticOracle);

  const displayPrice = isSimulationMode ? simPrice : staticOracle;
  const change = isSimulationMode ? simPrice - simPrev : 0;
  const percent =
    isSimulationMode && simPrev !== 0
      ? ((change / simPrev) * 100).toFixed(2)
      : isSimulationMode && Number.isFinite(change)
        ? (change * 100).toFixed(2)
        : '0.00';

  useEffect(() => {
    applySimulatedAigPrice(displayPrice);
  }, [displayPrice]);

  useEffect(() => {
    if (!isSimulationMode) {
      setSimPrice(staticOracle);
      setSimPrev(staticOracle);
      return undefined;
    }

    const seed = staticOracle;
    setSimPrice(seed);
    setSimPrev(seed);

    const id = setInterval(() => {
      setSimPrice((p) => {
        setSimPrev(p);
        return getNextAigPrice(p);
      });
    }, 3000);

    return () => clearInterval(id);
  }, [isSimulationMode, staticOracle]);

  return useMemo(
    () => ({
      price: displayPrice,
      change,
      percent,
      direction: change >= 0 ? 'up' : 'down',
      isSimulationPrice: isSimulationMode,
    }),
    [displayPrice, change, percent, isSimulationMode],
  );
}
