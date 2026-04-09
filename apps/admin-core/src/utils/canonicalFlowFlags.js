/**
 * Alineación canónica (opt-in; sin flags = comportamiento actual).
 * @see extractCanonicalFields.js, vistaLabCycle.js
 */

export function isCanonicalModeEnabled() {
  try {
    return String(import.meta.env?.VITE_CANONICAL_MODE ?? '').trim() === '1';
  } catch {
    return false;
  }
}

export function isMatchV2Enabled() {
  try {
    return String(import.meta.env?.VITE_MATCH_V2 ?? '').trim() === '1';
  } catch {
    return false;
  }
}

export function isRoundTargetModeEnabled() {
  try {
    return String(import.meta.env?.VITE_ROUND_TARGET_MODE ?? '').trim() === '1';
  } catch {
    return false;
  }
}

export function isDirectionVectorEnabled() {
  try {
    return String(import.meta.env?.VITE_DIRECTION_FROM_VECTOR ?? '').trim() === '1';
  } catch {
    return false;
  }
}

function anyCanonicalFlowFlagEnabled() {
  return (
    isCanonicalModeEnabled() ||
    isMatchV2Enabled() ||
    isRoundTargetModeEnabled() ||
    isDirectionVectorEnabled()
  );
}

let phaseActiveLogged = false;

/** Logs una vez por sesión si algún flag de fase está activo. */
export function logPhaseActiveOnce() {
  if (phaseActiveLogged) return;
  if (!anyCanonicalFlowFlagEnabled()) return;
  phaseActiveLogged = true;
  console.log('[PHASE_ACTIVE]', {
    canonical: isCanonicalModeEnabled(),
    matchV2: isMatchV2Enabled(),
    roundTarget: isRoundTargetModeEnabled(),
    directionVector: isDirectionVectorEnabled(),
  });
  /** Indica qué capas de alineación están activas (flags env), no un test runtime de datos. */
  console.log('[CANONICAL_STATUS]', {
    canonicalWorking: isCanonicalModeEnabled(),
    directionWorking: isDirectionVectorEnabled(),
    matchWorking: isMatchV2Enabled(),
    roundAligned: isRoundTargetModeEnabled(),
    incompleteHandled: isCanonicalModeEnabled(),
  });
}

/** Solo tests: reinicia el guard de log. */
export function resetPhaseActiveLogForTests() {
  phaseActiveLogged = false;
}
