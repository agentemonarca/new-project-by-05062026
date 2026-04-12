# Alineación canónica — verificación y activación

No cambia el comportamiento por defecto: todos los flags son **opt-in** (`=1`). Sin flags o con `0`, el bundle se comporta como antes de esta capa.

## Fase 0 — Comprobación en código (ya cableado)

| Pieza | Dónde se usa |
|--------|----------------|
| `extractCanonicalFields` | `extractCanonicalFields.js` (definición); `logCanonicalAudit`; `applyCanonicalModeToPayload`; `correlationKeyFromResolvedContext` (modo canónico); `signalFormatter.js` (direction vector) |
| `applyCanonicalModeToPayload` | `adminSignalsLiveStore.js` (tras `extractLiveRowFromSocketMsg`); `adminSignalsLiveIngest.js` (antes de `formatSignal` / `formatResult`); `buildSignalDisplayLayer` / `buildResultDisplayLayer` |
| `correlationKeyFromResolvedContext` | `signalFormatter.js` (señales y resultados formateados) |
| `resultMatchesSignal` (rama V2) | `vistaLabCycle.js` cuando `VITE_MATCH_V2=1` |

### Flags (Vite)

| Variable | Efecto |
|----------|--------|
| `VITE_CANONICAL_MODE=1` | Merge canónico en store/ingest/format; CK desde `mesa\|round` cuando aplica; marca `_incomplete` en ingest si falta round/dirección (señal) o round/result (resultado) |
| `VITE_MATCH_V2=1` | Match estricto: mismo `correlationKey`, o misma `mesa`+`round`, o `id`↔`signalId` |
| `VITE_ROUND_TARGET_MODE=1` | En `extractCanonicalFields`, `round` prioriza `ronda_objetivo` (+ warning `using ronda_objetivo`) |
| `VITE_DIRECTION_FROM_VECTOR=1` | Fuerza `recommendation` desde `vector_forecast[0]` vía extracto canónico |
| `VITE_SIGNAL_AUDIT=1` | Logs `[CANONICAL_MAP]`, `[SOURCE_PATHS]`, `[DIAGNOSTICS]`, `[PROVIDER_SOURCE]` donde se llama `logCanonicalAudit` |
| `VITE_MATCH_DEBUG=1` | En rama V2, si **no** hay match: `[MATCH_DEBUG] no_match` con resumen `sig` / `res` |
| `VITE_GPULSE_LAB_INGEST_FROM_VISTALAB_BUFFER=1` | GPulse Lab: el middleware (`handleSignal` / `handleResult`) se dispara solo desde el buffer VistaLab (`subscribeAdminSignalsLive` + `lastNewSignalSocketPayload` / `lastNewResultSocketPayload`), no desde el relay paralelo. VistaLab + socket ingest siguen igual. |
| `VITE_ADMIN_SIGNALS_INGEST_LOG=1` | Consola: `[admin-signals ingest] SIGNAL|RESULT <source> ok|reject:<razón>` tras cada evento socket (no cambia la lógica). |

### GPulse Lab — relay vs buffer VistaLab (`VITE_GPULSE_LAB_INGEST_FROM_VISTALAB_BUFFER`)

| Valor | `registerGpulseLabRelayHandlers` | Fuente del wire para GPulse middleware |
|--------|-----------------------------------|----------------------------------------|
| ausente / `0` | Registrado desde `useLabSocket`: cada `NEW_SIGNAL` / `NEW_RESULT` va al relay y al pipeline GPulse **en paralelo** al ingest VistaLab. | Mismo evento socket que VistaLab (doble normalización posible). |
| `1` | **No** se registran handlers GPulse; solo telemetría / bridge ingest. | `lastNew*SocketPayload` del live store tras bump de `recvId` en cabeza de buffer (mismo wire que aceptó ingest). |

### Comportamiento con flags en `0` / ausentes

- `applyCanonicalModeToPayload` devuelve el **mismo** objeto de entrada (sin merge) si `VITE_CANONICAL_MODE` no es `1`.
- `correlationKeyFromResolvedContext` no entra en la rama canónica.
- `resultMatchesSignal` usa la lógica **histórica** (permisiva / incompletos).
- `extractCanonicalFields` sigue ejecutándose donde se llame para lectura, pero no altera filas salvo que otra capa use su salida con modo canónico activo.

---

## Fase 1 — Validar modo canónico

1. En `.env.local` (o env del proceso que lanza Vite):

```env
VITE_CANONICAL_MODE=1
VITE_SIGNAL_AUDIT=1
```

2. Arrancar admin-core y conectar el socket.

3. **Esperado en consola (una vez por sesión al primer evento):** `[PHASE_ACTIVE]`, `[CANONICAL_STATUS]`.

4. Con señales reales: trazas `[phase1]` / `ingest:*` / `formatSignal` desde `logCanonicalAudit` si `VITE_SIGNAL_AUDIT=1`.

5. Validar en logs `[CANONICAL_MAP]`: `mesa`, `round`, `correlationKey` coherentes cuando el proveedor los trae en rutas anidadas documentadas en `extractCanonicalFields.js`.

**Si algo falta:** revisar `[SOURCE_PATHS]` y `[DIAGNOSTICS]` del mismo bloque; el campo puede existir en otra ruta no contemplada en el extracto canónico (capa: **ingest/format**).

---

## Fase 2 — Dirección desde vector

```env
VITE_DIRECTION_FROM_VECTOR=1
```

Opcionalmente también `VITE_CANONICAL_MODE=1` para que el payload ya traiga `vector_forecast` fusionado.

Validar: `recommendation` deja de ser `UNKNOWN` cuando `vector_forecast[0]` existe en `data.data.signal`, `data.signal` o raíz (ver `resolveSignalFromProvider` + extracto canónico).

**Si `direction` es null en audit:** comprobar en el JSON crudo si `vector_forecast` está vacío o en otra ruta.

---

## Fase 3 — Match V2

```env
VITE_MATCH_V2=1
VITE_MATCH_DEBUG=1
```

- Sin match: consola muestra `[MATCH_DEBUG] no_match` con `mesa`, `round`, `correlationKey`, `id` / `signalId`.
- Con match: la función devuelve `true` sin log de fallo (no se añadió log de éxito para no inundar).

Capa: **matcher** (`vistaLabCycle.js`).

---

## Fase 4 — Round objetivo

```env
VITE_ROUND_TARGET_MODE=1
```

Validar en `[DIAGNOSTICS].warnings` la cadena relacionada con `ronda_objetivo` cuando aplica.

Comparar `signal.round` vs `result.round` en las filas ya formateadas (misma mesa); si difieren, revisar `sourcePaths.round` en audit y el payload del proveedor.

---

## Fase 5 — Incompletos

Con `VITE_CANONICAL_MODE=1`, el ingest puede poner `payload._incomplete` antes de validar; las filas formateadas copian `_incomplete` cuando corresponde.

No se rechazan eventos por eso: la validación estricta sigue gobernada por `ADMIN_SIGNALS_STRICT_MODE` y los validadores existentes.

---

## [CANONICAL_STATUS] (consola)

Se emite junto a `[PHASE_ACTIVE]` la **primera vez** que se llama `logPhaseActiveOnce()` (primer `NEW_SIGNAL` / `NEW_RESULT` tras cargar el bridge).

Los campos `*Working` / `roundAligned` / `incompleteHandled` reflejan **si el flag correspondiente está activo**, no un test automático de calidad de datos en runtime.

---

## Detección rápida de capas

| Síntoma | Revisar |
|---------|---------|
| CK distinto entre señal y resultado | `correlationKeyFromResolvedContext` + modo canónico; CK en relay (backend) |
| Dirección UNKNOWN con vector presente | `VITE_DIRECTION_FROM_VECTOR`, payload anidado |
| Sin match en VistaLab con V2 | `VITE_MATCH_DEBUG`, comparar `sig` vs `res` en el log |
| Round distinto señal/resultado | `VITE_ROUND_TARGET_MODE`, `ronda_objetivo` vs `ronda_actual` en proveedor |

---

## Diagnóstico: faltan resultados o la data no cuadra en el lab

Orden sugerido (misma lógica que el plan de diagnóstico del proyecto):

1. **VistaLab** (listas en vivo): si aquí **no** hay filas de resultado, el problema está **antes** del panel central (proveedor, relay en core-api, o el socket no entrega `NEW_RESULT`). Si VistaLab **sí** tiene resultados y GPulse no, acotar a pipeline GPulse / flag de buffer / normalización.
2. **Navegador → Network → WebSocket** (namespace `/admin-signals`): ¿existen mensajes con nombre `NEW_RESULT`?
3. **core-api (Node):** `ADMIN_SIGNALS_TRACE=1` y revisar logs `relay_new_result_prevalidate_skip`, `relay_skip_emit_deduped`, `CRITICAL_MISMATCH`, `relay_client_emit_skipped`.
4. **Consola admin-core:** búsqueda de `REJECT_RESULT` (ingest rechazó la fila) o activar `VITE_ADMIN_SIGNALS_INGEST_LOG=1` para una línea por evento (`ingest:RESULT ok|reject:…`).
5. **Prueba de hipótesis (solo diagnóstico):** `VITE_ADMIN_SIGNALS_STRICT=0` desactiva el modo estricto del validador ([`adminSignalPayloadValidators.js`](src/utils/adminSignalPayloadValidators.js)); si entonces aparecen resultados, el proveedor envía datos **incompletos** respecto a [`validateResult`](src/utils/adminSignalPayloadValidators.js).
6. **GPulse con** `VITE_GPULSE_LAB_INGEST_FROM_VISTALAB_BUFFER=1`: el hook del buffer solo avanza con nueva cabeza en `results[]` (`recvId`). Un `NEW_RESULT` que VistaLab **rechaza** no añade fila: el centro GPulse puede no moverse aunque exista `lastNewResultSocketPayload` (comportamiento alineado con “solo lo validado por VistaLab”).

### Tarjeta «Diagnóstico · stream resultados» (GPulse Lab → ValidationPanel)

En el dock inferior de GPulse Lab, la tarjeta usa [`useGpulseLabStreamDiagnosticsStore.js`](src/gpulse-lab/store/useGpulseLabStreamDiagnosticsStore.js) y resume el flujo **sin depender solo de la consola**:

| Campo | Qué indica |
|--------|------------|
| **Ingress** | `relay` (handlers socket en paralelo al buffer) vs `vistaLabBuffer` (`VITE_GPULSE_LAB_INGEST_FROM_VISTALAB_BUFFER=1`). Se actualiza al montar el lab y al abrir el panel (`refreshIngressMode`). |
| **Validación UI** | Si el módulo de validación está activo (`validationUiEnabled` en Zustand, ligado a `setValidationEnabled`). Si está **off**, no hay filas `stream · NEW_SIGNAL` / `stream · NEW_RESULT` en el log de validación. |
| **Último RESULT crudo** | Timestamp del último frame RESULT guardado en la UI (`gpulseLabRawSocketFrames.resultTs`). |
| **Última CK stream · señal / resultado** | Correlation keys vistas por `recordStreamSignal` / asentamiento en `recordStreamResult` (puede diferir del payload si hubo match por mesa). |
| **Relay · código / Middleware** | Último intento de pipeline: `reason` del relay (p. ej. `duplicate_socket_frame`, `normalize_or_canonical_null`) y, si aplica, código del middleware (`duplicate_mesa_round`, `duplicate_ck_*`, etc.). |
| **Pipeline NEW_RESULT** | Línea compacta: aplicado (con `streamSettledCk`, si el log stream es esperable) u omitido con JSON de detalle. |
| **Copiar JSON** | Exporta snapshot (ingress, validación, CKs, `lastResultPipeline`) al portapapeles para pegar en un ticket. |

**Log avanzado** en el mismo panel lista entradas recientes del store de validación (`stream · NEW_SIGNAL`, `stream · NEW_RESULT`, timeouts, etc.).

Tests del store de diagnóstico: [`useGpulseLabStreamDiagnosticsStore.test.js`](src/gpulse-lab/store/useGpulseLabStreamDiagnosticsStore.test.js).

---

## Relay — ingesta única (VistaLab + GPulse Lab)

Un solo par de listeners `NEW_SIGNAL` / `NEW_RESULT` en el socket `/admin-signals` ([`adminSignalsLiveStore.js`](src/realtime/adminSignalsLiveStore.js)): primero buffer VistaLab (`ingestNew*FromWire`), luego callbacks opcionales del GPulse Lab (`registerGpulseLabRelayHandlers`). No hay segundo `socket.on` duplicado en [`useLabSocket.js`](src/gpulse-lab/hooks/useLabSocket.js).

### Origen IO compartido

[`resolveAdminSignalsIoOrigin.js`](src/services/resolveAdminSignalsIoOrigin.js) — mismo host para el `Manager` de Socket.IO ([`socket-admin.js`](src/services/socket-admin.js)) y referencias alineadas en el lab. Prioridad: `VITE_GPULSE_LAB_IO_ORIGIN` → `VITE_ADMIN_SIGNALS_IO_ORIGIN` → `window.location.origin` → `http://localhost:5050`.

`GET /api/admin/signals/current-state` sigue usando `window.location.origin` en el navegador (proxy Vite / cookies de sesión).
