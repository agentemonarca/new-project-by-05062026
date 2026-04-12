#!/usr/bin/env node
/**
 * Genera un tarball con `apps/gpulse/dist` para subir al servidor (scp/rsync).
 * Ejecutar desde la raíz del repo, después de `pnpm build:gpulse` o `npm run build:gpulse`.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dist = path.join(root, 'apps/gpulse/dist');

if (!fs.existsSync(dist)) {
  console.error('No existe apps/gpulse/dist. Ejecuta primero: pnpm build:gpulse');
  process.exit(1);
}

const out = path.join(root, 'gpulse-dist.tar.gz');
try {
  execSync(`tar -czf "${out}" -C "${path.dirname(dist)}" "${path.basename(dist)}"`, { stdio: 'inherit' });
} catch {
  process.exit(1);
}
console.log('Listo:', out);
console.log('Subir al servidor, ejemplo:');
console.log(`  scp "${out}" user@TU_SERVIDOR:/var/www/`);
