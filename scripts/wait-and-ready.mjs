/**
 * Espera a que los dev servers respondan y muestra mensaje de listo (sin credenciales).
 *
 * Uso: node scripts/wait-and-ready.mjs main|all
 */
import waitOn from 'wait-on';

const mode = process.argv[2] === 'all' ? 'all' : 'main';

const resources = ['http://127.0.0.1:5050/health', 'http-get://127.0.0.1:5174'];
if (mode === 'all') {
  resources.push('http-get://127.0.0.1:5190');
}

const timeout = 180_000;

try {
  await waitOn({
    resources,
    timeout,
    interval: 500,
    validateStatus: (status) => (status >= 200 && status < 500) || status === 404,
  });
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error('\n[wait-and-ready] Timeout o error esperando servicios:', msg);
  console.error('  Recursos:', resources.join(', '));
  process.exit(1);
}

console.log('\n✔ Core API running on 5050');
console.log('✔ GPulse running on 5174');
if (mode === 'all') {
  console.log('✔ Admin Core running on 5190');
}
