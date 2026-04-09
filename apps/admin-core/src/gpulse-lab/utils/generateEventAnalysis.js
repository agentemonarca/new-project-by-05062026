import { generateAlertAnalysis } from './alertAnalysisEngine.js';
import { extractMesaKeyFromRaw, extractNestedMesaInfo, extractNestedSignal } from './supplierIntelExtract.js';

function asRec(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function pickMesaRound(raw) {
  const r = asRec(raw);
  if (!r) return { mesa: null, round: null };

  const mesa =
    r.mesa != null && String(r.mesa).trim() !== ''
      ? String(r.mesa).trim()
      : extractMesaKeyFromRaw(raw) || null;

  const mi = extractNestedMesaInfo(raw);
  const sig = extractNestedSignal(raw);

  const round =
    r.round != null && String(r.round).trim() !== ''
      ? String(r.round).trim()
      : mi?.ronda_actual != null && String(mi.ronda_actual).trim() !== ''
        ? String(mi.ronda_actual).trim()
        : sig?.ronda_actual != null && String(sig.ronda_actual).trim() !== ''
          ? String(sig.ronda_actual).trim()
          : null;

  return { mesa, round };
}

function detectQuien(eventType) {
  const t = String(eventType || '');
  if (t === 'NEW_SIGNAL') return 'Proveedor (Signal Engine)';
  if (t === 'NEW_RESULT') return 'Proveedor (Result Engine)';
  return 'Sistema (Middleware / Validation)';
}

/**
 * Adapter: debug event → alert-like structure → analysis.
 * @param {{ eventName?: string, type?: string, payload?: unknown, receivedAt?: number }} event
 */
export function generateEventAnalysis(event) {
  const eventType = event?.eventName ?? event?.type ?? 'UNKNOWN';
  const rawPayload = event?.payload ?? null;
  const { mesa, round } = pickMesaRound(rawPayload);

  const alertLike = {
    type: String(eventType),
    mesa,
    round,
    timestamp: typeof event?.receivedAt === 'number' ? event.receivedAt : Date.now(),
    rawPayload,
    message: `Debug event: ${String(eventType)}`,
    severity: 'info',
  };

  const base = generateAlertAnalysis(alertLike);
  return {
    ...base,
    quien: detectQuien(eventType),
  };
}

