import { connectMongoIfConfigured, isGenesisMongoReady } from '../../dist/db/connect.js';

export async function connectMongo(logger) {
  if (isGenesisMongoReady()) return;
  await connectMongoIfConfigured(logger);
}
