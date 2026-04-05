export const sumStatTotals = (t) =>
  (Array.isArray(t) ? t : []).reduce((a, b) => a + Number(b || 0), 0);

/** Keep server rows; retain local-only rows until a matching Firestore doc appears (same mesa/ronda/shot/side, ~2m). */
export const mergeLedgerHistory = (serverLogs, prevHistory) => {
  const locals = prevHistory.filter((h) => String(h.id).startsWith('local-'));
  const result = [...serverLogs];
  for (const loc of locals) {
    const lt = loc.timestamp?.toMillis?.() || 0;
    const hasTwin = serverLogs.some(
      (s) =>
        String(s.mesa) === String(loc.mesa) &&
        Number(s.ronda) === Number(loc.ronda) &&
        Number(s.shot) === Number(loc.shot) &&
        String(s.side || 'FAIL') === String(loc.side || 'FAIL') &&
        Math.abs((s.timestamp?.toMillis?.() || 0) - lt) < 120000,
    );
    if (!hasTwin) result.push(loc);
  }
  result.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
  return result.slice(0, 30);
};

export function asLedgerRows(ledger) {
  return Array.isArray(ledger) ? ledger : [];
}

export function computeDailyPnL24hFromLedger(ledger, nowMs = Date.now()) {
  const minTs = nowMs - 24 * 60 * 60 * 1000;
  const rows = asLedgerRows(ledger).filter((e) => Number(e.timestamp) >= minTs);
  const wins = rows.filter((e) => e.action === 'win').reduce((s, e) => s + Number(e.amount || 0), 0);
  const losses = rows.filter((e) => e.action === 'loss').reduce((s, e) => s + Number(e.amount || 0), 0);
  return wins - losses;
}

export function computeSessionDerivedCounts(rows) {
  const r = asLedgerRows(rows);
  const bets = r.filter((e) => e.action === 'bet').length;
  const wins = r.filter((e) => e.action === 'win').length;
  const losses = r.filter((e) => e.action === 'loss').length;
  return { bets, wins, losses };
}

export function computeTotals(rows) {
  const r = asLedgerRows(rows);
  const bets = r.filter((e) => e.action === 'bet').length;
  const wins = r.filter((e) => e.action === 'win').length;
  const losses = r.filter((e) => e.action === 'loss').length;
  const winAmount = r.filter((e) => e.action === 'win').reduce((s, e) => s + Number(e.amount || 0), 0);
  const lossAmount = r.filter((e) => e.action === 'loss').reduce((s, e) => s + Number(e.amount || 0), 0);
  return { bets, wins, losses, winAmount, lossAmount, pnl: winAmount - lossAmount };
}

export function computeTodayPnL24h(rows, nowMs = Date.now()) {
  const cutoff = nowMs - 24 * 60 * 60 * 1000;
  const r = asLedgerRows(rows).filter((e) => (Number(e.timestamp) || 0) >= cutoff);
  const winAmount = r.filter((e) => e.action === 'win').reduce((s, e) => s + Number(e.amount || 0), 0);
  const lossAmount = r.filter((e) => e.action === 'loss').reduce((s, e) => s + Number(e.amount || 0), 0);
  return { pnl: winAmount - lossAmount, winAmount, lossAmount };
}

export function computeWinRatePct(totals) {
  const bets = Number(totals?.bets || 0);
  const wins = Number(totals?.wins || 0);
  return bets > 0 ? (wins / bets) * 100 : 0;
}

export function computeStreaks(rows) {
  const r = asLedgerRows(rows);
  const outcomes = r
    .filter((e) => e.action === 'win' || e.action === 'loss')
    .map((e) => ({ action: e.action, timestamp: Number(e.timestamp) || 0 }));
  if (outcomes.length === 0) {
    return {
      current: { kind: 'none', count: 0 },
      maxWin: 0,
      maxLoss: 0,
      currentWin: 0,
      currentLoss: 0,
    };
  }

  const outcomesAsc = [...outcomes].sort((a, b) => a.timestamp - b.timestamp); // old → new
  const outcomesDesc = [...outcomesAsc].reverse(); // new → old

  // current streak: scan from latest backwards
  const firstKind = outcomesDesc[0].action;
  let currentCount = 0;
  for (const e of outcomesDesc) {
    if (e.action !== firstKind) break;
    currentCount += 1;
  }

  // max streaks: scan entire history (chronological)
  let maxWin = 0;
  let maxLoss = 0;
  let runKind = null;
  let run = 0;
  for (let i = 0; i < outcomesAsc.length; i++) {
    const k = outcomesAsc[i].action;
    if (k !== runKind) {
      runKind = k;
      run = 1;
    } else run += 1;
    if (runKind === 'win') maxWin = Math.max(maxWin, run);
    if (runKind === 'loss') maxLoss = Math.max(maxLoss, run);
  }

  const currentWin = firstKind === 'win' ? currentCount : 0;
  const currentLoss = firstKind === 'loss' ? currentCount : 0;
  return {
    current: { kind: firstKind, count: currentCount },
    maxWin: maxWin,
    maxLoss: maxLoss,
    currentWin,
    currentLoss,
  };
}

export function computeWalletSplit(rows) {
  const r = asLedgerRows(rows);
  const aigRows = r.filter((e) => e.walletType === 'AIG');
  const dualRows = r.filter((e) => e.walletType === 'DUAL');
  const sum = (arr, type) => arr.filter((e) => e.action === type).reduce((s, e) => s + Number(e.amount || 0), 0);
  const mk = (arr) => {
    const wins = sum(arr, 'win');
    const losses = sum(arr, 'loss');
    const pnl = wins - losses;
    return { wins, losses, pnl };
  };
  return { aig: mk(aigRows), dual: mk(dualRows) };
}

