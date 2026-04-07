import { tryGetDbConnection } from './connectBridge.js';

const WATCH_COLLECTIONS = [
  'genesis_users',
  'p2p_orders',
  'signal_events',
  'signal_metrics',
  'signal_metrics_daily',
];

function logMongoHints(message) {
  const m = String(message || '');
  if (/ECONNREFUSED/i.test(m)) console.warn('  → ECONNREFUSED: puerto cerrado o servicio caído.');
  else if (/ETIMEDOUT|timed out|Timeout/i.test(m))
    console.warn('  → ETIMEDOUT: firewall o red; revisa acceso al puerto Mongo.');
  else if (/Authentication failed|bad auth|not authorized/i.test(m))
    console.warn('  → Autenticación: usuario/contraseña o authSource en la URI.');
  else if (/ENOTFOUND|getaddrinfo/i.test(m)) console.warn('  → ENOTFOUND: host incorrecto o DNS.');
}

/**
 * Ping, colecciones, conteos y seed opt-in. No registra credenciales.
 * Usa la conexión **genesis** únicamente.
 *
 * @param {{ warn?: Function, info?: Function }} logger
 */
export async function runMongoStartupVerify(logger) {
  console.log('\n── Mongo verify (admin-signals) ──');

  const conn = tryGetDbConnection('genesis');
  if (!conn || !conn.db) {
    console.log('Estado conexión: FAIL (genesis no conectado)');
    return;
  }

  try {
    await conn.db.admin().command({ ping: 1 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('Mongo not connected', msg);
    logMongoHints(msg);
    console.log('Estado conexión: FAIL (ping)');
    return;
  }

  console.log('Estado conexión: OK');
  const dbName = conn.name;
  console.log('DB usada:', dbName);

  const cols = await conn.db.listCollections().toArray();
  const nameSet = new Set(cols.map((c) => c.name));
  console.log('Colecciones encontradas (total):', cols.length);

  console.log('Conteo documentos (hasta 5 colecciones clave):');
  for (const name of WATCH_COLLECTIONS) {
    try {
      const n = nameSet.has(name) ? await conn.db.collection(name).countDocuments() : 0;
      console.log(`  ${name}: ${n}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ${name}: (error: ${msg})`);
    }
  }

  let seeded = false;
  let signalEventsCount = 0;
  try {
    signalEventsCount = nameSet.has('signal_events')
      ? await conn.db.collection('signal_events').countDocuments()
      : 0;
  } catch {
    signalEventsCount = 0;
  }

  const allowSeed = String(process.env.MONGO_SEED_ADMIN_SIGNALS || '').trim() === '1';

  if (signalEventsCount === 0 && allowSeed) {
    const n = await seedSmokeSignalEvents(logger, conn);
    seeded = n > 0;
    if (seeded) {
      console.log(`Seed: insertados ${n} documentos de prueba en signal_events`);
      try {
        const { utcYesterdayBounds, runSignalMetricsDailyForDay } = await import(
          '../admin-signals/signalMetricsDailyJob.js'
        );
        const b = utcYesterdayBounds();
        await runSignalMetricsDailyForDay({ ...b, logger });
        console.log('Seed: agregación diaria para', b.dayStr);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger?.warn?.('mongo_seed_daily_agg_skip', { message: msg });
      }
    }
  } else if (signalEventsCount === 0) {
    console.log('Seed: omitido (signal_events vacío). MONGO_SEED_ADMIN_SIGNALS=1 para insertar prueba.');
  } else {
    console.log('Seed: no requerido (signal_events ya tiene datos).');
  }

  console.log('Resumen Mongo verify:', { estado: 'OK', db: dbName, seedEjecutado: seeded });
}

/**
 * @param {{ warn?: Function }} logger
 * @returns {Promise<number>}
 */
async function seedSmokeSignalEvents(logger, conn) {
  const { getSignalModelsForConnection } = await import('../admin-signals/db/signalMongoModels.js');
  const { SignalEvent } = getSignalModelsForConnection(conn);
  if (!SignalEvent) return 0;
  try {
    await SignalEvent.createIndexes();
  } catch (e) {
    logger?.warn?.('signal_events_ensure_indexes', { message: e instanceof Error ? e.message : String(e) });
  }

  const base = Date.now();
  const count = 20;
  const docs = [];

  for (let i = 0; i < count; i++) {
    const ts = new Date(Date.now() - i * 3_600_000);
    docs.push({
      type: 'NEW_SIGNAL',
      correlationKey: `smoke-seed-${base}-${i}`,
      mesa: ['A1', 'B2', 'C3'][i % 3],
      round: String((i % 8) + 1),
      recommendation: i % 2 === 0 ? 'PLAYER' : 'BANKER',
      martingale: i % 3,
      result: i % 2 === 0 ? 'win' : 'loss',
      latencyMs: 300 + ((i * 41) % 900),
      correlationMiss: false,
      ingressKind: 'signal',
      serverSettledAt: ts,
      createdAt: ts,
      updatedAt: ts,
    });
  }

  try {
    await SignalEvent.insertMany(docs, { ordered: false });
    return docs.length;
  } catch (e) {
    logger?.warn?.('signal_events_seed_failed', { message: e instanceof Error ? e.message : String(e) });
    return 0;
  }
}

