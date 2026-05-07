/**
 * Contrato único de correlación front (señal ↔ resultado).
 * Usado por externalSignalsStore (ingest), GenesisOraclePanel (ciclos admin) y App (augment IA Real).
 *
 * Precedencia para emparejar NEW_RESULT con filas pendientes (`pickPendingForResult`):
 * 1. correlationKey exacta
 * 2. providerSignalId
 * 3. mesa + round (último matching desde el final del array)
 * 4. solo mesa si round vacío en pick
 * 5. último elemento de pending si hay elementos
 */

/**
 * @param {unknown} row
 * @returns {{ oid: string, ock: string, opid: string }}
 */
export function peelIdsFromRow(row) {
  if (!row || typeof row !== 'object') return { oid: '', ock: '', opid: '' };
  let oid = row.id != null ? String(row.id).trim() : '';
  let ock = row.correlationKey != null ? String(row.correlationKey).trim() : '';
  let opid = row.providerSignalId != null ? String(row.providerSignalId).trim() : '';
  const rr = row.rawResult;
  if (rr != null && typeof rr === 'object' && !Array.isArray(rr)) {
    const rro = /** @type {Record<string, unknown>} */ (rr);
    if (!oid && rro.id != null) oid = String(rro.id).trim();
    if (!ock && rro.correlationKey != null) ock = String(rro.correlationKey).trim();
    if (!opid && rro.providerSignalId != null) opid = String(rro.providerSignalId).trim();
  }
  return { oid, ock, opid };
}

/**
 * @param {{ oid: string, ock: string, opid: string }} peeled
 * @param {unknown[]} extHistory
 * @param {unknown[]} extActiveSignals
 * @returns {unknown | null}
 */
export function findSignalRowMatchingPeel(peeled, extHistory, extActiveSignals) {
  const { oid, ock, opid } = peeled;
  if (!oid && !ock && !opid) return null;
  const matches = (row) => {
    if (!row || typeof row !== 'object') return false;
    if (oid && String(row.id ?? '').trim() === oid) return true;
    if (ock && String(row.correlationKey ?? '').trim() === ock) return true;
    if (opid && String(row.providerSignalId ?? '').trim() === opid) return true;
    return false;
  };
  const hist = Array.isArray(extHistory) ? extHistory : [];
  const act = Array.isArray(extActiveSignals) ? extActiveSignals : [];
  return hist.find(matches) ?? act.find(matches) ?? null;
}

/**
 * Empareja NEW_RESULT normalizado con `activeSignals` pendientes (misma lógica histórica que el store).
 *
 * **Claves vacías:** si varias filas en `pending` tienen `correlationKey === ''` y el `pick` también trae
 * `correlationKey` vacío, `find` devuelve la **primera** coincidencia del array (no uses claves vacías
 * duplicadas en producción; normaliza en ingest si el proveedor envía ausencia de clave repetida).
 *
 * @param {Array<{ correlationKey?: string, providerSignalId?: string | null, mesa?: string, round?: string }>} pending
 * @param {{ correlationKey: string, providerSignalId: string | null, mesa: string, round: string }} pick
 * @returns {unknown | null}
 */
export function pickPendingForResult(pending, pick) {
  const byKey = pending.find((s) => s.correlationKey === pick.correlationKey);
  if (byKey) return byKey;
  if (pick.providerSignalId) {
    const byProv = pending.find((s) => s.providerSignalId === pick.providerSignalId);
    if (byProv) return byProv;
  }
  const mesa = String(pick.mesa || '');
  const round = String(pick.round || '');
  if (mesa || round) {
    for (let i = pending.length - 1; i >= 0; i--) {
      const s = pending[i];
      if ((mesa && s.mesa === mesa && round && s.round === round) || (mesa && s.mesa === mesa && !round)) {
        return s;
      }
    }
  }
  return pending.length ? pending[pending.length - 1] : null;
}

/**
 * Panel Oracle: ¿el resultado normalizado corresponde al ciclo activo abierto?
 * `pick` suele venir tras alinear mesa/round/correlation al ciclo (ver GenesisOraclePanel.ingestResult).
 *
 * @param {Record<string, unknown> | null | undefined} ac — ciclo activo (status null = abierto)
 * @param {Record<string, unknown>} pick — resultado alineado (mesa, round, correlationKey, providerSignalId)
 * @returns {boolean}
 */
export function oracleResultMatchesActiveCycle(ac, pick) {
  if (!ac || ac.status != null) return false;

  if (ac.correlationKey && pick.correlationKey && ac.correlationKey !== pick.correlationKey) {
    return false;
  }
  if (ac.providerSignalId && pick.providerSignalId && ac.providerSignalId !== pick.providerSignalId) {
    return false;
  }
  if (ac.correlationKey && pick.correlationKey && ac.correlationKey === pick.correlationKey) {
    return true;
  }
  if (ac.providerSignalId && pick.providerSignalId && ac.providerSignalId === pick.providerSignalId) {
    return true;
  }

  const mesa = String(pick.mesa || '');
  const round = String(pick.round ?? pick.roundId ?? '');
  const acMesa = String(ac.mesa || '');
  const acRound = String(ac.round ?? ac.signalPayload?.round ?? ac.signalPayload?.roundId ?? '');
  if (mesa && acMesa === mesa && round && acRound === round) return true;
  if (mesa && acMesa === mesa && !round) return true;

  return true;
}

/**
 * Resuelve la fila del store que debe enriquecer teatro/cartas cuando el motor puede ir stale.
 *
 * @param {{
 *   isRelayShell: boolean,
 *   simReplay: boolean,
 *   simReplayIndex: number,
 *   extHistory: unknown[],
 *   extActiveSignals: unknown[],
 *   relayEngine: { status?: string, activeRow?: unknown, outcomeRow?: unknown },
 *   lastProviderSignalId: string | null,
 * }} args
 * @returns {unknown | null}
 */
export function resolveAugmentSourceRow(args) {
  const {
    isRelayShell,
    simReplay,
    simReplayIndex,
    extHistory,
    extActiveSignals,
    relayEngine,
    lastProviderSignalId,
  } = args;

  if (!isRelayShell) return null;

  const hist = Array.isArray(extHistory) ? extHistory : [];
  const act = Array.isArray(extActiveSignals) ? extActiveSignals : [];

  if (simReplay && hist.length) {
    return hist[simReplayIndex] ?? hist[0] ?? null;
  }

  const st = relayEngine?.status;
  const ar = relayEngine?.activeRow ?? null;
  const or = relayEngine?.outcomeRow ?? null;

  const bySid = () => {
    const sid = lastProviderSignalId;
    if (!sid) return null;
    return (
      hist.find((h) => h && String(h.id) === String(sid)) ??
      act.find((a) => a && String(a.id) === String(sid)) ??
      null
    );
  };

  const resultPhase =
    st === 'RESULT' || st === 'RESULT_SEQUENCE' || st === 'SUCCESS' || st === 'FAILED';

  if (resultPhase && or && typeof or === 'object') {
    const peeled = peelIdsFromRow(or);
    const aligned = findSignalRowMatchingPeel(peeled, hist, act) ?? bySid();
    if (aligned) {
      return aligned;
    }
  }

  if (ar) return ar;

  if (!or || typeof or !== 'object') return bySid();
  const peeledOr = peelIdsFromRow(or);
  if (!peeledOr.oid && !peeledOr.ock && !peeledOr.opid) return bySid();
  return findSignalRowMatchingPeel(peeledOr, hist, act) ?? bySid();
}
