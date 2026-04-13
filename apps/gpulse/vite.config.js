import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @param {import('node:http').IncomingMessage} req */
function readReqBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Append NDJSON to workspace `.cursor/debug-3126a9.log` + mirror (same content) for tooling that glob-searches `.cursor`. */
function cursorDebugSessionLogSpool() {
  const logDir = path.resolve(__dirname, '../../.cursor');
  const logPath = path.join(logDir, 'debug-3126a9.log');
  const mirrorPath = path.join(logDir, 'gpulse-cursor-ingest.ndjson');
  return {
    name: 'cursor-debug-session-log-spool',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'POST' || !req.url?.startsWith('/__cursor-debug-ingest/')) {
          return next();
        }
        let body;
        try {
          body = await readReqBody(req);
        } catch {
          res.statusCode = 400;
          res.end();
          return;
        }
        const line = body.toString('utf8').trim();
        if (line) {
          try {
            await fs.mkdir(logDir, { recursive: true });
            const out = `${line}\n`;
            await fs.appendFile(logPath, out, 'utf8');
            await fs.appendFile(mirrorPath, out, 'utf8');
          } catch (e) {
            console.warn('[cursor-debug-session-log-spool] append failed', e?.message ?? e);
          }
        }
        const remotePath = (req.url || '').replace(/^\/__cursor-debug-ingest/, '') || '/';
        const fwd = http.request(
          {
            hostname: '127.0.0.1',
            port: 7804,
            path: remotePath,
            method: 'POST',
            headers: {
              'Content-Type': req.headers['content-type'] || 'application/json',
              'Content-Length': Buffer.byteLength(body),
              ...(req.headers['x-debug-session-id'] && {
                'X-Debug-Session-Id': /** @type {string} */ (req.headers['x-debug-session-id']),
              }),
            },
            timeout: 4000,
          },
          (fRes) => {
            res.statusCode = fRes.statusCode || 204;
            fRes.pipe(res);
          },
        );
        fwd.on('error', () => {
          res.statusCode = 204;
          res.end();
        });
        fwd.write(body);
        fwd.end();
      });
    },
  };
}

/**
 * Service account / PEM fields must NEVER ship to the browser.
 * Only Firebase *client* config keys belong in VITE_FIREBASE_CONFIG.
 *
 * Vite exposes only `VITE_*` env vars to client code via import.meta.env.
 * Do not prefix private keys or backend secrets with VITE_.
 */
const FORBIDDEN_IN_BROWSER_FIREBASE = new Set([
  'private_key',
  'privateKey',
  'client_email',
  'clientEmail',
  'client_secret',
  'clientSecret',
  'client_id',
  'clientId',
]);

function buildPublicFirebaseConfigString(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '{}';
  try {
    const o = JSON.parse(trimmed);
    if (!o || typeof o !== 'object' || Array.isArray(o)) return '{}';
    const copy = { ...o };
    for (const k of FORBIDDEN_IN_BROWSER_FIREBASE) {
      if (k in copy) delete copy[k];
    }
    return JSON.stringify(copy);
  } catch {
    return '{}';
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const firebaseClientJson = buildPublicFirebaseConfigString(env.VITE_FIREBASE_CONFIG);
  const appId = (env.VITE_APP_ID || 'genesis-oracle-v9-0').trim();
  const customToken = (env.VITE_INITIAL_AUTH_TOKEN || '').trim();

  const define = {
    __firebase_config: JSON.stringify(firebaseClientJson),
    __app_id: JSON.stringify(appId),
  };
  if (customToken) {
    define.__initial_auth_token = JSON.stringify(customToken);
  }

  const plugins = [
    cursorDebugSessionLogSpool(),
    react(),
    {
      name: 'dev-ready-banner-gpulse',
      configureServer(server) {
        server.httpServer?.once('listening', () => {
          const port = server.config.server?.port ?? 5174;
          const host = server.config.server?.host === true ? '0.0.0.0' : server.config.server?.host || 'localhost';
          const displayHost = host === '0.0.0.0' ? 'localhost' : host;
          console.log(`✔ GPulse → http://${displayHost}:${port} (puerto fijado aquí; el default de Vite es 5173)`);
        });
      },
    },
  ];
  // When no custom token, `define` cannot emit a literal `undefined`. Declare the binding once so typeof checks behave like “unset”.
  if (!customToken) {
    plugins.push({
      name: 'genesispulse-auth-token-decl',
      transform(code, id) {
        if (!id.endsWith('/src/App.jsx') && !id.endsWith('\\src\\App.jsx')) return null;
        if (code.startsWith('var __initial_auth_token;')) return null;
        return `var __initial_auth_token;\n${code}`;
      },
    });
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        buffer: 'buffer',
      },
      /** One React instance → Context matches across lazy chunks and linked deps */
      dedupe: ['react', 'react-dom'],
    },
    define: {
      ...define,
      global: 'window',
    },
    server: {
      /** Fail fast if 5174 is in use (no silent port bump). Override with `--port` if needed. */
      port: 5174,
      strictPort: true,
      host: true,
      open: '/',
      /** Same-origin `/api` + `/auth` so SIWE session cookies work (browser → Vite → core-api). */
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:5050',
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const host = req.headers.host;
              if (host) proxyReq.setHeader('X-Forwarded-Host', host);
            });
          },
        },
        '/auth': {
          target: 'http://127.0.0.1:5050',
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const host = req.headers.host;
              if (host) proxyReq.setHeader('X-Forwarded-Host', host);
            });
          },
        },
        '/socket.io': {
          target: 'http://127.0.0.1:5050',
          changeOrigin: true,
          ws: true,
        },
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-window', 'buffer', 'siwe'],
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id) return;
            if (id.includes('node_modules')) return 'vendor';
          },
        },
      },
    },
    test: {
      include: ['src/**/*.test.js'],
      environment: 'node',
    },
  };
});
