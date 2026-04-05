export { CoreProvider, useCore, useOptionalCore } from './CoreContext.jsx';
export * from './energyEngine.js';
export {
  getNextAction,
  buildNextActionStateFromCore,
  getLegacyProtocolNextAction,
  estimateImpact,
  estimateOpportunityLossAigPerDay,
  getEfficiency,
  hasActiveBooster,
  hasBoosterMultiplier,
  hasStakingParticipation,
} from './nextActionEngine.js';
export {
  getAIDecision,
  buildAIDecisionInputFromCore,
  inferActivityFromCore,
} from './AIDecisionEngine.js';
