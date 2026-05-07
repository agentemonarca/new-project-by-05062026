/**
 * Smoke check: core-api /health + GPulse dev server (tras `npm run dev:main` o ambos servicios).
 * No imprime secretos. Exit 0 si ambos responden.
 *
 * Entorno (opcional):
 *   VERIFY_CORE_URL   — default http://127.0.0.1:5050/health
 *   VERIFY_GPULSE_URL — default http://127.0.0.1:5174/
 *
 * Staging/producción (misma máquina donde ejecutas el script):
 *   VERIFY_CORE_URL=https://api.tudominio.com/health \
 *   VERIFY_GPULSE_URL=https://app.tudominio.com/ \
 *   npm run verify:gpulse-alignment
 *
 * Nota: solo comprueba HTTP 200-ish al root del front; no valida Socket.IO ni cookies SIWE.
 */
import http from 'node:http';
import https from 'node:https';

function request(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 15_000 }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString('utf8').slice(0, 500),
        });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`timeout ${url}`));
    });
  });
}

const coreUrl = process.env.VERIFY_CORE_URL ?? 'http://127.0.0.1:5050/health';
const gpulseUrl = process.env.VERIFY_GPULSE_URL ?? 'http://127.0.0.1:5174/';

let ok = true;
try {
  const h = await request(coreUrl);
  if (h.status < 200 || h.status >= 500) {
    console.error(`[verify] core-api ${coreUrl} → HTTP ${h.status}`);
    ok = false;
  } else {
    console.log(`[verify] core-api ${coreUrl} → HTTP ${h.status} OK`);
  }
} catch (e) {
  console.error(`[verify] core-api failed:`, e?.message ?? e);
  ok = false;
}

try {
  const g = await request(gpulseUrl);
  if (g.status < 200 || g.status >= 500) {
    console.error(`[verify] gpulse ${gpulseUrl} → HTTP ${g.status}`);
    ok = false;
  } else {
    console.log(`[verify] gpulse ${gpulseUrl} → HTTP ${g.status} OK`);
  }
} catch (e) {
  console.error(`[verify] gpulse failed:`, e?.message ?? e);
  ok = false;
}

if (!ok) {
  console.error('\n[verify] Arranca primero: npm run dev:main (o dev:core-api + dev:gpulse en dos terminales).');
  process.exit(1);
}
console.log('\n[verify] Stack local listo (health + Vite). Admin-signals: comprobar en UI con X-Admin-Api-Key.');
process.exit(0);
