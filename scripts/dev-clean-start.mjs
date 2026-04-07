/**
 * Limpia puertos dev y arranca el mismo stack que dev:all.
 *
 * Uso:
 *   node scripts/dev-clean-start.mjs           → kill interactivo (y/n)
 *   node scripts/dev-clean-start.mjs --force   → kill automático (CI)
 *   npm run dev:start -- --force               → igual que --force
 *
 * CI sin TTY: DEV_START_FORCE=1 npm run dev:start
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const force =
  args.includes('--force') ||
  process.env.DEV_START_FORCE === '1';

const killArgs = force ? ['--force'] : [];

function runNode(scriptRel, args = []) {
  const scriptPath = path.join(root, scriptRel);
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
}

function runNpmScript(name) {
  return spawnSync('npm', ['run', name], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
}

console.log('Cleaning ports...\n');

const killResult = runNode('scripts/kill-dev-ports.mjs', killArgs);
if (killResult.status !== 0) {
  process.exit(killResult.status ?? 1);
}

const checkResult = runNode('scripts/check-dev-ports.mjs', ['all']);
if (checkResult.status !== 0) {
  process.exit(checkResult.status ?? 1);
}

console.log('\nPorts cleared');
console.log('Starting services...\n');

const start = runNpmScript('dev:all:exec');
process.exit(start.status ?? 1);
