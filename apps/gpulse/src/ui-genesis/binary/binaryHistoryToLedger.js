/**
 * Maps binary engine events into ledger timeline rows.
 *
 * @typedef {{ type: string, ts: number, payload: Record<string, unknown> }} BinaryHistoryEvent
 */

/**
 * @param {BinaryHistoryEvent} e
 * @returns {import('../ledger/ledgerModel.js').LedgerEvent}
 */
export function binaryEventToLedgerRow(e) {
  const ts = Number(e.ts) || Date.now();
  const id = `binary-${e.type}-${ts}-${String(e.payload?.nonce ?? '').slice(0, 8)}`;

  switch (e.type) {
    case 'BINARY_MATCH': {
      const matched = Number(e.payload?.matchedVolume ?? 0);
      const earnings = Number(e.payload?.earnings ?? 0);
      return {
        id,
        ts,
        category: 'network',
        kind: 'binary_match',
        title: 'Binary match',
        summary: `Matched ${matched.toLocaleString()} pts · Est. bonus ${earnings.toFixed(4)}`,
        amountUsdt: earnings,
        meta: { binaryEvent: e.type, ...e.payload },
      };
    }
    case 'BINARY_CONSUMPTION': {
      const match = Number(e.payload?.matchVolume ?? 0);
      const lb = Number(e.payload?.leftBefore ?? 0);
      const rb = Number(e.payload?.rightBefore ?? 0);
      const la = Number(e.payload?.leftAfter ?? 0);
      const ra = Number(e.payload?.rightAfter ?? 0);
      return {
        id,
        ts,
        category: 'network',
        kind: 'binary_consumption',
        title: 'Binary consumption',
        summary: `Legs ${lb.toFixed(0)} / ${rb.toFixed(0)} → ${la.toFixed(0)} / ${ra.toFixed(0)} (−${match} matched)`,
        meta: { binaryEvent: e.type, ...e.payload },
      };
    }
    case 'BINARY_PURCHASE_VOLUME': {
      const pts = Number(e.payload?.points ?? 0);
      const leg = String(e.payload?.leg ?? '');
      const la = Number(e.payload?.leftAfter ?? 0);
      const ra = Number(e.payload?.rightAfter ?? 0);
      const isMkt = e.payload?.source === 'marketplace';
      const stakingRule = Boolean(e.payload?.marketplaceStakingRule);
      const aigBasis = e.payload?.totalAigValueBasis;
      const ruleLabel = isMkt ? (stakingRule ? '11% (SKU staking)' : '100% volumen') : 'activación';
      const basisHint =
        isMkt && aigBasis != null && Number(aigBasis) > 0 ? ` · AIG basis ${Number(aigBasis).toFixed(2)}` : '';
      return {
        id,
        ts,
        category: 'network',
        kind: 'binary_purchase_volume',
        title: isMkt ? 'Volumen binario · marketplace' : 'Volumen binario (activación)',
        summary: `+${pts.toLocaleString()} pts (${ruleLabel})${basisHint} · ${leg} · legs ${la.toFixed(0)} / ${ra.toFixed(0)}`,
        amountUsdt: pts,
        meta: {
          binaryEvent: e.type,
          bonusSource: 'binary',
          ...e.payload,
        },
      };
    }
    case 'BINARY_FLASH': {
      const lb = Number(e.payload?.leftBefore ?? 0);
      const rb = Number(e.payload?.rightBefore ?? 0);
      const la = Number(e.payload?.leftAfter ?? 0);
      const ra = Number(e.payload?.rightAfter ?? 0);
      const lostL = Number(e.payload?.lostLeft ?? 0);
      const lostR = Number(e.payload?.lostRight ?? 0);
      return {
        id,
        ts,
        category: 'network',
        kind: 'binary_flash',
        title: 'Binary monthly flash',
        summary: `Before ${lb.toFixed(0)} / ${rb.toFixed(0)} → after ${la.toFixed(0)} / ${ra.toFixed(0)} · Lost ${lostL.toFixed(1)} / ${lostR.toFixed(1)}`,
        meta: { binaryEvent: e.type, ...e.payload },
      };
    }
    default:
      return {
        id,
        ts,
        category: 'network',
        kind: String(e.type || 'binary'),
        title: 'Binary activity',
        summary: JSON.stringify(e.payload ?? {}),
        meta: { binaryEvent: e.type, raw: e.payload },
      };
  }
}

/**
 * @param {BinaryHistoryEvent[]} history
 */
export function binaryEventsToLedgerRows(history) {
  if (!Array.isArray(history) || history.length === 0) return [];
  return history.map(binaryEventToLedgerRow);
}
