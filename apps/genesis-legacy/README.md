# Génesis Legacy (slot)

This directory is reserved for the **cloned legacy Génesis application**.

## Rules

- Do **not** modify application logic from the monorepo scaffold — treat this tree as an external artifact.
- Run the legacy dev server on **`http://localhost:3000`** so the Backoffice iframe (`/genesis`) resolves correctly (override with `VITE_GENESIS_URL`).

## Integration

The Backoffice loads legacy UI via an **iframe** only (`apps/backoffice` → `GenesisWrapper`). No code merge; shared session uses `packages/bridge` storage keys (`ai-genesis.auth.*`).
