/**
 * Lógica pura del ciclo VistaLab (tests y panel comparten criterio).
 *
 * Orden de match (FASE 4):
 * 1) correlationKey — si alguno trae CK no vacío, solo se decide por CK (ambos presentes e iguales);
 *    si solo uno trae CK → false (no mezclar con id ni mesa/round).
 * 2) id ↔ signalId — si coinciden; si ambas mesas vienen informadas deben ser la misma.
 * 3) mesa + round — misma mesa y ambos rounds no vacíos e iguales.
 */

/** @param {Record<string, unknown> | null} sig */
/** @param {Record<string, unknown> | null} res */
export function resultMatchesSignal(sig, res) {
  if (!sig || !res) return false;

  const sk = sig.correlationKey != null ? String(sig.correlationKey).trim() : '';
  const rk = res.correlationKey != null ? String(res.correlationKey).trim() : '';

  if (sk !== '' || rk !== '') {
    if (sk === '' || rk === '') return false;
    return sk === rk;
  }

  const sid = sig.id != null ? String(sig.id).trim() : '';
  const rid = res.signalId != null ? String(res.signalId).trim() : '';
  const sm = String(sig.mesa ?? '').trim();
  const rm = String(res.mesa ?? '').trim();

  if (sid !== '' && rid !== '' && sid === rid) {
    if (sm !== '' && rm !== '' && sm !== rm) return false;
    return true;
  }

  if (!sm || !rm || sm !== rm) return false;
  const sr = String(sig.round ?? '').trim();
  const rr = String(res.round ?? res.roundId ?? '').trim();
  if (!sr || !rr) return false;
  return sr === rr;
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
