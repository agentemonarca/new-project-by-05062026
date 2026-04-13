# REMAINING MOCK DEPENDENCIES (G-Pulse `apps/gpulse`)

Auditoría orientativa: rutas que **no** usan el relay / `extHistory` como única fuente. Actualizar cuando se migre cada módulo.

## `sessionStats` / motor local (App shell)

- `App.jsx`: **IA Real (proveedor)** — `sessionStatsForUi.wins|losses|total|distribution` provienen de `buildStatsFromHistory(extHistory)` (única fuente relay). `sessionStats` + `setSessionStats` quedan para **simulación** (loop local) y `sessionRewardsNet` / resets donde aplique.
- Cualquier hijo que reciba `sessionStats` debe recibir **`sessionStatsForUi`** en rutas IA Real (revisar props en panel de sesión / reportes).

## Web3 / wallet demo

- `App.jsx`: `MOCK_TX_STATUS`, `DEMO_WALLET_ADDRESS_*`, flujos Trust — emulación de transacciones incluso con datos de proveedor reales para señales.
- `utils/mockWeb3.js`, `components/MockWeb3DevPanel.jsx`, `main.jsx` — panel y estado Web3 mock cuando `isWeb3MockMode()`.

## Genesis / marketplace / mining (fuera del pipeline IA Real)

- `GenesisP2PMarketplacePage.jsx` — `MOCK_ORDERS`.
- `useMiningCores.js` — `MOCK_MINING_CORES`.
- `GenesisSupportPage.jsx` — `simulateAgentReply` (soporte demo).

## Motor / simulación local (no proveedor)

- `domain/engine/simulator.js` — `simulate()` para tests y dev.
- `ui-genesis/simulation/*`, `simulationModeStore.js` — datasets y ledger simulados del dashboard Genesis.

## Hardcoded / placeholders a vigilar

- `App.jsx`: balances iniciales `wallets`, `demoBalance`, narrativa Gemini con `apiKey` vacío en snippet de intuición de mesa.
- `iaRealNarrativeLine` / voz: copy genérico si no hay filas del proveedor.

## Funciones no ligadas al proveedor

- `executeSequence` / `generatePattern` — ruta **simulación**; IA Real debe usar `useExternalSignals` + store (ya cableado en `useExternalSignals` + efectos `NEW_SIGNAL` / `NEW_RESULT`).

---

**Activar trazas de migración:** `VITE_IA_REAL_PIPE_CHECK=1` (PIPE CHECK + `console.table` de salud en consola).
