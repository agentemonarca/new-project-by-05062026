# Ai Génesis — Backoffice 2.0 (monorepo)

Modular Web3 operating system: **Backoffice** shell, **Génesis** legacy (iframe), **G-Pulse** execution module (iframe), shared **bridge + state**, and a **gateway** edge.

## Layout

| Path | Role |
|------|------|
| `apps/backoffice` | Main hub UI (React, Vite, Tailwind, Framer Motion) |
| `apps/gpulse` | G-Pulse frontend (existing app; package name `@ai-genesis/gpulse`) |
| `apps/genesis-legacy` | Placeholder for cloned legacy app (do not modify from here) |
| `packages/ui` | Design system (GlassCard, NeonButton, Sidebar, Topbar, …) |
| `packages/state` | Zustand global store |
| `packages/bridge` | Auth + context bridge (`useExternalContext`) |
| `packages/config` | Design tokens + defaults |
| `packages/types` | Shared TypeScript types |
| `backend/core-api` | Existing Node API (`@ai-genesis/core-api`) |
| `backend/api-gateway` | Express proxy + pino + optional JWT |
| `backend/gpulse-api` | Forwarding boundary to core-api (split-ready) |

## Prerequisites

- Node **≥ 20**
- [pnpm](https://pnpm.io/) **9** (`corepack enable && corepack prepare pnpm@9.15.4 --activate`)

## Install

```bash
pnpm install
```

## Local development

Run services in separate terminals (ports are defaults):

1. **Core API** — `pnpm dev:core-api` → `http://127.0.0.1:5050`
2. **G-Pulse API** (optional forwarder) — `pnpm dev:gpulse-api` → `5052`
3. **API Gateway** (optional) — `pnpm dev:api-gateway` → `4000`  
   - Leave `JWT_SECRET` unset for open `/api/*` during dev.
4. **G-Pulse UI** — `pnpm dev:gpulse` → `http://localhost:5174`
5. **Backoffice** — `pnpm dev:backoffice` → `http://localhost:5180`

Legacy Génesis must be served separately at **`http://localhost:3000`** (or set `VITE_GENESIS_URL`).

### Auth sync

- Backoffice sends `postMessage({ type: 'AUTH_SYNC', token, user, source: 'ai-genesis-backoffice' })` to the G-Pulse iframe.
- G-Pulse persists canonical keys from `@ai-genesis/config` (`STORAGE_KEYS`) and emits `ai-genesis-auth-sync`.
- The bridge reads the same keys (plus legacy aliases) for the shell.

### G-Pulse handshake (Phase 2)

- Backoffice → iframe: `PING` after load, on auth change, and on window focus / visibility.
- G-Pulse → parent: `PONG` with `pingTs` for latency.
- If no `PONG` within **6s**, the store marks the engine offline (`gpulse.connected = false`).
- Top bar shows **Connected** (green) / **Syncing…** (yellow) / **Offline** (red) from Zustand.

## Environment

- `apps/backoffice/.env.example` — iframe targets and gateway URL.
- `backend/api-gateway/.env.example` — proxy targets and optional JWT.

## Build

```bash
pnpm build:backoffice
pnpm build:gpulse
```

---

**G-Pulse** and **core-api** behavior is preserved; integration is via workspace packages, iframe wrappers, and shared storage keys — not duplicated business logic.
