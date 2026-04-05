/**
 * G-Pulse execution API — simulated authoritative state + optional upstream proxy.
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pino from 'pino';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createControlRouter } from './routes/control.routes.js';
import { executionState } from './executionState.js';
import { startDecisionLoop } from './engine/decisionLoop.js';

dotenv.config();

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaughtException');
  process.exit(1);
});
const PORT = Number(process.env.PORT || 5052);
const UPSTREAM = process.env.CORE_UPSTREAM || 'http://127.0.0.1:5050';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'gpulse-api', upstream: UPSTREAM });
});

/** Authoritative snapshot for WebSocket clients (api-gateway) and diagnostics. */
app.get('/execution/snapshot', (_req, res) => {
  res.json({
    status: executionState.engine,
    strategy: executionState.strategy,
    safeMode: executionState.safeMode,
    autoMode: executionState.autoMode,
    modelConfidence: executionState.modelConfidence,
    performanceTrend: executionState.performanceTrend,
    learningState: executionState.learningState,
    timestamp: Date.now(),
  });
});

app.use(createControlRouter(logger));

app.use(
  createProxyMiddleware({
    target: UPSTREAM,
    changeOrigin: true,
    on: {
      error(err, _req, res) {
        logger.error({ err }, 'gpulse-api upstream error');
        (res as express.Response).status(502).json({ error: 'bad_upstream' });
      },
    },
  }),
);

const server = app.listen(PORT, () => {
  logger.info({ PORT, UPSTREAM, node: process.version }, 'gpulse-api listening');
  startDecisionLoop(logger);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  logger.error({ err, code: err.code }, 'http_server_error');
  process.exit(1);
});
