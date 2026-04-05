# Runtime diagnostics and mock Web3 isolation

## Phase 1 — Mock mode isolation

- **`src/utils/mockInjectedIsolation.js`** — `installMockInjectedProviderIsolation()` proxies Tron globals (`tronLink`, `tronWeb`, `tron`) so the app does not read extension-injected objects in mock mode. `window.ethereum` is hidden (getter/setter to `undefined`) unless **`VITE_MOCK_ALLOW_INJECTED_ETHEREUM=1`**.
- **Opt out:** `VITE_DISABLE_MOCK_INJECTED_ISOLATION=1` disables the whole installer. **`VITE_DISABLE_TRON_SHIELD=1`** disables only the Tron keys (legacy).
- **Guards:** `connectWallet.js`, `hooks/useWallet.js`, `ui-genesis/api/depositFlow.js`, and **`App.jsx`** (native balance effect, `accountsChanged`, `handleConnectWallet`, `realDeposit`, wallet connect UI branch) avoid touching injected providers when `isWeb3MockMode()` is true.

**Console noise:** Messages such as “Provider initialised”, “TronLink initiated”, or `tronlinkParams` **null** reads often originate from the **TronLink browser extension** (`injected.js`), not from this repo. Isolation reduces **application** access to those globals; it cannot fully silence extension scripts.

## Phase 2 — Intermittence tracing

1. Enable in dev: set **`VITE_DEBUG_RUNTIME_TRACE=1`** in `.env` and restart Vite.
2. Instrumented components: **`GenesisDashboardPage`**, **`MainDashboardView`**, **`CoreProvider`** (`CoreContext.jsx`). Structured logs use the `[gpulse:trace]` prefix; watchers use `[gpulse:watch]`.
3. Helpers in **`src/utils/runtimeDiagnostics.js`**: `useRuntimeTrace`, `watchUndefinedTransitions`, `watchNaNValues`, `watchArrayShapeTransitions`, `watchFunctionTransitions`.

**Not found in this tree (no files to instrument):** `WalletPage`, `EngagementPipeline`, `AISignalPanel` — use grep or rename if they are added later.

## Simulating re-renders

With tracing on, trigger navigation, session toggles, and React Strict Mode (double mount in dev). Review `[gpulse:watch]` lines for unstable props/state.

**Static assessment (no production runtime proof):** No intermittent bug was reproduced in this pass. Tracing is the mechanism to catch valid → invalid transitions during manual or automated sessions. If a warning names `Component.field`, fix at the source of that prop/state (data loading race, optional API shape, or callback cleared before unmount).
