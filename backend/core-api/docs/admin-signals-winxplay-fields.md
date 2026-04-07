# Winxplay / proveedor externo — campos de señales y resultados

## Fuentes de verdad en el código

| Ruta | Rol |
|------|-----|
| `src/admin-signals/upstreamBridge.js` | Escucha `dashboardUpdate`, `NEW_SIGNAL`, `NEW_RESULT` del socket proveedor (`external-signals`). |
| `src/services/winxplay-adapter.js` | Ruta rápida cuando `dashboardUpdate` trae envelope `{ type, data?, ... }` estilo Winx. |
| `src/admin-signals/signalDashboardTransform.js` | Expansión genérica de `dashboardUpdate` (anidación, arrays, alias). |
| `src/admin-signals/signalNormalize.js` | Normalización previa al processor y al emit hacia admin UI. |
| `src/admin-signals/buildAdminSignalsClientPayload.js` | Payload que sale por Socket.IO `/admin-signals`. |

**Importante:** Los listados de *nombres de campo* inferidos del código son el **contrato implementado**, no un PDF del proveedor. Para anclarlo a producción, activa una muestra real:

```bash
ADMIN_SIGNALS_LOG_RAW_PROVIDER_SAMPLE=1
```

En logs verás **una sola vez por tipo** (por proceso):

`📦 RAW PROVIDER SAMPLE:` + JSON con `{ _event, payload }`.

---

## Objeto de referencia: `providerFields` (código actual)

```js
{
  providerFields: {
    envelope: {
      // tryWinxplayDashboardRelay — espera objeto no-array en raíz
      type: 'p.type | data.type → NEW_SIGNAL | NEW_RESULT',
      id: 'p.id (señales Winx)',
      mesa: 'p.mesa (fallback raíz)',
      data: {
        mesa: 'd.mesa',
        forecast: 'd.forecast → recommendation en adapter',
        martingale: 'd.martingale',
        round: 'd.round',
        result: 'd.result → ganador en NEW_RESULT',
        winStatus: 'd.winStatus',
        history: 'd.history[] → historial',
      },
    },
    signal: {
      // Campos que el código sabe leer (normalize + expand + coerce)
      mesa: 'mesa | table | desk | tableName | tableId | mesaName | room',
      recommendation: 'recommendation | forecast | signal | side | prediction | bet | pick',
      martingale: 'martingale | martinGale',
      round: 'round | gameRound | gameId | shoe | hand | roundId',
      id: 'id | signalId | betId | externalId | uid',
      timestamp: 'no unificado en normalize; serverTs lo añade core-api al emit cliente',
    },
    result: {
      mesa: 'mesa | table | desk | tableName | tableId | mesaName',
      ganador: 'ganador | resultado | result (winx-adapter usa d.result como ganador)',
      winStatus: 'winStatus | win | won | correct | hit | success | profit | derivado de result/outcome',
      round: 'round | gameRound | gameId | shoe | hand',
      historial: 'historial | history (arrays)',
      correlación: 'signalId | id | betId | externalId',
    },
    dashboardContainer: {
      // expandDashboardUpdate — raíz o anidación
      signals: 'array bajo p.signals',
      items: 'p.items[]',
      updates: 'p.updates[]',
      rows: 'p.rows[]',
      tables: 'p.tables[]',
      data: 'p.data[] o array raíz',
    },
    nesting: {
      // flattenNestedDashboardPayload — hijos mezclados al padre
      keys: ['payload', 'body', 'content', 'data', 'dashboard', 'snapshot', 'signal', 'update', 'meta', 'detail', 'attributes', 'nested', 'value', 'message'],
    },
  },
}
```

---

## Alias explícitos (proveedor → interno)

| Uso | Alias aceptados (orden no exhaustivo) |
|-----|----------------------------------------|
| Mesa | `table`, `desk`, `tableName`, `tableId`, `mesaName`, `room` → **`mesa`** |
| Recomendación | `forecast`, `signal`, `side`, `prediction`, `bet`, `pick` → **`recommendation`** (normalize: PLAYER/BANKER/UNKNOWN) |
| Ronda | `gameRound`, `gameId`, `shoe`, `hand`, `roundId` → **`round`** |
| ID señal | `signalId`, `betId`, `externalId`, `uid` → **`id` / `signalId`** |
| Ganador / resultado | `result`, `resultado` → **`ganador`** en adapter; también booleans/strings en `normalizeNewResultPayload` |
| Historial beads | `history` → **`historial`** en cliente/UI |

---

## Estructura estándar interna (post-normalización)

Tras `normalizeNewSignalPayload` / `normalizeNewResultPayload` y antes del processor:

**Señal (conceptual)**

```js
{
  mesa: string,
  recommendation: 'PLAYER' | 'BANKER' | 'UNKNOWN',
  martingale: number,
  round: string,
  correlationKey: string,
  providerSignalId: string | null,
  raw: object, // referencia al objeto crudo en processor
}
```

**Resultado (conceptual)**

```js
{
  mesa: string,
  winStatus: boolean,
  round: string,
  correlationKey: string,
  providerSignalId: string | null,
  raw: object,
}
```

**Emit a panel** (`buildAdminSignalsClientPayload` + `serverTs`): incluye `recommendation`, `mesa`, `round`, `martingale`, `correlationKey`, y en resultados `ganador`, `historial`, `winStatus`.

---

## Qué usa el panel (admin-core, sin UI aquí)

- Entrada Socket: eventos `NEW_SIGNAL` / `NEW_RESULT` en namespace `/admin-signals`.
- `apps/admin-core/src/utils/signalFormatter.js`: `formatSignal` / `formatResult` esperan los campos del emit anterior (`recommendation`, `mesa`, `martingale`, `round`, `ganador`, `historial`, `winStatus`, etc.).

---

## Flujo resumido

1. Proveedor → `upstreamBridge` (`dashboardUpdate` y/o eventos nominales).
2. Si `tryWinxplayDashboardRelay` matchea → un solo `emitSafe` con `data` ya reducida.
3. Si no → `expandDashboardUpdate` → N raws señal / resultado → `emitSafe` por cada uno.
4. `relayAdminSignalsToClients` → `ingest*` (processor + Mongo hooks) → emit cliente normalizado.

---

## Validación “sin suposiciones” del proveedor

1. Poner `ADMIN_SIGNALS_LOG_RAW_PROVIDER_SAMPLE=1` y reiniciar core-api con relay activo.
2. Capturar las tres líneas `📦 RAW PROVIDER SAMPLE:` si el proveedor emite los tres tipos.
3. Actualizar este doc con nombres **exactos** del JSON pegado (diff vs tablas anteriores).

Hasta ese paso, este archivo documenta **lo que el core-api ya implementa** para absorber variantes conocidas.
