/**
 * Action registry: scalable mapping from action.type -> handler(action, ctx)
 *
 * Handlers are "pure" except for using ctx (setters, services, refs).
 * Unknown actions should be treated as no-ops by the executor.
 */
export const actionRegistry = {
  ENGINE_READY_STEP: (action, ctx) => {
    const idx = Number(action?.payload?.enginesReady) || 0;
    if (!(idx > 0)) return;
    ctx.setEnginesReady(idx);
    if (ctx.isSoundEnabled) ctx.SoundEngine.playEngine(idx);
  },

  SPEAK: (action, ctx) => {
    const kind = String(action?.payload?.kind || '');
    if (!kind) return;
    ctx.speak(kind);
  },

  SET_MESA_RONDA: (action, ctx) => {
    const mesa = action?.payload?.mesa;
    const ronda = action?.payload?.ronda;
    if (mesa) ctx.setCurrentMesa(mesa);
    if (Number.isFinite(Number(ronda))) ctx.setCurrentRonda(Number(ronda));
  },

  TRIGGER_SEQUENCE: (action, ctx) => {
    if (typeof ctx.guardTriggerSequence === 'function' && ctx.guardTriggerSequence() === false) {
      return;
    }
    if (!ctx.shouldTriggerSequence(ctx.isSequenceTriggeredRef.current)) return;
    const pattern = Array.isArray(action?.payload?.pattern) ? action.payload.pattern : null;
    if (!pattern) return;
    ctx.isSequenceTriggeredRef.current = true;
    ctx.setPattern(pattern);
    ctx.executeSequence(pattern);
  },

  SET_NOISE: (action, ctx) => {
    ctx.SoundEngine.setNoise(Boolean(action?.payload?.active));
  },

  RESET_SEQUENCE_TRIGGER: (_action, ctx) => {
    ctx.isSequenceTriggeredRef.current = false;
  },

  RESET_ROUND_VISUALS: (_action, ctx) => {
    ctx.setWinnerSide(null);
    ctx.setActiveShot(null);
  },
};

