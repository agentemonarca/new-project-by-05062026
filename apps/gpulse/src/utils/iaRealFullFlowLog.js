import { isGpulseFullFlowEnabled, postFullFlowRow } from './gpulseFullFlowClient.js';

/** Before IA Real visual state commits (same data the engine will use). */
export function logIaRealEngineInput(args) {
  if (!isGpulseFullFlowEnabled()) return;
  const correlationKey =
    args.correlationKey ??
    args.activeRow?.correlationKey ??
    args.outcomeRow?.correlationKey ??
    null;
  const line = { ...args, correlationKey };
  console.log('⚡ IA REAL INPUT', line);
  void postFullFlowRow({ pipeline: 'ia_real', ...line });
}
