export function applyIaRealStakeDebit(mode, amount, setAig, setUsdt) {
  const bet = Number(amount);
  if (!(bet > 0)) return;
  if (mode === 'AIG') setAig((p) => Number(p) - bet);
  else {
    const h = bet / 2;
    setAig((p) => Number(p) - h);
    setUsdt((p) => Number(p) - h);
  }
}

export function applyIaRealWinCredit(mode, amount, setAig, setUsdt) {
  const w = Number(amount);
  if (!(w > 0)) return;
  if (mode === 'AIG') setAig((p) => Number(p) + w);
  else {
    const h = w / 2;
    setAig((p) => Number(p) + h);
    setUsdt((p) => Number(p) + h);
  }
}

/** Per-leg requirement for Multi (50/50): totalBet / 2 each on AIG and USDT */
export function multiPairRequiredPerLeg(totalBet) {
  return Number(totalBet) / 2;
}

export function canExecuteMultiPair(aig, usdt, totalBet) {
  const bet = Number(totalBet);
  if (!(bet > 0)) return true;
  const req = multiPairRequiredPerLeg(bet);
  return Number(aig) >= req && Number(usdt) >= req;
}

/** Saldo operativo por pierna (par 50/50): min(AIG, USDT) sobre totales de custodia */
export function multiOperationalPerLeg(aig, usdt) {
  return Math.min(Math.max(0, Number(aig)), Math.max(0, Number(usdt)));
}

/** Excedente no usado en apuestas hasta que se equilibre la pierna débil */
export function multiExcessAig(aig, usdt) {
  return Math.max(0, Number(aig) - multiOperationalPerLeg(aig, usdt));
}

export function multiExcessUsdt(aig, usdt) {
  return Math.max(0, Number(usdt) - multiOperationalPerLeg(aig, usdt));
}

/** Cupo máximo de apuesta bajo regla 50/50: 2 × min pierna (solo operativo) */
export function multiMaxUsable(aig, usdt) {
  return 2 * multiOperationalPerLeg(aig, usdt);
}

/** Mayor índice de tiro i ∈ [1…levels] alcanzable con regla 50/50 (apuesta crece por escalera). 0 si T1 no aplica. */
export function multiMaxReachableStep(aig, usdt, stake, levels) {
  const L = Math.max(1, Math.floor(Number(levels)));
  const s = Number(stake);
  if (!(s > 0)) return L;
  let best = 0;
  for (let i = 1; i <= L; i++) {
    const bet = s * Math.pow(2, i - 1);
    if (canExecuteMultiPair(aig, usdt, bet)) best = i;
    else break;
  }
  return best;
}

/** Dual-token slice: custodia + derived excess (kept in sync on every dual balance update). */
export function normalizeDualBalances(partial) {
  const aig = Number(partial.aig);
  const usdt = Number(partial.usdt);
  const leg = multiOperationalPerLeg(aig, usdt);
  return {
    aig,
    usdt,
    excessAig: Math.max(0, aig - leg),
    excessUsdt: Math.max(0, usdt - leg),
  };
}

