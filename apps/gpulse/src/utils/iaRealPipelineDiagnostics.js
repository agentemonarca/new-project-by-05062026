/**
 * IA Real: diagnósticos de pipeline (SOCKET → STORE → UI).
 * Activar con `VITE_IA_REAL_PIPE_CHECK=1` en `.env` del cliente.
 */

/** @returns {boolean} */
export function isIaRealPipeCheckEnabled() {
  return String(import.meta.env.VITE_IA_REAL_PIPE_CHECK ?? '').trim() === '1';
}

/**
 * @param {{
 *   layer: 'socket' | 'store' | 'ui',
 *   event?: string,
 *   socket?: unknown,
 *   normalized?: unknown,
 *   storeRow?: unknown,
 *   activeRow?: unknown,
 * }} p
 */
export function logPipeCheck(p) {
  if (!isIaRealPipeCheckEnabled()) return;
  const { layer, event, socket, normalized, storeRow, activeRow } = p;
  console.log('PIPE CHECK', { layer, event, socket, normalized, storeRow, activeRow });
}

/**
 * Valida campos mínimos de fila del store tras ingest (paridad con typedef ExternalBaccaratSignalRow).
 * @param {object | null | undefined} row
 * @param {string} ctx
 */
export function assertExternalSignalRowShape(row, ctx) {
  if (!row || typeof row !== 'object') {
    console.error('[STORE] ExternalBaccaratSignalRow ausente', ctx, row);
    return;
  }
  const need = ['rawSignal', 'correlationKey', 'recommendation', 'martingale'];
  for (const k of need) {
    if (row[k] === undefined) {
      console.error(`[STORE] ExternalBaccaratSignalRow falta campo obligatorio: ${k}`, ctx, row);
    }
  }
  if ((row.status === 'won' || row.status === 'lost') && row.rawResult == null) {
    console.error('[STORE] fila asentada sin rawResult', ctx, row);
  }
}

/**
 * @param {{
 *   connected: boolean,
 *   storeHasData: boolean,
 *   engineCoherent: boolean,
 *   theaterLikelyOk: boolean,
 *   panelHasStats: boolean,
 *   statsBrainOk: boolean,
 *   ledgerProviderTagged: boolean,
 * }} flags
 */
export function logIaRealPipelineHealthTable(flags) {
  if (!isIaRealPipeCheckEnabled()) return;
  const toOk = (v) => (v ? 'OK' : 'FAIL');
  console.table({
    pipeline: toOk(flags.connected),
    store: toOk(flags.storeHasData),
    engine: toOk(flags.engineCoherent),
    theater: toOk(flags.theaterLikelyOk),
    panel: toOk(flags.panelHasStats),
    stats: toOk(flags.statsBrainOk),
    ledger: toOk(flags.ledgerProviderTagged),
  });
}
