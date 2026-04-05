import { buildNextActionStateFromCore } from './nextActionEngine.js';

/** Aligned with notification / next-action thresholds. */
const BINARY_MATCH_PTS = 120;
const DIRECT_BONUS_MIN = 0.01;
const IMBALANCE_WARN_PCT = 38;

/**
 * @typedef {'critical'|'warning'|'opportunity'|'healthy'} AIDecisionPriority
 * @typedef {'staking'|'wallet'|'network'|'dashboard'} AIDecisionAction
 *
 * @typedef {{
 *   engagement?: 'idle'|'low'|'steady'|'high',
 * }} AIActivitySnapshot
 *
 * Full advisor input — extend Core + economy props.
 * @typedef {{
 *   hasSession: boolean,
 *   userHasActiveStaking: boolean,
 *   holdingPctAig: number,
 *   minHoldingPct: number,
 *   userEconomicallyActive: boolean,
 *   directClaimUsdt: number,
 *   binaryLeftPts: number,
 *   binaryRightPts: number,
 *   accountFrozen?: boolean,
 *   totalYieldUsdtPerSecond?: number,
 *   activity?: AIActivitySnapshot,
 * }} AIDecisionInput
 *
 * @typedef {{
 *   title: string,
 *   message: string,
 *   impact: string,
 *   prediction: string,
 *   action: AIDecisionAction,
 *   priority: AIDecisionPriority,
 * }} AIDecision
 */

function portfolioDenRelevant(holdingPctAig) {
  return holdingPctAig < 99.5;
}

function binaryStats(L, R) {
  const l = Number(L) || 0;
  const r = Number(R) || 0;
  const total = l + r;
  const minLeg = Math.min(l, r);
  const imbalancePct = total > 1e-9 ? Math.round((100 * Math.abs(l - r)) / total) : 0;
  return { l, r, total, minLeg, imbalancePct };
}

/**
 * Derive a coarse activity label when the app does not pass explicit engagement.
 * @param {Record<string, unknown>} core
 * @param {{ activity?: AIActivitySnapshot }} overrides
 */
export function inferActivityFromCore(core, overrides = {}) {
  if (overrides.activity?.engagement) return overrides.activity;
  const y = Number(core.totalYieldUsdtPerSecond ?? 0);
  const cores = core.cores ?? [];
  const hasMining = cores.some((c) => c.type === 'mining');
  if (!hasMining && y < 1e-9) return { engagement: 'idle' };
  if (y < 1e-7) return { engagement: 'low' };
  if (y > 1e-4) return { engagement: 'high' };
  return { engagement: 'steady' };
}

/**
 * @param {Record<string, unknown>} core
 * @param {Partial<AIDecisionInput> & { activity?: AIActivitySnapshot }} [overrides]
 * @returns {AIDecisionInput}
 */
export function buildAIDecisionInputFromCore(core, overrides = {}) {
  const s = buildNextActionStateFromCore(core, overrides);
  const activity = overrides.activity ?? inferActivityFromCore(core, overrides);
  return {
    hasSession: s.hasSession,
    userHasActiveStaking: s.userHasActiveStaking,
    holdingPctAig: s.holdingPctAig,
    minHoldingPct: s.minHoldingPct,
    userEconomicallyActive: s.userEconomicallyActive,
    directClaimUsdt: s.directClaimUsdt,
    binaryLeftPts: overrides.binaryLeftPts ?? s.leftPts,
    binaryRightPts: overrides.binaryRightPts ?? s.rightPts,
    accountFrozen: Boolean(overrides.accountFrozen ?? core.claimUi?.accountFrozen),
    totalYieldUsdtPerSecond: Number(
      overrides.totalYieldUsdtPerSecond ?? core.totalYieldUsdtPerSecond ?? 0,
    ),
    activity,
  };
}

/**
 * Advisor-style single decision: impact = loss/gain framing, prediction = short forward view.
 * @param {AIDecisionInput} input
 * @returns {AIDecision}
 */
export function getAIDecision(input) {
  const holdingPct = Number(input.holdingPctAig) || 0;
  const minH = Number(input.minHoldingPct) || 7;
  const direct = Number(input.directClaimUsdt) || 0;
  const { total, minLeg, imbalancePct } = binaryStats(input.binaryLeftPts, input.binaryRightPts);
  const engagement = input.activity?.engagement ?? 'steady';
  const yieldS = Number(input.totalYieldUsdtPerSecond ?? 0);
  const frozen = Boolean(input.accountFrozen);
  const gapToHoldingPct = Math.max(0, minH - holdingPct);

  if (!input.hasSession) {
    return {
      title: 'Modelo sin cartera',
      message:
        'El asesor necesita sesión y datos de protocolo para personalizar riesgo, oportunidad y próximos pasos.',
      impact: 'Sin conexión no se cuantifica pérdida ni ganancia esperada — incertidumbre operativa total.',
      prediction:
        'Al iniciar sesión, proyectamos escenarios de holding, binario y reclamos con tus volúmenes reales.',
      action: 'wallet',
      priority: 'warning',
    };
  }

  if (frozen) {
    return {
      title: 'Estado crítico · holding',
      message:
        'Tu ratio AIG respecto al patrimonio operativo está por debajo del umbral del protocolo; la cuenta se trata como congelada para reclamos clave.',
      impact: 'Riesgo de bloqueo sostenido de reclamos e inyecciones hasta restaurar el ratio objetivo.',
      prediction:
        `Recuperar ~${gapToHoldingPct.toFixed(1)} puntos porcentuales de AIG suele alinear la cuenta en el mismo ciclo operativo.`,
      action: 'wallet',
      priority: 'critical',
    };
  }

  if (!input.userHasActiveStaking) {
    return {
      title: 'Capa económica incompleta',
      message:
        'Sin participación de staking elegible, el protocolo no considera tu posición como plenamente activa en el flujo de rendimientos.',
      impact: 'Pérdida estructural de yield pasivo y de sincronía con reglas que dependen del staking.',
      prediction:
        'Activar staking suele desbloquear el siguiente escalón de eficiencia en binario y reclamos en 1–2 ciclos.',
      action: 'staking',
      priority: 'critical',
    };
  }

  if (portfolioDenRelevant(holdingPct) && holdingPct < minH) {
    return {
      title: 'Presión sobre el ratio AIG',
      message: `Holding ~${holdingPct.toFixed(1)}% vs objetivo ~${minH}%. El ratio protege límites de reclamo y liquidez operativa.`,
      impact: `Arrastre negativo estimado: cada punto bajo objetivo aumenta fricción en wallet y riesgo de congelación operativa.`,
      prediction: `Subir hacia ~${minH}% reduce la cola de riesgo en 7–14 días si mantienes aportes estables.`,
      action: 'wallet',
      priority: 'critical',
    };
  }

  if (input.userEconomicallyActive && total > 500 && imbalancePct >= IMBALANCE_WARN_PCT) {
    return {
      title: 'Eficiencia binaria limitada',
      message: `Asimetría ~${imbalancePct}% entre piernas; el volumen no se empareja de forma óptima.`,
      impact: 'Menor match efectivo y mayor exposición a reglas de ajuste (p. ej. flash) frente a un equipo equilibrado.',
      prediction:
        'Empujar la pierna débil típicamente recupera 10–25% de eficiencia de emparejamiento antes del cierre de ciclo.',
      action: 'network',
      priority: 'warning',
    };
  }

  if (input.userEconomicallyActive && minLeg >= BINARY_MATCH_PTS) {
    return {
      title: 'Ventana de oportunidad · binario',
      message:
        'Ambas piernas tienen volumen emparejable por encima del umbral de match; es un momento favorable para ejecutar en red.',
      impact:
        'Ganancia potencial: captura de bonificación por match según reglas vigentes (vs. posponer y diluir en el tiempo).',
      prediction: 'Actuar antes del rollover mensual suele maximizar el match explotable en escenarios estables.',
      action: 'network',
      priority: 'opportunity',
    };
  }

  if (direct >= DIRECT_BONUS_MIN) {
    return {
      title: 'Liquidez directa disponible',
      message: `Hay saldo direct claim material (~${direct.toFixed(4)} USDT) pendiente de revisión en wallet.`,
      impact: `Retención operativa positiva: +${direct.toFixed(4)} USDT reconocibles frente a dejarlos fuera de tu base líquida.`,
      prediction: 'Consolidar reclamos clarifica balances y mejora la precisión del modelo en el siguiente período.',
      action: 'wallet',
      priority: 'opportunity',
    };
  }

  if (input.userEconomicallyActive && (engagement === 'idle' || engagement === 'low')) {
    return {
      title: 'Señal de actividad débil',
      message:
        'El motor observa poca actividad reciente en minería/rendimiento relativo a tu sesión económica activa.',
      impact: 'Riesgo de subutilización: oportunidades de reinversión y reclamo pueden quedar latentes sin acción.',
      prediction:
        'Una interacción en dashboard o wallet en 48h suele restablecer métricas de engagement a un rango estable.',
      action: 'dashboard',
      priority: 'warning',
    };
  }

  const yieldNote =
    yieldS > 1e-6
      ? `Ritmo actual del motor ~${yieldS.toExponential(1)} USDT/s (referencia interna).`
      : 'Ritmo de yield en registro bajo; revisa minería y booster si buscas mayor salida.';

  return {
    title: 'Perfil alineado con el protocolo',
    message:
      'Staking activo, holding dentro de banda y sin alertas binarias urgentes. Mantén monitorización periódica.',
    impact: `Costo de oportunidad marginal frente a una estrategia agresiva; ${yieldNote}`,
    prediction:
      'Trayectoria proyectada estable a corto plazo si no hay shocks de volumen ni caídas bruscas de holding.',
    action: 'dashboard',
    priority: 'healthy',
  };
}
