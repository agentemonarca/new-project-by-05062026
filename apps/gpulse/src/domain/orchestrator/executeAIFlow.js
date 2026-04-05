/**
 * Central orchestration hook for the IA cycle: diagnostics → coordination → G_Pulse result.
 * Engine timed actions (runAction per phase) still run via App's phase scheduler; this runs once per ignition.
 */
import { runDiagnostics } from '../diagnostics/index.js';
import { computeGPulse } from '../../core/gpulse/gpulseEngine.js';

/**
 * @param {{
 *   actionLog?: Array<{ timestamp?: number, phase?: string, type?: string, known?: boolean, skippedInactive?: boolean }>,
 *   currentPhase?: string,
 *   isActive?: boolean,
 *   history?: unknown[],
 * }} input
 * @returns {Promise<{ diagnostics: ReturnType<typeof runDiagnostics>, result: ReturnType<typeof computeGPulse> }>}
 */
export async function executeAIFlow(input = {}) {
  const {
    actionLog = [],
    currentPhase = 'STANDBY',
    isActive = false,
    history = [],
  } = input;

  console.log('STEP 1: diagnostics');
  const diagnostics = runDiagnostics({
    actionLog,
    currentPhase,
    isActive,
  });

  console.log('STEP 2: action');
  // Phase-scoped actions are applied by nextPhasePlan + runAction in App; this step reserves async coordination.
  await Promise.resolve();

  console.log('STEP 3: result');
  const result = computeGPulse(history);

  return { diagnostics, result };
}
