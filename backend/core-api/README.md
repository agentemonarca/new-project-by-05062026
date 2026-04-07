# Core API (@ai-genesis/core-api)

Servidor Express (HTTP + Socket.IO) para Genesis / GPulse.

## Desarrollo

Desde este directorio:

```bash
npm install
npm run dev
```

Por defecto escucha en el puerto **5050** (`PORT`, variable de entorno).

Al arrancar correctamente verás en consola:

- `Core API running on port: <PORT>`
- `PID: <process.pid>`

Si el puerto **ya está en uso**, el proceso **no** llegará a escuchar: se mostrará un aviso y terminará con código de salida `1`, para no acumular instancias en el mismo puerto.

## Puerto ocupado (desarrollo)

**Ver qué proceso usa el 5050:**

```bash
lsof -i :5050
```

**Liberar el 5050** (macOS / Linux; mata procesos que listen en ese puerto):

```bash
npm run dev:clean
```

Equivalente manual:

```bash
lsof -ti :5050 | xargs kill -9
```

Si usas otro puerto (`PORT=5051 npm run dev`), sustituye `5050` en los comandos anteriores.

## Producción

```bash
npm start
```

Requiere builds previos (`prestart` ejecuta `build:db` y `build:compensation`).

## Variables de entorno

Copia y ajusta según tu entorno (por ejemplo `ADMIN_EMAIL` / `ADMIN_PASSWORD` para login admin, `MONGO_URI`, `SESSION_SECRET`, etc.). No subas `.env` al control de versiones.

### MongoDB y admin-signals

Para que **`mongoReady: true`** en analytics / alertas / métricas diarias y que se persistan datos reales:

1. Define en `.env` una cadena válida (Atlas, local, etc.):

   ```env
   MONGO_URI=mongodb+srv://user:pass@cluster/dbname?...
   ```

   También se admite la variable heredada **`LINUXDB`** como alternativa a `MONGO_URI`.

2. Tras `npm run dev`, si la conexión funciona verás algo como:

   `Mongo connected — admin-signals mongoReady: true`

   y:

   `Admin signals: mongoReady=true — persisting signal_events, signal_metrics, signal_metrics_daily`

3. Si falta URI o la conexión falla, verás **`Mongo not connected`** en consola; el API sigue arrancando, pero las rutas admin-signals devolverán `mongoReady: false` hasta que Mongo esté disponible.

4. Colecciones usadas por admin-signals (nombres en Mongo): **`signal_events`**, **`signal_metrics`**, **`signal_metrics_daily`**, además de config en **`signal_config`** (según modelos en `src/admin-signals/db/signalMongoModels.js`).

5. **Tras el arranque** (~800 ms, configurable con `MONGO_STARTUP_VERIFY_DELAY_MS`) el proceso ejecuta:
   - **`runMongoStartupVerify`**: ping, listado de colecciones, conteos de `genesis_users`, `p2p_orders`, `signal_events`, `signal_metrics`, `signal_metrics_daily`.
   - Si `signal_events` está vacío y **`MONGO_SEED_ADMIN_SIGNALS=1`**, inserta 20 documentos de prueba y actualiza agregación diaria del día UTC anterior.

6. **Smoke HTTP** (`runAdminSignalsHttpSmoke`): si defines **`GENESIS_ADMIN_API_KEY`** (mismo valor que en el core para `X-Admin-Api-Key`), se llaman `stats`, `analytics`, `alerts-daily`, `metrics-daily` contra `127.0.0.1:PORT` y se imprimen códigos HTTP y `mongoReady` **sin mostrar la clave**.

**Seguridad:** nunca incluyas contraseñas de Mongo en logs; en la URI usa password **URL-encoded**. No subas `.env` al repositorio.
