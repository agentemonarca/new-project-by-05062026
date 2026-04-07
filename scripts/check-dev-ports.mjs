/**
 * Comprueba que los puertos del stack dev estén libres antes de arrancar.
 * Uso: node scripts/check-dev-ports.mjs main|all
 */
import { createServer } from 'node:net';

const mode = process.argv[2] === 'main' ? 'main' : 'all';

const PORTS_MAIN = [5050, 5174];
const PORTS_ALL = [5050, 5174, 5190];
const ports = mode === 'main' ? PORTS_MAIN : PORTS_ALL;

function isPortFree(port) {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once('error', (err) => {
      if (err && err.code === 'EADDRINUSE') resolve(false);
      else reject(err);
    });
    s.once('listening', () => {
      s.close(() => resolve(true));
    });
    s.listen(port, '0.0.0.0');
  });
}

const busy = [];
try {
  for (const p of ports) {
    if (!(await isPortFree(p))) busy.push(p);
  }
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`\nCould not verify dev ports: ${msg}\n`);
  process.exit(1);
}

if (busy.length === 0) process.exit(0);

for (const port of busy) {
  console.error(`\nPort ${port} is already in use`);
  console.error('\nTo inspect:');
  console.error(`  lsof -i :${port}`);
  console.error('\nTo free the port (replace PID with the value from lsof):');
  console.error('  kill -9 <PID>');
}

console.error('\nAborting: fix port conflicts before starting dev.\n');
process.exit(1);
