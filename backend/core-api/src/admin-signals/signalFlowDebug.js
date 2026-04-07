/**
 * Trazas estructuradas para depurar el flujo: upstream WS → transform → processor → Mongo → /admin-signals.
 * Activar: ADMIN_SIGNALS_DEBUG_FLOW=1 (o "true").
 */

const RAW =
  String(process.env.ADMIN_SIGNALS_DEBUG_FLOW || '').trim() === '1' ||
  String(process.env.ADMIN_SIGNALS_DEBUG_FLOW || '').toLowerCase() === 'true';

export function isAdminSignalsFlowDebug() {
  return RAW;
}

/**
 * @param {{ info?: Function }} [logger]
 * @param {string} step
 * @param {Record<string, unknown>} [meta]
 */
export function adminSignalsFlowTrace(logger, step, meta = {}) {
  if (!RAW) return;
  const payload = { step, t: new Date().toISOString(), ...meta };
  try {
    console.log('[admin-signals-flow]', JSON.stringify(payload));
  } catch {
    console.log('[admin-signals-flow]', step, meta);
  }
  logger?.info?.('admin_signals_flow_trace', payload);
}

/**
 * Resumen seguro para logs (evita volcar payloads enormes).
 * @param {unknown} p
 * @param {number} [previewMax]
 */
export function summarizePayloadForFlow(p, previewMax = 480) {
  if (p == null) return { kind: 'nullish' };
  const t = typeof p;
  if (t !== 'object') return { kind: t, preview: String(p).slice(0, previewMax) };
  if (Array.isArray(p)) {
    return { kind: 'array', length: p.length, preview: JSON.stringify(p.slice(0, 3)).slice(0, previewMax) };
  }
  const o = /** @type {Record<string, unknown>} */ (p);
  const keys = Object.keys(o).slice(0, 32);
  let size = 0;
  let preview = '';
  try {
    const s = JSON.stringify(o);
    size = Buffer.byteLength(s, 'utf8');
    preview = s.slice(0, previewMax);
  } catch {
    preview = '(non-serializable)';
  }
  return { kind: 'object', keys, jsonBytes: size, preview };
}

/** No volcar contenido de claves que puedan llevar secretos. */
const SENSITIVE_KEY_RE =
  /password|passwd|passphrase|secret|token|apikey|api[_-]?key|authorization|authheader|bearer|credential|cookie|session|privatekey|private[_-]?key|ssn|credit|card|cvv|iban|wallet/i;

const MAX_STRING_SAMPLE = 160;
const MAX_OBJECT_KEYS_IN_SAMPLE = 48;

/**
 * Valor solo primer nivel: sin anidar objetos/arrays (evita filtrar datos sensibles internos).
 * @param {unknown} v
 * @returns {unknown}
 */
function shallowValueForLog(v) {
  if (v == null) return v;
  const t = typeof v;
  if (t === 'boolean' || t === 'number') return v;
  if (t === 'string') {
    const s = v;
    if (s.length > MAX_STRING_SAMPLE) return `${s.slice(0, MAX_STRING_SAMPLE)}…(len=${s.length})`;
    return s;
  }
  if (Array.isArray(v)) return `[Array length=${v.length}]`;
  if (t === 'object') {
    try {
      const n = Object.keys(v).length;
      return `[Object keys=${n}]`;
    } catch {
      return '[Object]';
    }
  }
  return String(v).slice(0, 120);
}

/**
 * Captura estructura de `dashboardUpdate` sin datos sensibles ni profundidad.
 * Requiere ADMIN_SIGNALS_DEBUG_FLOW (el caller usa adminSignalsFlowTrace).
 *
 * @param {unknown} payload
 * @returns {{
 *   payloadType: string,
 *   topLevelKeys: string[] | null,
 *   arrayLength: number | null,
 *   sampleFirstLevel: Record<string, unknown> | null,
 * }}
 */
export function summarizeDashboardUpdatePayloadSafe(payload) {
  if (payload == null) {
    return {
      payloadType: String(payload),
      topLevelKeys: null,
      arrayLength: null,
      sampleFirstLevel: null,
    };
  }
  const payloadType = Array.isArray(payload) ? 'array' : typeof payload;

  if (typeof payload !== 'object') {
    return {
      payloadType,
      topLevelKeys: null,
      arrayLength: null,
      sampleFirstLevel: /** @type {Record<string, unknown>} */ ({
        _primitive: shallowValueForLog(payload),
      }),
    };
  }

  if (Array.isArray(payload)) {
    const sample = /** @type {Record<string, unknown>} */ ({});
    const show = Math.min(6, payload.length);
    for (let i = 0; i < show; i++) {
      sample[String(i)] = shallowValueForLog(payload[i]);
    }
    if (payload.length > show) {
      sample._truncatedIndices = payload.length - show;
    }
    return {
      payloadType: 'array',
      topLevelKeys: null,
      arrayLength: payload.length,
      sampleFirstLevel: sample,
    };
  }

  const o = /** @type {Record<string, unknown>} */ (payload);
  const topLevelKeys = Object.keys(o);
  const sampleFirstLevel = /** @type {Record<string, unknown>} */ ({});

  for (const k of topLevelKeys.slice(0, MAX_OBJECT_KEYS_IN_SAMPLE)) {
    if (SENSITIVE_KEY_RE.test(k)) {
      sampleFirstLevel[k] = '[REDACTED]';
      continue;
    }
    sampleFirstLevel[k] = shallowValueForLog(o[k]);
  }
  if (topLevelKeys.length > MAX_OBJECT_KEYS_IN_SAMPLE) {
    sampleFirstLevel._moreKeysCount = topLevelKeys.length - MAX_OBJECT_KEYS_IN_SAMPLE;
  }

  return {
    payloadType: 'object',
    topLevelKeys,
    arrayLength: null,
    sampleFirstLevel,
  };
}
