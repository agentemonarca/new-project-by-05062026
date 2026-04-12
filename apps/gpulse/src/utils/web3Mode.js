/**
 * `VITE_WEB3_MODE=mock` (default): mockProvider / panel dev · sin MetaMask obligatoria.
 * `VITE_WEB3_MODE=real`: `window.ethereum` + ethers BrowserProvider (requiere `VITE_CHAIN_ID`, contratos en `.env` para pagos).
 * Señales Baccarat (VistaLab) siguen por `useExternalSignals` — independiente de esto.
 */
export function isWeb3MockMode() {
  const v = String(import.meta.env?.VITE_WEB3_MODE ?? 'mock').trim().toLowerCase();
  return v !== 'real';
}
