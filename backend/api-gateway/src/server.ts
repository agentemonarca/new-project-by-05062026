/**
 * Unified API edge: proxy to core-api and gpulse-api, optional JWT gate, structured logs, WebSocket /ws.
 */
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pino from 'pino';
import pinoHttp from 'pino-http';
import type { IncomingMessage, ServerResponse } from 'node:http';

type PinoHttpMiddleware = (
  opts: {
    logger: typeof logger;
    customProps?: (req: IncomingMessage, res: ServerResponse) => Record<string, unknown>;
  },
) => (req: express.Request, res: express.Response, next: express.NextFunction) => void;
import jwt from 'jsonwebtoken';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createGpulseRoutes } from './routes/gpulse.routes.js';
import { createGpulseWebhookHandlers } from './routes/webhook.routes.js';
import { createCompensationIngestRoutes } from './routes/compensationIngest.routes.js';
import { attachGpulseWebSocket } from './ws/server.js';

dotenv.config();

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaughtException');
  process.exit(1);
});
const PORT = Number(process.env.PORT || 4000);
const CORE_API_URL = process.env.CORE_API_URL || 'http://127.0.0.1:5050';
const GPULSE_API_URL = process.env.GPULSE_API_URL || 'http://127.0.0.1:5052';
const JWT_SECRET = process.env.JWT_SECRET || '';
const INTERNAL_WS_PUSH_SECRET = process.env.INTERNAL_WS_PUSH_SECRET || '';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const WS_PATH = process.env.WS_PATH || '/ws';

const app = express();
if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}
app.use(cors({ origin: true, credentials: true }));
app.use(
  express.json({
    limit: '2mb',
    verify: (req, _res, buf) => {
      (req as IncomingMessage & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);
const usePinoHttp = pinoHttp as unknown as PinoHttpMiddleware;
app.use(
  usePinoHttp({
    logger,
    customProps: (req) => ({
      gateway: true,
      requestId: req.headers['x-request-id'],
    }),
  }),
);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'api-gateway' });
});

const gpulseWebhooks = createGpulseWebhookHandlers({
  logger,
  gpulseApiUrl: GPULSE_API_URL,
  webhookSecret: WEBHOOK_SECRET,
  rateLimitPerMinute: Number(process.env.WEBHOOK_RATE_LIMIT_PER_MINUTE || 30),
  idempotencyMaxIds: Number(process.env.WEBHOOK_IDEMPOTENCY_MAX_IDS || 5000),
  idempotencyTtlMs: Number(process.env.WEBHOOK_IDEMPOTENCY_TTL_MS || 600_000),
});
app.use('/webhooks', gpulseWebhooks.webhooksRouter);
/** POST /gpulse/webhook — authenticate with header `x-api-key` = WEBHOOK_SECRET */
app.use('/gpulse', gpulseWebhooks.gpulseRouter);
app.use('/webhooks', createCompensationIngestRoutes(logger, CORE_API_URL));

function optionalJwtGate(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!JWT_SECRET) return next();
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_bearer' });
  }
  const raw = auth.slice(7);
  try {
    (req as express.Request & { gatewayUser?: unknown }).gatewayUser = jwt.verify(raw, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

const gpulseRoutes = createGpulseRoutes(logger, GPULSE_API_URL);
app.use('/api/gpulse', optionalJwtGate, gpulseRoutes);

app.use(
  '/api/gpulse',
  optionalJwtGate,
  createProxyMiddleware({
    target: GPULSE_API_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/gpulse': '' },
    on: {
      error(err, _req, res) {
        logger.error({ err }, 'gpulse proxy error');
        (res as express.Response).status(502).json({ error: 'bad_gateway', target: 'gpulse-api' });
      },
    },
  }),
);

app.use(
  '/api/core',
  optionalJwtGate,
  createProxyMiddleware({
    target: CORE_API_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/core': '' },
    on: {
      error(err, _req, res) {
        logger.error({ err }, 'core proxy error');
        (res as express.Response).status(502).json({ error: 'bad_gateway', target: 'core-api' });
      },
    },
  }),
);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(err);
  res.status(500).json({ error: 'internal_error' });
});

const server = http.createServer(app);

const { broadcast, getClientCount } = attachGpulseWebSocket(server, {
  logger,
  path: WS_PATH,
  gpulseApiUrl: GPULSE_API_URL,
});

/** gpulse-api pushes execution updates here; gateway broadcasts to WebSocket clients. */
app.post('/internal/gpulse/push', (req, res) => {
  if (INTERNAL_WS_PUSH_SECRET) {
    if (req.headers['x-internal-secret'] !== INTERNAL_WS_PUSH_SECRET) {
      return res.status(403).json({ error: 'forbidden' });
    }
  }
  const body = req.body as { type?: string; payload?: unknown };
  const allowed =
    body?.type === 'gpulse:update' ||
    body?.type === 'gpulse:ai:decision' ||
    body?.type === 'gpulse:learning:update' ||
    body?.type === 'gpulse:strategy:auto';
  if (!allowed || !body.payload || typeof body.payload !== 'object') {
    return res.status(400).json({ error: 'invalid_body' });
  }
  broadcast(body as Record<string, unknown>);
  logger.info({ type: body.type, clients: getClientCount() }, 'gateway.gpulse.ws_broadcast');
  res.json({ ok: true, clients: getClientCount() });
});

server.on('error', (err: NodeJS.ErrnoException) => {
  logger.error({ err, code: err.code }, 'http_server_error');
  process.exit(1);
});

server.listen(PORT, () => {
  logger.info(
    {
      PORT,
      CORE_API_URL,
      GPULSE_API_URL,
      jwt: Boolean(JWT_SECRET),
      wsPath: WS_PATH,
      webhook: Boolean(WEBHOOK_SECRET),
      node: process.version,
    },
    'api-gateway listening',
  );
});
