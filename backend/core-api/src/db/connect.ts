import mongoose, { type Connection } from 'mongoose';
import {
  getMongoConnectionUriGenesis,
  getMongoConnectionUriGpulse,
  getMongoConnectionUriWinx,
} from '../utils/default.js';

export type LoggerLike = {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
};

export type MongoSource = 'genesis' | 'winx' | 'gpulse';

const pools: Record<MongoSource, Connection | null> = {
  genesis: null,
  winx: null,
  gpulse: null,
};

const CONNECT_OPTS = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 15_000,
  socketTimeoutMS: 45_000,
} as const;

function logMongoConnectHints(message: string): void {
  const m = message || '';
  if (/ECONNREFUSED/i.test(m)) {
    console.warn('  → ECONNREFUSED: puerto cerrado o servicio caído en el host.');
  } else if (/ETIMEDOUT|timed out|Timeout/i.test(m)) {
    console.warn('  → ETIMEDOUT: firewall o red; revisa acceso al puerto Mongo.');
  } else if (/Authentication failed|bad auth|not authorized|Unauthorized/i.test(m)) {
    console.warn('  → Autenticación: usuario/contraseña o authSource en la URI.');
  } else if (/ENOTFOUND|getaddrinfo|ENOTUNREACH/i.test(m)) {
    console.warn('  → ENOTFOUND / red: host incorrecto o no resuelve.');
  }
}

async function openConnection(source: MongoSource, uri: string, logger: LoggerLike): Promise<void> {
  const c = mongoose.createConnection(uri, CONNECT_OPTS);
  c.on('error', (err: Error) => {
    logger.error(`mongo_${source}_driver_error`, { message: err?.message });
  });
  c.on('disconnected', () => {
    logger.warn(`mongo_${source}_disconnected`);
    console.warn(`Mongo [${source}] disconnected`);
  });
  try {
    await c.asPromise();
    pools[source] = c;
    logger.info(`mongo_${source}_connected`, { name: c.name, host: c.host });
    console.log(`Mongo [${source}] connected — db:`, c.name);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn(`Mongo [${source}] connect failed`, message);
    logMongoConnectHints(message);
    logger.warn(`mongo_${source}_connect_failed`, { message });
    await c.close().catch(() => {});
    pools[source] = null;
  }
}

/**
 * Opens named connections via mongoose.createConnection (no global default connection).
 */
export async function connectMongoIfConfigured(logger: LoggerLike): Promise<void> {
  mongoose.set('strictQuery', true);

  const g = getMongoConnectionUriGenesis();
  const w = getMongoConnectionUriWinx();
  const p = getMongoConnectionUriGpulse();

  if (!g && !w && !p) {
    logger.info('no_database_uri', {
      detail:
        'No MongoDB URI; set MONGO_URI (genesis), optionally MONGO_URI_WINX / MONGO_URI_GPULSE.',
    });
    console.warn(
      'Mongo not configured — set MONGO_URI for genesis; optional MONGO_URI_WINX / MONGO_URI_GPULSE.',
    );
    return;
  }

  if (g) await openConnection('genesis', g, logger);
  if (w) await openConnection('winx', w, logger);
  if (p) await openConnection('gpulse', p, logger);
}

export function getDbConnection(source: MongoSource): Connection {
  const c = pools[source];
  if (!c || c.readyState !== 1) {
    throw new Error(`mongo_not_ready:${source}`);
  }
  return c;
}

/** Pool genesis (P2P + admin-signals escriben aquí). */
export function genesisDb(): Connection {
  return getDbConnection('genesis');
}

/** Pool winx — lecturas admin con `?source=winx`. */
export function winxDb(): Connection {
  return getDbConnection('winx');
}

/** Pool gpulse — lecturas admin con `?source=gpulse`. */
export function gpulseDb(): Connection {
  return getDbConnection('gpulse');
}

export function tryGetDbConnection(source: MongoSource): Connection | null {
  const c = pools[source];
  if (!c || c.readyState !== 1) return null;
  return c;
}

export function resolveMongoSource(raw: unknown): MongoSource {
  const s = String(raw ?? 'genesis')
    .trim()
    .toLowerCase();
  if (s === 'genesis' || s === 'winx' || s === 'gpulse') return s;
  throw new Error('invalid_mongo_source');
}

export function isGenesisMongoReady(): boolean {
  return pools.genesis?.readyState === 1;
}

function anyConfiguredPoolReady(): boolean {
  if (getMongoConnectionUriGenesis() && pools.genesis?.readyState === 1) return true;
  if (getMongoConnectionUriWinx() && pools.winx?.readyState === 1) return true;
  if (getMongoConnectionUriGpulse() && pools.gpulse?.readyState === 1) return true;
  return false;
}

/** For GET /health */
export function getMongoHealthSummary(): {
  configured: boolean;
  ready?: boolean;
  sources?: Record<string, { uriConfigured: boolean; ready: boolean }>;
} {
  const gC = Boolean(getMongoConnectionUriGenesis());
  const wC = Boolean(getMongoConnectionUriWinx());
  const pC = Boolean(getMongoConnectionUriGpulse());
  if (!gC && !wC && !pC) return { configured: false };

  return {
    configured: true,
    ready: anyConfiguredPoolReady(),
    sources: {
      genesis: { uriConfigured: gC, ready: pools.genesis?.readyState === 1 },
      winx: { uriConfigured: wC, ready: pools.winx?.readyState === 1 },
      gpulse: { uriConfigured: pC, ready: pools.gpulse?.readyState === 1 },
    },
  };
}
