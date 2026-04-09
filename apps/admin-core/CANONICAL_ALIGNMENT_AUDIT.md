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
