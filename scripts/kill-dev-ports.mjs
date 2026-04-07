/**
 * Libera puertos típicos del stack dev (solo listeners del monorepo).
 * Requiere lsof + ps (macOS / Linux).
 *
 * Uso:
 *   node scripts/kill-dev-ports.mjs           → interactivo (y/n) solo sobre candidatos del proyecto
 *   node scripts/kill-dev-ports.mjs --force    → kill automático solo candidatos del proyecto
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import * as readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
let REPO_ROOT_REAL = REPO_ROOT;
try {
  REPO_ROOT_REAL = fs.realpathSync(REPO_ROOT);
} catch {
  /* keep REPO_ROOT */
}

function outText(stdout) {
  if (stdout == null) return '';
  return typeof stdout === 'string' ? stdout : Buffer.isBuffer(stdout) ? stdout.toString('utf8') : String(stdout);
}

const PORTS = [5050, 5174, 5190];

const force =
  process.argv.includes('--force') ||
  process.env.DEV_START_FORCE === '1' ||
  process.env.DEV_KILL_PORTS_FORCE === '1';

/** Patrones: nunca se matan (ni en --force). */
const FORBIDDEN_SNIPPETS = [
  'postgres',
  'postmaster',
  'docker',
  'containerd',
  'com.docker',
  'docker-proxy',
  'mysqld',
  'mariadbd',
  'mongod',
  'redis-server',
  'nginx:',
  'nginx ',
];

const DEV_STACK_RE = /\b(node|iojs|vite|npm|npx|pnpm|bun)\b/i;

/** Rutas relativas al repo típicas del stack Genesis dev (refuerzo si ps no muestra ruta absoluta). */
const PROJECT_PATH_SNIPPETS = [
  'backend/core-api',
  'apps/gpulse',
  'apps/admin-core',
  'apps/backoffice',
];

function normalizeCmd(s) {
  return (s || '').replace(/\\/g, '/');
}

function matchesForbidden(cmd) {
  const lower = cmd.toLowerCase();
  return FORBIDDEN_SNIPPETS.some((x) => lower.includes(x.toLowerCase()));
}

function referencesRepoPath(cmdNorm) {
  for (const r of [REPO_ROOT, REPO_ROOT_REAL]) {
    if (r && cmdNorm.includes(r.replace(/\\/g, '/'))) return true;
  }
  return false;
}

function referencesProjectStructure(cmdNorm) {
  const base = path.basename(REPO_ROOT);
  if (!base || !cmdNorm.includes(base)) return false;
  return PROJECT_PATH_SNIPPETS.some((seg) => cmdNorm.includes(seg));
}

/**
 * @returns {'forbidden' | 'project' | 'other'}
 */
function classifyProcess(cmdline) {
  const cmd = (cmdline || '').trim();
  if (!cmd || cmd === '(unknown command)') return 'other';

  if (matchesForbidden(cmd)) return 'forbidden';

  if (!DEV_STACK_RE.test(cmd)) return 'other';

  const cmdNorm = normalizeCmd(cmd);
  if (referencesRepoPath(cmdNorm) || referencesProjectStructure(cmdNorm)) return 'project';

  return 'other';
}

async function getListenerPids(port) {
  try {
    const { stdout } = await execFileAsync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
      encoding: 'utf8',
    });
    const text = outText(stdout).trim();
    return text
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number.parseInt(s, 10))
      .filter((n) => Number.isFinite(n));
  } catch (err) {
    const code = err && typeof err.code === 'number' ? err.code : null;
    if (code === 1) return [];
    throw err;
  }
}

async function getProcessCommandLine(pid) {
  try {
    const psArgs =
      process.platform === 'darwin'
        ? ['-ww', '-p', String(pid), '-o', 'command=']
        : ['-ww', '-p', String(pid), '-o', 'args='];
    const { stdout } = await execFileAsync('ps', psArgs, { encoding: 'utf8' });
    const line = outText(stdout).trim();
    return line || '(unknown command)';
  } catch {
    return '(process ended or inaccessible)';
  }
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve((answer || '').trim().toLowerCase());
    });
  });
}

function reasonForForbidden(cmd) {
  const lower = cmd.toLowerCase();
  for (const x of FORBIDDEN_SNIPPETS) {
    if (lower.includes(x.toLowerCase())) return x;
  }
  return 'system / infrastructure pattern';
}

let rows;
try {
  rows = [];
  for (const port of PORTS) {
    const pids = await getListenerPids(port);
    rows.push({ port, pids });
  }
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`\nCould not run lsof (is it installed?): ${msg}\n`);
  process.exit(1);
}

const pidToPorts = new Map();
for (const { port, pids } of rows) {
  for (const p of pids) {
    if (!pidToPorts.has(p)) pidToPorts.set(p, []);
    pidToPorts.get(p).push(port);
  }
}

if (pidToPorts.size === 0) {
  console.log('No TCP listeners on ports 5050, 5174, or 5190. Nothing to do.\n');
  process.exit(0);
}

const pidInfo = new Map();
for (const pid of pidToPorts.keys()) {
  const cmdline = await getProcessCommandLine(pid);
  const kind = classifyProcess(cmdline);
  pidInfo.set(pid, { cmdline, kind, ports: pidToPorts.get(pid) });
}

console.log('Processes listening on dev ports:\n');
for (const { port, pids } of rows) {
  if (pids.length === 0) {
    console.log(`  ${port}: —`);
  } else {
    const bits = pids.map((p) => {
      const { kind } = pidInfo.get(p);
      const tag = kind === 'project' ? 'project dev' : kind === 'forbidden' ? 'BLOCKED (infra)' : 'non-project';
      return `PID ${p} [${tag}]`;
    });
    console.log(`  ${port}: ${bits.join('; ')}`);
  }
}

console.log('\nDetails:\n');
for (const [pid, { cmdline, kind, ports }] of pidInfo) {
  const shorten = cmdline.length > 160 ? `${cmdline.slice(0, 157)}...` : cmdline;
  console.log(`  PID ${pid} (ports ${ports.sort((a, b) => a - b).join(', ')}):`);
  console.log(`    ${shorten}`);
}

const forbidden = [...pidInfo.entries()].filter(([, v]) => v.kind === 'forbidden');
const other = [...pidInfo.entries()].filter(([, v]) => v.kind === 'other');
const candidates = [...pidInfo.entries()].filter(([, v]) => v.kind === 'project').map(([pid]) => pid);

if (forbidden.length > 0) {
  console.log('\nWARNING: listeners match infrastructure / non-dev patterns — they will NOT be killed:\n');
  for (const [pid, { cmdline }] of forbidden) {
    console.log(`  PID ${pid} (${reasonForForbidden(cmdline)}): not killed for safety`);
  }
}

if (other.length > 0) {
  console.log('\nWARNING: listeners are not classified as this repo’s node/vite/npm dev stack — not killed:\n');
  for (const [pid, { cmdline }] of other) {
    const short = cmdline.length > 120 ? `${cmdline.slice(0, 117)}...` : cmdline;
    console.log(`  PID ${pid}: ${short}`);
  }
}

if (candidates.length === 0) {
  console.log(
    '\nNo project dev processes eligible for auto-kill. Free ports manually if you still need them.\n',
  );
  process.exit(0);
}

console.log(`\nEligible for kill (this repo dev stack): ${candidates.length} process(es).\n`);

if (!force) {
  const answer = await ask('Kill these project dev processes? (y/n) ');
  if (answer !== 'y' && answer !== 'yes') {
    console.log('\nAborted. No processes were killed.\n');
    process.exit(0);
  }
} else {
  console.log('Force: killing eligible project dev processes without further confirmation.\n');
}

for (const pid of candidates) {
  try {
    await execFileAsync('kill', ['-9', String(pid)], { encoding: 'utf8' });
    console.log(`Sent SIGKILL to PID ${pid}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Failed to kill PID ${pid}: ${msg}`);
  }
}

console.log('\nDone.\n');
