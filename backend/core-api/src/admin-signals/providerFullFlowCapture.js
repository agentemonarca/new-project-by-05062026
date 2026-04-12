/**
 * End-to-end pipeline capture (provider → relay → optional client POST).
 * Enable with ADMIN_SIGNALS_FULL_FLOW=1 — writes repo `debug/provider-full-flow.json`.
 * Does not mutate relay payloads; only snapshots for logging / file.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Repo root: …/G-Pulse Oracle */
const REPO_DEBUG_FULL_FLOW = path.join(__dirname, '../../../../debug/provider-full-flow.json');

export function isAdminSignalsFullFlowEnabled() {
  return String(process.env.ADMIN_SIGNALS_FULL_FLOW ?? '').trim() === '1';
}

/** JSON-safe snapshot (no shared references). */
export function jsonSnapshot(v) {
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return { _nonSerializable: String(v) };
  }
}

function resolveFullFlowPath() {
  const override = String(process.env.ADMIN_SIGNALS_FULL_FLOW_FILE ?? '').trim();
  if (override) return path.isAbsolute(override) ? override : path.join(process.cwd(), override);
  return REPO_DEBUG_FULL_FLOW;
}

/**
 * Append one pipeline row to `debug/provider-full-flow.json` (trimmed ring buffer).
 * @param {Record<string, unknown>} row
 */
export function recordFullFlowRow(row) {
  if (!isAdminSignalsFullFlowEnabled()) return;
  const fp = resolveFullFlowPath();
  try {
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    /** @type {{ meta?: object, events?: unknown[] }} */
    let doc = { meta: { note: 'ADMIN_SIGNALS_FULL_FLOW=1' }, events: [] };
    if (fs.existsSync(fp)) {
      const raw = fs.readFileSync(fp, 'utf8');
      try {
        const p = JSON.parse(raw);
        if (p && typeof p === 'object' && Array.isArray(p.events)) {
          doc = { meta: p.meta && typeof p.meta === 'object' ? p.meta : {}, events: p.events };
        }
      } catch {
        /* keep empty */
      }
    }
    const snap = jsonSnapshot(row);
    doc.events = [...doc.events, { ...snap, capturedAt: Date.now() }];
    if (doc.events.length > 400) doc.events = doc.events.slice(-400);
    doc.meta = {
      ...(doc.meta || {}),
      updatedAt: Date.now(),
      eventCount: doc.events.length,
      fullFlowFile: fp,
    };
    fs.writeFileSync(fp, JSON.stringify(doc, null, 2), 'utf8');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[ADMIN_SIGNALS_FULL_FLOW] record failed', msg);
  }
}
