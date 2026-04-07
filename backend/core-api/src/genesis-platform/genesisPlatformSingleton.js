import { MemoryGenesisStore } from './store/MemoryGenesisStore.js';
import { MongoGenesisStore } from './store/MongoGenesisStore.js';
import { createP2pEngine } from './services/p2pEngine.js';
import { onGenesisPlatformEvent } from './services/genesisPlatformEvents.js';
import { initGenesisObservability, ingestGenesisPlatformEvent } from './services/genesisObservability.js';
import { getDbConnection, isGenesisMongoReady } from '../db/connectBridge.js';

let _instance = null;
let _platformEventLogHooked = false;

function createStore(logger) {
  if (isGenesisMongoReady()) {
    logger?.info?.('genesis_store_backend', { type: 'mongodb' });
    return new MongoGenesisStore(logger, getDbConnection('genesis'));
  }
  logger?.warn?.('genesis_store_backend', { type: 'memory', hint: 'Set MONGO_URI for durable P2P' });
  return new MemoryGenesisStore();
}

/**
 * Instancia única — MongoDB si está conectado, si no memoria.
 */
export function getGenesisPlatformContext(logger) {
  initGenesisObservability(logger);
  if (!_instance) {
    const store = createStore(logger);
    const p2p = createP2pEngine({ store, logger });
    _instance = { store, p2p };
    if (!_platformEventLogHooked && logger?.info) {
      _platformEventLogHooked = true;
      onGenesisPlatformEvent((ev) => {
        logger.info('genesis_platform_event', ev);
        ingestGenesisPlatformEvent(ev);
      });
    }
  }
  return _instance;
}
