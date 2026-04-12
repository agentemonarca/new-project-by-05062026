#!/usr/bin/env node
/**
 * Crea `apps/gpulse/.env` desde `.env.example` si aún no existe (no sobrescribe).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');

if (fs.existsSync(envPath)) {
  console.log('[gpulse] .env ya existe — no se modifica:', envPath);
  process.exit(0);
}

if (!fs.existsSync(examplePath)) {
  console.error('[gpulse] Falta .env.example en', examplePath);
  process.exit(1);
}

fs.copyFileSync(examplePath, envPath);
console.log('[gpulse] Creado .env desde .env.example');
console.log('[gpulse] Edita VITE_* y alinea VITE_GENESIS_ADMIN_API_KEY con backend/core-api/.env');
