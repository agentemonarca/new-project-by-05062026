import { isAdminRawMode } from './adminRawMode.js';
import { isMatchV2Enabled } from '@/utils/canonicalFlowFlags.js';
import { logCanonicalAudit } from '@/utils/extractCanonicalFields.js';
import { isSignalAuditEnabled } from './signalAuditEnv.js';

/**
 * Lógica pura del ciclo VistaLab (tests y panel comparten criterio).
 *
 * Prioridad (proveedor real): **mesa + round** iguales — round del resultado = `mesa_info.ronda_objetivo`
 * (la señal usa `signal.ronda_actual`). Luego CK `mesa|ronda` o id estable; no `id:` epoch como correlación.
 */

/** @param {Record<string, unknown> | null} sig */
/** @param {Record<string, unknown> | null} res */
export function resultMatchesSignal(sig, res) {
  if (isSignalAuditEnabled()) {
    if (sig && typeof sig === 'object') logCanonicalAudit(sig, 'vistaLab:match:sig');
    if (res && typeof res === 'object') logCanonicalAudit(res, 'vistaLab:match:res');
  }
  if (isAdminRawMode()) return true;
  if (!sig || !res) return false;

  const sm = String(sig.mesa ?? '').trim();
  const rm = String(res.mesa ?? '').trim();
  const sr = String(sig.round ?? '').trim();
  const rr = String(res.round ?? res.roundId ?? '').trim();
  /** El resultado cierra la señal en la misma mesa y la misma ronda objetivo (proveedor Winxplay / análogos). */
  if (sm && rm && sm === rm && sr && rr && sr === rr) {
    const logOn =
      import.meta.env.DEV === true || String(import.meta.env?.VITE_MATCH_CHECK ?? '').trim() === '1';
    if (logOn) {
      console.log('[MATCH_CHECK]', {
        signalMesa: sm,
        resultMesa: rm,
        signalRound: sr,
        resultRound: rr,
        path: 'mesa+round',
      });
    }
    return true;
  }

  if (isMatchV2Enabled()) {
    const sk = sig.correlationKey != null ? String(sig.correlationKey).trim() : '';
    const rk = res.correlationKey != null ? String(res.correlationKey).trim() : '';
    if (sk && rk && sk === rk && !sk.toLowerCase().startsWith('id:')) return true;
    const sid = sig.id != null ? String(sig.id).trim() : '';
    const rid = res.signalId != null ? String(res.signalId).trim() : '';
    if (sid && rid && sid === rid) return true;
    if (String(import.meta.env?.VITE_MATCH_DEBUG ?? '').trim() === '1') {
      console.log('[MATCH_DEBUG]', 'no_match', {
        sig: {
          mesa: sig.mesa,
          round: sig.round,
          correlationKey: sig.correlationKey,
          id: sig.id,
        },
        res: {
          mesa: res.mesa,
          round: res.round ?? res.roundId,
          correlationKey: res.correlationKey,
          signalId: res.signalId,
        },
      });
    }
    return false;
  }

  const sk = sig.correlationKey != null ? String(sig.correlationKey).trim() : '';
  const rk = res.correlationKey != null ? String(res.correlationKey).trim() : '';

  const sid = sig.id != null ? String(sig.id).trim() : '';
  const rid = res.signalId != null ? String(res.signalId).trim() : '';

  function mesaContradicts() {
    return sm !== '' && rm !== '' && sm !== rm;
  }

  /** @param {string} sr @param {string} rr */
  function roundsComparableAndEqual(sr, rr) {
    if (sr === '' || rr === '') return false;
    return sr === rr;
  }

  /** Misma mesa y datos lo bastante incompletos como para no exigir CK/round alineados. */
  function sameMesaLooseMatchForIncomplete() {
    if (sm === '' || rm === '' || sm !== rm) return false;
    if (sig.isIncomplete === true || res.isIncomplete === true) return true;
    const sr = String(sig.round ?? '').trim();
    const rr = String(res.round ?? res.roundId ?? '').trim();
    if (sr === '' || rr === '') return true;
    return false;
  }

  // 1) Prioridad: id ↔ signalId
  if (sid !== '' && rid !== '' && sid === rid) {
    if (mesaContradicts()) return false;
    return true;
  }

  // 2) correlationKey iguales (no `id:` tipo epoch — no es ronda de mesa)
  if (sk !== '' && rk !== '' && sk === rk && !sk.toLowerCase().startsWith('id:')) return true;

  // 3) Ambos CK pero distintos: puente id o misma mesa solo si incompleto / sin ronda
  if (sk !== '' && rk !== '') {
    if (sid !== '' && rid !== '' && sid === rid && !mesaContradicts()) return true;
    if (sameMesaLooseMatchForIncomplete()) return true;
    return false;
  }

  // 4) Solo uno con CK
  if (sk !== '' || rk !== '') {
    if (sid !== '' && rid !== '' && sid === rid && !mesaContradicts()) return true;
    if (sameMesaLooseMatchForIncomplete()) return true;
    return false;
  }

  // 5) Sin CK: rounds iguales; o ronda ausente solo en fila marcada incompleta
  if (sm === '' || rm === '' || sm !== rm) return false;
  const sr5 = String(sig.round ?? '').trim();
  const rr5 = String(res.round ?? res.roundId ?? '').trim();
  if (roundsComparableAndEqual(sr5, rr5)) return true;
  if (sr5 === '' && rr5 === '') return true;
  if (sr5 === '' && sig.isIncomplete === true) return true;
  if (rr5 === '' && res.isIncomplete === true) return true;
  return false;
}

/**
 * Primer resultado del buffer que empareja (orden de iteración = típicamente más reciente primero).
 * @param {Record<string, unknown> | null} activeSignal
 * @param {unknown[]} results
 * @param {string | null} [consumedRecvId] — recvId ya asignado a este ciclo (opcional)
 * @returns {Record<string, unknown> | null}
 */
export function findMatchingResultForSignal(activeSignal, results, consumedRecvId = null) {
  if (!activeSignal || !Array.isArray(results)) return null;
  const consumed = consumedRecvId != null ? String(consumedRecvId) : '';
  for (const r of results) {
    if (!r || typeof r !== 'object' || r.recvId == null) continue;
    const rrid = String(r.recvId);
    if (consumed !== '' && rrid === consumed) continue;
    if (resultMatchesSignal(activeSignal, /** @type {Record<string, unknown>} */ (r))) {
      return /** @type {Record<string, unknown>} */ (r);
    }
  }
  return null;
}

/** @param {Record<string, unknown> | null | undefined} sig */
export function martingaleDataFromSignal(sig) {
  const level = Number(sig?.martingaleLevel ?? 0) || 0;
  return { active: level > 0, level };
}

/**
 * ¿Puede arrancar un ciclo desde WAITING con esta cabeza del buffer?
 * @param {Record<string, unknown> | null | undefined} head
 * @param {{ barrierRecvId: string | null }} opts
 * @returns {{ ok: true, headRecvId: string } | { ok: false, reason: string }}
 */
export function evaluateWaitingHead(head, opts) {
  if (!head || head.recvId == null) return { ok: false, reason: 'NO_HEAD' };
  const headRecvId = String(head.recvId);
  const barrier = opts.barrierRecvId;
  if (barrier != null && headRecvId === barrier) return { ok: false, reason: 'BARRIER_SAME_AS_LAST_CYCLE' };
  return { ok: true, headRecvId };
}

/** @param {unknown} cell */
export function forecastCellToSideLetter(cell) {
  const s = String(cell ?? '').trim().toUpperCase();
  if (s === 'B' || s.startsWith('BANK')) return 'B';
  if (s === 'P' || s.startsWith('PLAY')) return 'P';
  if (s === 'T' || s.includes('TIE') || s.includes('EMPATE')) return 'T';
  if (s === '—' || s === '' || s === '-') return null;
  const c = s.slice(0, 1);
  return c === 'B' || c === 'P' || c === 'T' ? c : null;
}

/** @param {unknown} ganador */
export function ganadorToSideLetter(ganador) {
  const s = String(ganador ?? '').trim().toUpperCase();
  if (s.startsWith('BANK') || s === 'B') return 'B';
  if (s.startsWith('PLAY') || s === 'P') return 'P';
  if (s.startsWith('TIE') || s === 'T') return 'T';
  return null;
}

/**
 * Compara `forecast6[martingaleLevel]` (clamp 0..5) con el ganador real (PLAYER/BANKER).
 * Empates reales no disparan aviso.
 *
 * @param {Record<string, unknown> | null | undefined} signal
 * @param {Record<string, unknown> | null | undefined} result
 * @returns {{ misaligned: boolean, step?: number, pred?: string | null, win?: string | null }}
 */
export function forecastStepMisalignedWithGanador(signal, result) {
  if (!signal || !result) return { misaligned: false };
  const step = Math.min(Math.max(0, Number(signal.martingaleLevel) || 0), 5);
  const fc = Array.isArray(signal.forecast6) ? signal.forecast6[step] : null;
  const pred = forecastCellToSideLetter(fc);
  const mi = result.mesa_info && typeof result.mesa_info === 'object' && !Array.isArray(result.mesa_info) ? result.mesa_info : null;
  const gRaw = mi && 'ganador' in mi ? /** @type {{ ganador?: unknown }} */ (mi).ganador : result.ganador;
  const win = ganadorToSideLetter(gRaw);
  if (pred == null || win == null || win === 'T') return { misaligned: false };
  if (pred === win) return { misaligned: false };
  return { misaligned: true, step, pred, win };
}
