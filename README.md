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

## 🚀 Desarrollo rápido

Un solo comando para **Core API**, **G-Pulse** y el **Admin Core** (backoffice opcional, Vite en `5190`):

```bash
npm install
npm run dev:all
```

Solo API + G-Pulse (sin Admin Core):

```bash
npm run dev:main
```

Limpieza de puertos y arranque completo (`dev:all` tras liberar listeners):

```bash
npm run dev:start
```

Sin confirmación interactiva (CI o scripts; mata listeners en 5050 / 5174 / 5190 automáticamente):

```bash
npm run dev:start -- --force
# equivalente: npm run dev:start:force
# equivalente: DEV_START_FORCE=1 npm run dev:start
```

Los logs van prefijados (`CORE`, `GPULSE`, `BACKOFFICE`, `READY`). El proceso `READY` espera a que respondan `/health` (5050) y los frontends; al terminar verás mensajes del estilo `✔ Core API running on 5050` y `✔ GPulse running on 5174`.

Requisitos: instala dependencias de cada app con `pnpm install` en la raíz (workspaces) antes del primer arranque; los scripts de servicio usan `npm run dev` dentro de cada carpeta.

## Local development

Run services in separate terminals (ports are defaults):

1. **Core API** — `npm run dev:core-api` → `http://127.0.0.1:5050`
2. **G-Pulse API** (optional forwarder) — `pnpm dev:gpulse-api` → `5052`
3. **API Gateway** (optional) — `pnpm dev:api-gateway` → `4000`  
   - Leave `JWT_SECRET` unset for open `/api/*` during dev.
4. **G-Pulse UI** — `npm run dev:gpulse` → `http://localhost:5174`
5. **Hub shell (backoffice principal)** — `npm run dev:hub` → `http://localhost:5180`
6. **Admin Core** (opcional) — `npm run dev:backoffice` o `npm run dev:admin-core` → `http://localhost:5190`

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
- **GPulse + core-api (local):** copia `backend/core-api/.env.example` → `backend/core-api/.env` y `apps/gpulse/.env.example` → `apps/gpulse/.env`. En dev, Vite (`5174`) proxifica `/api`, `/auth` y `/socket.io` a `127.0.0.1:5050`. Define `SOCKET_CORS_ORIGIN=*` en core-api para Socket.IO desde el navegador en local; `GPULSE_DEMO_MODE=0` y `GPULSE_DEMO_FALLBACK_MS=0` para solo señales reales; `EXTERNAL_SIGNALS_API_KEY` / `EXTERNAL_SIGNALS_WS` en el servidor (nunca en `VITE_*`). Tras arrancar `npm run dev:main`, comprueba: `npm run verify:gpulse-alignment`.
- **Producción (paridad):** mismo commit/tag en front estático y core-api. `SOCKET_CORS_ORIGIN` y `SIWE_ALLOWED_ORIGINS` con orígenes HTTPS exactos del front (no `*`). `SESSION_COOKIE_SECURE=1` detrás de TLS. Build del front con `VITE_API_URL` apuntando al API público si el static no comparte origen con core-api. Smoke: `/health` del API y carga del bundle + socket admin-signals en el dominio real.

### Checklist paridad env: local vs producción

| Variable / tema | Local (dev) | Producción |
|-----------------|-------------|------------|
| `MONGO_URI` (y conexiones nombradas si aplica) | Atlas o local accesible desde tu IP | Misma lógica de red; no mezclar DB de staging con prod |
| `EXTERNAL_SIGNALS_API_KEY` / `EXTERNAL_SIGNALS_WS` | Clave y URL reales del proveedor | Iguales salvo entorno de proveedor explícito |
| `GENESIS_ADMIN_API_KEY` y `VITE_GENESIS_ADMIN_API_KEY` | Mismo valor (clave solo servidor + header en Vite) | Mismo; rotar de forma coordinada |
| `SOCKET_CORS_ORIGIN` | `*` aceptable con Vite | Lista explícita de orígenes `https://…` (nunca `*`) |
| `GPULSE_DEMO_MODE` / `GPULSE_DEMO_FALLBACK_MS` | `0` / `0` para solo relay real | `0` / `0` |
| `VITE_API_URL` | Vacío si usas proxy Vite a `5050` | URL pública del API si el static y el API no comparten host |
| SIWE (`SIWE_DOMAIN`, `SIWE_ALLOWED_ORIGINS`, `SESSION_COOKIE_SECURE`) | `localhost:5174` en ejemplos | Host público y orígenes exactos; cookies secure con HTTPS |

### Smoke despliegue y staging

Tras un deploy, en el **mismo** tag/commit en front y `core-api`:

1. `GET` del health del API (`/health` en core-api).
2. Carga del shell GPulse (HTTP 200 en la URL del front).
3. Opcional CLI desde tu máquina contra staging/prod (sin secretos en logs):

   `VERIFY_CORE_URL=https://tu-api.example.com/health VERIFY_GPULSE_URL=https://tu-front.example.com/ npm run verify:gpulse-alignment`

4. Socket admin-signals en navegador con la misma `X-Admin-Api-Key` que en servidor.

### Validación operativa (manual, sesión real)

Con Winxplay (o proveedor) activo:

1. Abre el panel admin de señales y el shell **IA Real** en paralelo (dos pestañas o dos pantallas).
2. Para **una misma mano**, comprueba que mesa/ronda, `correlationKey` (si aplica) y paso de martingala coinciden entre log admin, panel lateral y teatro central.
3. Si algo no cuadra: activa solo las trazas necesarias (`WINXPLAY_DEBUG_STREAM`, `ADMIN_SIGNALS_DEBUG_FLOW`, `VITE_CYCLE_DEBUG`) y correlaciona timestamp + payload; revisa la consola en dev por `[IA_REAL alignment]` si `augmentSourceRow` y `activeRow` divergen en fases de resultado.

Unit tests de correlación y martingala se ejecutan en CI (workflow `gpulse-vitest.yml`) sobre los ficheros críticos del front.

## Build

```bash
pnpm build:backoffice
pnpm build:gpulse
```

---

**G-Pulse** and **core-api** behavior is preserved; integration is via workspace packages, iframe wrappers, and shared storage keys — not duplicated business logic.
