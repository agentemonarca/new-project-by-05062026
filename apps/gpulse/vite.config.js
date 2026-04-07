import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    react(),
    {
      name: 'dev-ready-banner-gpulse',
      configureServer(server) {
        server.httpServer?.once('listening', () => {
          const port = server.config.server?.port ?? 5174;
          console.log('✔ GPulse running on', port);
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
  };
});
