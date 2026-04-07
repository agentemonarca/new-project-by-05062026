/**
 * Inspección rápida de MongoDB: colecciones, conteos y hasta 3 documentos de muestra.
 *
 * Uso (desde backend/core-api):
 *   npm run mongo:inspect
 *
 * Requiere MONGO_URI o LINUXDB en .env
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const uri = process.env.MONGO_URI?.trim() || process.env.LINUXDB?.trim();
if (!uri) {
  console.error('No hay URI: define MONGO_URI o LINUXDB en backend/core-api/.env\n');
  process.exit(1);
}

/** Enmascara claves sensibles en muestras impresas. */
function redactDeep(value, depth = 0) {
  if (depth > 12) return '[max-depth]';
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((x) => redactDeep(x, depth + 1));
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (/password|secret|token|privatekey|authorization|apikey|api_key/i.test(k)) {
      out[k] = '[redacted]';
    } else {
      out[k] = redactDeep(v, depth + 1);
    }
  }
  return out;
}

try {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 15_000,
    socketTimeoutMS: 45_000,
  });
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error('No se pudo conectar a MongoDB:', msg, '\n');
  process.exit(1);
}

const db = mongoose.connection.db;
const dbName = mongoose.connection.name;
console.log('\n=== MongoDB inspect ===');
console.log('Database:', dbName);
console.log('Host:', mongoose.connection.host);

const cols = await db.listCollections().toArray();
const names = cols.map((c) => c.name).sort();

console.log('\n--- Colecciones ---');
console.log('Total:', names.length);
console.log(names.length ? names.join(', ') : '(ninguna)');

let totalDocs = 0;
const nonEmpty = [];

console.log('\n--- Conteo por colección ---');
for (const name of names) {
  try {
    const n = await db.collection(name).countDocuments();
    totalDocs += n;
    if (n > 0) nonEmpty.push({ name, n });
    console.log(`  ${name}: ${n}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ${name}: (error: ${msg})`);
  }
}

console.log('\n--- Resumen ---');
if (totalDocs === 0) {
  console.log('Estado: VACÍA (0 documentos en todas las colecciones).');
} else {
  console.log(
    `Estado: tiene datos (${totalDocs} documento(s) en total; ${nonEmpty.length} colección(es) con al menos un doc).`,
  );
}

const SAMPLE_LIMIT = 3;
console.log(`\n--- Hasta ${SAMPLE_LIMIT} ejemplos por colección (campos sensibles redactados) ---`);
for (const name of names) {
  const coll = db.collection(name);
  const count = await coll.countDocuments();
  const toShow = Math.min(SAMPLE_LIMIT, Math.max(count, 0));
  console.log(`\n## ${name} (total ${count}, mostrando ${toShow})`);
  if (count === 0) {
    console.log('  (sin documentos)');
    continue;
  }
  const cursor = coll.find({}).limit(SAMPLE_LIMIT);
  let i = 0;
  for await (const doc of cursor) {
    i += 1;
    const safe = redactDeep(doc);
    console.log(`  [${i}]`, JSON.stringify(safe, null, 2).split('\n').join('\n      '));
  }
}

console.log('\n=== Fin inspect ===\n');
await mongoose.disconnect();
process.exit(0);
