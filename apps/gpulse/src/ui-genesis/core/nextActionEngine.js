import { coreRemainingUsdt } from '../types/miningCore.js';

/**
 * Conversion-focused next action — pure logic; `core` matches `useCore()`.
 *
 * @typedef {{
 *   type: string,
 *   priority: 'high' | 'medium' | 'low',
 *   title: string,
 *   description: string,
 *   impact: string,
 *   urgency?: string,
 *   cta: string,
 *   lostOpportunity?: string,
 * }} NextAction
 */

const MULT_MIN = 1.5;
const BOOSTER_PRESENT_MIN = 1.18;
const EFFICIENCY_WARN = 0.7;

/**
 * Engine efficiency 0–1 (energy index normalized).
 * @param {Record<string, unknown>} core
 */
export function getEfficiency(core) {
  return Math.max(0, Math.min(1, Number(core.energy ?? 0) / 100));
}

/**
 * Any active booster core with headroom.
 * @param {Record<string, unknown>} core
 */
export function hasActiveBooster(core) {
  const cores = core.cores ?? core.mining?.cores ?? [];
  return cores.some((c) => c.type === 'booster' && coreRemainingUsdt(c) > 0);
}

/**
 * Meaningful multiplier from booster module.
 * @param {Record<string, unknown>} core
 */
export function hasBoosterMultiplier(core) {
  return Number(core.multiplier ?? 1) >= BOOSTER_PRESENT_MIN;
}

/**
 * @param {Record<string, unknown>} core
 */
export function hasStakingParticipation(core) {
  return Number(core.stakingYield ?? 0) > 0.001;
}

function powerLowRelativeToMultiplier(power, multiplier) {
  if (multiplier < MULT_MIN) return false;
  const denom = Math.max(0.12, multiplier - 1);
  return power / denom < 1.15;
}

/**
 * Lost AIG/day vs running a “full energy” profile (UX metric).
 * @param {Record<string, unknown>} core
 */
export function estimateOpportunityLossAigPerDay(core) {
  const cur = Number(core.totalYieldAigPerSecond ?? 0);
  const e = Number(core.energy ?? 0);
  return Math.max(0, cur * 86400 * (1 - e / 100) * 0.22);
}

/**
 * Impact line for the hero card (conversion copy).
 * @param {Record<string, unknown>} core
 * @param {string} actionType
 * @returns {string}
 */
export function estimateImpact(core, actionType) {
  const mult = Number(core.multiplier ?? 1);
  const aigS = Number(core.totalYieldAigPerSecond ?? 0);
  const tyFactor = Number(core.totalYield ?? 0);
  const stake = Number(core.stakingYield ?? 0);

  switch (actionType) {
    case 'activate_booster': {
      const ratio = MULT_MIN / Math.max(mult, 1.001);
      const pctOnYield = Math.min(42, Math.max(9, (ratio - 1) * 100 * (0.55 + 0.45 * tyFactor)));
      return `+${pctOnYield.toFixed(0)}% on total yield (est.)`;
    }
    case 'inject_mining': {
      const day = aigS * 86400 * 0.24;
      return `+${Math.max(0, Math.round(day)).toLocaleString()} AIG/day (est.)`;
    }
    case 'start_staking': {
      const passive = Math.round(14 + (1 - Math.min(stake, 1)) * 16);
      return `+${passive}% passive on stack (est.)`;
    }
    case 'go_marketplace':
    default:
      return '+Utility & spend velocity (est.)';
  }
}

function buildUrgencyLines(core, nextType) {
  const lines = [];
  const eff = getEfficiency(core);
  if (eff < EFFICIENCY_WARN) {
    lines.push(`Efficiency ${Math.round(eff * 100)}% — below target; you are bleeding output.`);
  }
  if (!hasBoosterMultiplier(core) && !hasActiveBooster(core) && nextType !== 'activate_booster') {
    lines.push('Booster inactive — turn on acceleration.');
  }
  if (!hasStakingParticipation(core) && nextType !== 'start_staking') {
    lines.push('Passive staking idle — add yield.');
  }
  const loss = estimateOpportunityLossAigPerDay(core);
  const lostOpportunity =
    loss >= 1 ? `You are losing ~${Math.round(loss).toLocaleString()} AIG/day` : undefined;
  return {
    urgency: lines.length ? lines.join(' · ') : undefined,
    lostOpportunity,
  };
}

/**
 * Conversion funnel for marketplace alignment — keep stable `type` contract for {@link productAlignsWithNextAction}.
 * @param {Record<string, unknown>} core
 * @returns {NextAction}
 */
export function getLegacyProtocolNextAction(core) {
  if (core.claimUi?.accountFrozen) {
    return {
      type: 'open_wallet',
      priority: 'high',
      title: 'Cuenta congelada — holding AIG',
      description:
        'Mantén al menos 7% de AIG respecto a tu posición neta (AIG + ledger USDT) para descongelar reclamaciones e inversiones.',
      impact: 'Completa el ratio de holding para continuar.',
      cta: 'Ir a Wallet',
    };
  }

  const power = Number(core.power ?? 0);
  const multiplier = Number(core.multiplier ?? 1);
  const stakingYield = Number(core.stakingYield ?? 0);

  /** @type {NextAction} */
  let next;

  if (multiplier < MULT_MIN) {
    next = {
      type: 'activate_booster',
      priority: multiplier < 1.22 ? 'high' : 'medium',
      title: 'Turn on acceleration',
      description:
        'Booster liquidity compounds the rate your mining engines pay. Bring multiplier up to protocol target.',
      impact: estimateImpact(core, 'activate_booster'),
      cta: 'Open booster',
    };
  } else if (powerLowRelativeToMultiplier(power, multiplier)) {
    next = {
      type: 'inject_mining',
      priority: power < 0.18 ? 'high' : 'medium',
      title: 'Feed mining engines',
      description: 'Base power is soft versus your boost. More mining liquidity raises the floor the multiplier applies to.',
      impact: estimateImpact(core, 'inject_mining'),
      cta: 'Add liquidity',
    };
  } else if (stakingYield < 1e-6) {
    next = {
      type: 'start_staking',
      priority: 'medium',
      title: 'Capture passive staking',
      description: 'Stack staking participation to unlock passive yield on the energy engine.',
      impact: estimateImpact(core, 'start_staking'),
      cta: 'Open staking',
    };
  } else {
    next = {
      type: 'go_marketplace',
      priority: 'low',
      title: 'Use AIG in the marketplace',
      description: 'Deploy balances into listings — partial AIG settlement and ecosystem utility.',
      impact: estimateImpact(core, 'go_marketplace'),
      cta: 'Browse marketplace',
    };
  }

  const { urgency, lostOpportunity } = buildUrgencyLines(core, next.type);
  if (urgency) next.urgency = urgency;
  if (lostOpportunity) next.lostOpportunity = lostOpportunity;

  if (!hasBoosterMultiplier(core) && next.type === 'activate_booster') {
    next.priority = 'high';
  }

  return next;
}

/** Keep in sync with `notificationEngine.js` rule thresholds. */
const BINARY_MATCH_PTS = 120;
const DIRECT_BONUS_MIN = 0.01;

/**
 * @typedef {'HIGH'|'MEDIUM'|'LOW'} NextDecisionPriority
 * @typedef {'staking'|'wallet'|'network'} NextDecisionAction
 * @typedef {{
 *   hasSession: boolean,
 *   userHasActiveStaking: boolean,
 *   holdingPctAig: number,
 *   minHoldingPct: number,
 *   userEconomicallyActive: boolean,
 *   directClaimUsdt: number,
 *   leftPts: number,
 *   rightPts: number,
 * }} NextActionDecisionState
 *
 * AiGenesis single next step (staking / wallet / network only).
 * @typedef {{
 *   message: string,
 *   action: NextDecisionAction,
 *   priority: NextDecisionPriority,
 *   healthy?: boolean,
 *   ctaLabel: string,
 * }} AiNextDecision
 */

function portfolioDenRelevant(holdingPctAig) {
  return holdingPctAig < 99.5;
}

/**
 * Merge CoreContext snapshot with dashboard props for decision rules.
 * @param {Record<string, unknown>} core
 * @param {Partial<NextActionDecisionState>} [overrides]
 * @returns {NextActionDecisionState}
 */
export function buildNextActionStateFromCore(core, overrides = {}) {
  const L = Number(overrides.leftPts ?? core.leftPts ?? core.network?.leftPts ?? 0);
  const R = Number(overrides.rightPts ?? core.rightPts ?? core.network?.rightPts ?? 0);
  const dc = Number(
    overrides.directClaimUsdt ?? core.directClaimUsdt ?? core.claimUi?.directClaimUsdt ?? 0,
  );

  return {
    hasSession: Boolean(overrides.hasSession ?? core.hasSession),
    userHasActiveStaking: Boolean(
      overrides.userHasActiveStaking ?? hasStakingParticipation(core),
    ),
    /** When unknown, assume OK so we do not false-trigger the holding alert. */
    holdingPctAig:
      overrides.holdingPctAig != null ? Number(overrides.holdingPctAig) : 100,
    minHoldingPct: Number(overrides.minHoldingPct ?? 7),
    userEconomicallyActive: Boolean(
      overrides.userEconomicallyActive ??
        (core.hasSession ? core.economicActive : false),
    ),
    directClaimUsdt: dc,
    leftPts: L,
    rightPts: R,
  };
}

/**
 * One clear next action for AiGenesis (priority: no staking → low holding → binary → direct → healthy).
 * @param {NextActionDecisionState} state
 * @returns {AiNextDecision}
 */
export function getNextAction(state) {
  const holdingPct = Number(state.holdingPctAig) || 0;
  const minH = Number(state.minHoldingPct) || 7;
  const minLeg = Math.min(Number(state.leftPts) || 0, Number(state.rightPts) || 0);
  const direct = Number(state.directClaimUsdt) || 0;

  if (!state.hasSession) {
    return {
      message:
        'Conecta tu wallet Web3 e inicia sesión con la API para ver el siguiente paso personalizado en el protocolo.',
      action: 'dashboard',
      priority: 'LOW',
      healthy: true,
      ctaLabel: 'Ir al panel',
    };
  }

  if (!state.userHasActiveStaking) {
    return {
      message:
        'No hay staking elegible activo. Activa participación de staking para desbloquear el flujo económico completo.',
      action: 'staking',
      priority: 'HIGH',
      ctaLabel: 'Ir a staking',
    };
  }

  if (portfolioDenRelevant(holdingPct) && holdingPct < minH) {
    return {
      message: `Tu holding AIG (~${holdingPct.toFixed(1)}%) está por debajo del objetivo (~${minH}%). Refuerza el ratio en Portfolio para evitar límites.`,
      action: 'wallet',
      priority: 'HIGH',
      ctaLabel: 'Ir a Portfolio',
    };
  }

  if (state.userEconomicallyActive && minLeg >= BINARY_MATCH_PTS) {
    return {
      message:
        'Hay volumen emparejable en ambas piernas del binario. Revisa emparejamiento y bonificación en la red.',
      action: 'network',
      priority: 'MEDIUM',
      ctaLabel: 'Ver red',
    };
  }

  if (direct >= DIRECT_BONUS_MIN) {
    return {
      message: `Tienes bono directo disponible (~${direct.toFixed(4)} USDT). Revisa y reclama desde Portfolio.`,
      action: 'wallet',
      priority: 'MEDIUM',
      ctaLabel: 'Ir a Portfolio',
    };
  }

  return {
    message:
      'Tu posición está alineada con el protocolo. Sigue el panel de red y Portfolio cuando quieras optimizar.',
    action: 'network',
    priority: 'LOW',
    healthy: true,
    ctaLabel: 'Ver red',
  };
}
