/**
 * Auditoría runtime: datos reales vs mock oculto.
 * Activar: `VITE_GPULSE_REALITY_AUDIT=1` en `.env` (apps/gpulse).
 */
import { getApiBaseUrl } from '../ui-genesis/api/genesisConfig.js';
import {
  getExternalSignalsSocketUrl,
  isExternalSignalsBffEnabled,
  isExternalSignalsEnabled,
} from '../ui-genesis/lib/externalSignalsConfig.js';

export function isGpulseRealityAuditEnabled() {
  return String(import.meta.env?.VITE_GPULSE_REALITY_AUDIT ?? '').trim() === '1';
}

/** Fase 1: tabla ENV + advertencias (no asume producción = real sin comprobar relay). */
export function logGpulseRealityAuditEnvPhase1() {
  const GPULSE_REAL_PROVIDER_EXECUTION = import.meta.env.VITE_GPULSE_REAL_PROVIDER_EXECUTION;
  const WEB3_MODE = import.meta.env.VITE_WEB3_MODE;
  const EXTERNAL_SIGNALS_URL = import.meta.env.VITE_EXTERNAL_SIGNALS_URL;
  const base =
    typeof window !== 'undefined'
      ? String(getApiBaseUrl() || window.location.origin || '').replace(/\/$/, '')
      : '';
  const ADMIN_SIGNALS_URL = base ? `${base}/admin-signals` : '(sin window: SSR)';

  console.table({
    GPULSE_REAL_PROVIDER_EXECUTION,
    WEB3_MODE,
    EXTERNAL_SIGNALS_URL,
    ADMIN_SIGNALS_URL,
  });

  const provOk = String(GPULSE_REAL_PROVIDER_EXECUTION ?? '1').trim() === '1';
  if (!provOk) {
    console.warn(
      '[REALITY-AUDIT Fase1] ✖ VITE_GPULSE_REAL_PROVIDER_EXECUTION ≠ 1 → puede activarse motor local / simulación (App.jsx: GPULSE_REAL_PROVIDER_EXECUTION).',
    );
  } else {
    console.info(
      '[REALITY-AUDIT Fase1] ✔ Provider execution = 1 (IA Real espera NEW_SIGNAL / NEW_RESULT del relay).',
    );
  }

  const web3 = String(WEB3_MODE ?? 'mock').trim().toLowerCase();
  if (web3 === 'mock') {
    console.warn(
      '[REALITY-AUDIT Fase1] ⚠ VITE_WEB3_MODE=mock → MetaMask/contratos en modo demo (`src/utils/web3Mode.js`). Las señales Baccarat siguen por socket aparte.',
    );
  } else {
    console.info('[REALITY-AUDIT Fase1] ✔ WEB3_MODE ≠ mock (finanzas on-chain según `.env`).');
  }

  const extU = String(EXTERNAL_SIGNALS_URL || '').trim();
  const bff = isExternalSignalsBffEnabled();
  if (!extU && bff) {
    console.info(
      '[REALITY-AUDIT Fase1] URLs: EXTERNAL_SIGNALS_URL vacío pero BFF activo → conexión típica a',
      ADMIN_SIGNALS_URL,
      '(namespace Socket.IO `/admin-signals`).',
    );
  } else if (extU && /^wss?:\/\//i.test(extU)) {
    console.info('[REALITY-AUDIT Fase1] ✔ EXTERNAL_SIGNALS_URL parece URL absoluta (modo directo).');
  } else if (extU) {
    console.warn('[REALITY-AUDIT Fase1] ⚠ EXTERNAL_SIGNALS_URL inusual:', extU);
  }

  if (!isExternalSignalsEnabled() && bff) {
    console.info(
      '[REALITY-AUDIT Fase1] Directo al proveedor desactivado (VITE_EXTERNAL_SIGNALS_ENABLED≠1); efectivo:',
      'BFF',
    );
  }

  console.info(
    '[REALITY-AUDIT Fase1] URL efectiva si conexión directa (referencia):',
    getExternalSignalsSocketUrl(),
  );
}

/** Fase 6–7: referencia estática (el bundle no puede `grep` en runtime). */
export function printGpulseRealityAuditPhase6And7Report() {
  console.info('[REALITY-AUDIT Fase6] Símbolos a vigilar (buscar en repo): Math.random, generatePattern, saveResult, setSessionStats');
  console.table([
    {
      ámbito: 'Señales / relay',
      estado: '✔ Real si socket conectado y llegan NEW_SIGNAL / NEW_RESULT o `signal_stream_frame` con resultado',
      depende: 'ENV + core-api + upstream',
    },
    {
      ámbito: 'IA Real proveedor',
      estado: '✔ Sin resultado simulado local cuando VITE_GPULSE_REAL_PROVIDER_EXECUTION=1',
      depende: 'Misma variable',
    },
    {
      ámbito: 'Simulación / Visor',
      estado: '⚠ Puede usar generatePattern / motor local',
      depende: 'Modo UI',
    },
    {
      ámbito: 'WEB3',
      estado: '⚠ mock por defecto (VITE_WEB3_MODE)',
      depende: 'ENV',
    },
    {
      ámbito: 'Economía IA Real',
      estado: '✔ handleProviderResultEconomic + logTransaction → ledger; saldo en wallets React (mock hasta Web3 real)',
      depende: 'stake > 0 y fase motor',
    },
  ]);
  console.info(
    '[REALITY-AUDIT Fase7] Mock conocidos no-bloqueantes: IDs con Math.random en `logTransaction` / `genId`; UI decorativa. Motor sim: `domain/engine` + modo Simular.',
  );
}
