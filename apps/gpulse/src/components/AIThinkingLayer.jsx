import React, { useEffect, useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/** Mirrors App.jsx FASES strings (overlay stays decoupled from App). */
const PHASE = {
  ANALISIS: 'ANALISIS',
  DETECCION: 'DETECCION',
  SENAL: 'SEÑAL',
  RESULTADO: 'RESULTADO',
  STANDBY: 'STANDBY',
  REINICIO: 'REINICIO',
};

const SYMBOL_CHARS = ['∑', '∫', '√', 'π', 'λ', 'Δ', 'Ω', '∞', '∂', 'α', 'β', 'θ'];
const EQUATIONS = ['x² + y²', 'σ²/n', 'p̂±z', '∇·F', 'n→∞'];
const PCTS = ['72%', '91%', '68%', '84%', '59%', '93%', '77%', '88%'];

const STANDBY_SYM = 10;
const STANDBY_PART = 16;
const ACTIVE_SYM = 26;
const ACTIVE_PART = 34;

/** Visual arena (px); matches App portal wrapper — symbols use annulus r120–r240 around center. */
const ARENA = 480;
const CX = ARENA / 2;
const CY = ARENA / 2;

function rand(seed, i) {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Symbols only in outer ring (avoids bright portal center). x,y = px offset from center. depth: 1 inner / 0 outer (brighter when closer to inner radius). */
function buildSymbolsAnnulus(seed, n, rMin, rMax, durMin, durRange, driftAmp) {
  const items = [];
  for (let i = 0; i < n; i++) {
    const rk = rand(seed, i);
    const kind = rk < 0.45 ? 'sym' : rk < 0.75 ? 'pct' : rk < 0.9 ? 'eq' : 'sym';
    let text = SYMBOL_CHARS[Math.floor(rand(seed, i + 100) * SYMBOL_CHARS.length)];
    if (kind === 'pct') text = PCTS[Math.floor(rand(seed, i + 200) * PCTS.length)];
    if (kind === 'eq') text = EQUATIONS[Math.floor(rand(seed, i + 300) * EQUATIONS.length)];
    const ang = rand(seed, i + 400) * Math.PI * 2;
    const tr = rand(seed, i + 401);
    const rad = rMin + tr * (rMax - rMin);
    const x = Math.cos(ang) * rad;
    const y = Math.sin(ang) * rad;
    const depth = 1 - (rad - rMin) / Math.max(1e-6, rMax - rMin);
    items.push({
      id: `${seed}-${i}`,
      text,
      x,
      y,
      depth,
      delay: rand(seed, i + 600) * 2.5,
      dur: durMin + rand(seed, i + 700) * durRange,
      rotate: rand(seed, i + 800) > 0.5,
      color: rand(seed, i + 900) > 0.5 ? 'cyan' : 'purple',
      ox: (rand(seed, i + 910) - 0.5) * driftAmp,
      oy: (rand(seed, i + 911) - 0.5) * driftAmp * 0.75,
    });
  }
  return items;
}

function buildParticlesAnnulus(seed, n, arena, rMin, rMax, durMin, durRange) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const ang = rand(seed, i + 1) * Math.PI * 2;
    const rad = rMin + rand(seed, i + 2) * (rMax - rMin);
    const xPx = arena / 2 + Math.cos(ang) * rad;
    const yPx = arena / 2 + Math.sin(ang) * rad;
    const depth = 1 - (rad - rMin) / Math.max(1e-6, rMax - rMin);
    out.push({
      id: `p-${seed}-${i}`,
      left: (xPx / arena) * 100,
      top: (yPx / arena) * 100,
      size: 2 + rand(seed, i + 3) * 3,
      dur: durMin + rand(seed, i + 4) * durRange,
      delay: rand(seed, i + 5) * 8,
      hue: rand(seed, i + 6) > 0.5 ? 'c' : 'p',
      op: 0.14 + rand(seed, i + 7) * 0.2,
      depth,
    });
  }
  return out;
}

function linePairs(seed, count, maxSym) {
  const pairs = [];
  const cap = Math.max(2, maxSym);
  for (let k = 0; k < count; k++) {
    const a = Math.floor(rand(seed, k + 50) * cap) % cap;
    let b = Math.floor(rand(seed, k + 51) * cap) % cap;
    if (b === a) b = (b + 1) % cap;
    pairs.push([a, b]);
  }
  return pairs;
}

/** ~40–60% → memory (ghost), rest → converge to center on SIGNAL. */
function partitionThinkingMemory(symbols, seed) {
  if (!symbols.length) return { memory: [], converge: [] };
  const idx = symbols.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand(seed, i + 6000) * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const targetPct = 0.4 + rand(seed, 9999) * 0.2;
  const nMem = Math.max(1, Math.min(symbols.length - 1, Math.round(symbols.length * targetPct)));
  const memIdx = new Set(idx.slice(0, nMem));
  const memory = [];
  const converge = [];
  symbols.forEach((s, i) => {
    const row = { ...s, _mid: `m-${s.id}` };
    if (memIdx.has(i)) memory.push(row);
    else converge.push({ ...s });
  });
  return { memory, converge };
}

function buildBurstParticles(seed, n) {
  const hues = ['c', 'p', 'w', 'g'];
  const out = [];
  for (let i = 0; i < n; i++) {
    const ang = rand(seed, i + 11) * Math.PI * 2;
    const dist = 85 + rand(seed, i + 12) * 115;
    out.push({
      id: `b-${seed}-${i}`,
      ang,
      dist,
      size: 2 + rand(seed, i + 13) * 4.5,
      delay: rand(seed, i + 14) * 0.1,
      hue: hues[Math.floor(rand(seed, i + 15) * hues.length) % hues.length],
    });
  }
  return out;
}

function isLatentPhase(phase) {
  return phase === PHASE.STANDBY || phase === PHASE.REINICIO;
}

function isActiveThinkPhase(phase) {
  return phase === PHASE.ANALISIS || phase === PHASE.DETECCION;
}

/**
 * Dual-mode visual overlay: latent standby (STANDBY / REINICIO), active thinking (ANALISIS / DETECCION),
 * converge (SEÑAL), particle burst (RESULTADO). Visual-only.
 */
export default function AIThinkingLayer({ phase, isLight = false }) {
  const [subMode, setSubMode] = useState('latent'); // latent | activeThink | converge | signalMemory | burst | idle
  const [memorySplit, setMemorySplit] = useState(null); // { memory, converge } | null
  const [collapseSymbols, setCollapseSymbols] = useState(null);
  const [burstCount, setBurstCount] = useState(42);
  const standbySeedRef = useRef(1);
  const activeSeedRef = useRef(1);
  const burstSeedRef = useRef(1);
  const symActiveRef = useRef([]);
  const phaseRef = useRef(phase);
  const convergeTimer = useRef(null);
  const burstTimer = useRef(null);

  phaseRef.current = phase;

  useEffect(() => {
    if (convergeTimer.current) {
      clearTimeout(convergeTimer.current);
      convergeTimer.current = null;
    }
    if (burstTimer.current) {
      clearTimeout(burstTimer.current);
      burstTimer.current = null;
    }

    if (isLatentPhase(phase)) {
      setMemorySplit(null);
      setCollapseSymbols(null);
      setSubMode('latent');
      return;
    }

    if (isActiveThinkPhase(phase)) {
      setMemorySplit(null);
      setCollapseSymbols(null);
      activeSeedRef.current += 1;
      setSubMode('activeThink');
      return;
    }

    if (phase === PHASE.SENAL) {
      const split = partitionThinkingMemory(symActiveRef.current, activeSeedRef.current);
      setMemorySplit(split);
      setSubMode('converge');
      convergeTimer.current = setTimeout(() => {
        if (phaseRef.current === PHASE.SENAL) setSubMode('signalMemory');
        else setSubMode('idle');
        convergeTimer.current = null;
      }, 980);
      return () => {
        if (convergeTimer.current) clearTimeout(convergeTimer.current);
      };
    }

    if (phase === PHASE.RESULTADO) {
      const mem = memorySplit?.memory;
      if (mem?.length) setCollapseSymbols(mem.map((x) => ({ ...x })));
      else setCollapseSymbols(null);
      const extra = mem?.length || 0;
      setBurstCount(42 + Math.min(48, extra * 2));
      burstSeedRef.current += 1;
      setMemorySplit(null);
      setSubMode('burst');
      burstTimer.current = setTimeout(() => {
        setCollapseSymbols(null);
        setSubMode('idle');
        burstTimer.current = null;
      }, 720);
      return () => {
        if (burstTimer.current) clearTimeout(burstTimer.current);
      };
    }
  }, [phase]);

  const standbySeed = standbySeedRef.current;
  const activeSeed = activeSeedRef.current;
  const burstSeed = burstSeedRef.current;

  const symStandby = useMemo(
    () => buildSymbolsAnnulus(standbySeed, STANDBY_SYM, 118, 208, 14, 14, 11),
    [standbySeed]
  );
  const partStandby = useMemo(
    () => buildParticlesAnnulus(standbySeed, STANDBY_PART, ARENA, 108, 228, 22, 18),
    [standbySeed]
  );

  const symActive = useMemo(
    () => buildSymbolsAnnulus(activeSeed, ACTIVE_SYM, 124, 242, 6.5, 9, 14),
    [activeSeed]
  );
  const partActive = useMemo(
    () => buildParticlesAnnulus(activeSeed, ACTIVE_PART, ARENA, 112, 238, 11, 12),
    [activeSeed]
  );
  const lineIndices = useMemo(() => linePairs(activeSeed, 6, ACTIVE_SYM), [activeSeed]);
  const burstParts = useMemo(() => buildBurstParticles(burstSeed, burstCount), [burstSeed, burstCount]);

  symActiveRef.current = symActive;

  const splitForSignal =
    phase === PHASE.SENAL
      ? memorySplit ?? partitionThinkingMemory(symActive, activeSeedRef.current)
      : memorySplit;

  const isConverge = subMode === 'converge';
  const isSignalMemory = subMode === 'signalMemory';
  const isBurst = subMode === 'burst';

  const latentPhaseOn = phase === PHASE.STANDBY || phase === PHASE.REINICIO;
  const latentOpacity =
    latentPhaseOn ? 1 : isActiveThinkPhase(phase) || isConverge || isBurst ? 0 : 0;

  const cyan = isLight ? 'rgb(34, 211, 238)' : 'rgb(120, 252, 255)';
  const purple = isLight ? 'rgb(192, 132, 252)' : 'rgb(216, 180, 254)';
  const cyanDim = isLight ? 'rgb(34, 180, 200)' : 'rgb(72, 220, 235)';
  const purpleDim = isLight ? 'rgb(140, 100, 200)' : 'rgb(160, 120, 230)';

  const orbitKeyframes = (r) => `
    @keyframes atl-orbit-${r} {
      from { transform: rotate(0deg) translateX(${r}px) rotate(0deg); }
      to { transform: rotate(360deg) translateX(${r}px) rotate(-360deg); }
    }
  `;

  const activeStackOn =
    isActiveThinkPhase(phase) || isConverge || (isSignalMemory && phase === PHASE.SENAL);

  const partitionedSignal = Boolean(splitForSignal && phase === PHASE.SENAL);
  const driftSymbols =
    partitionedSignal && isConverge
      ? splitForSignal.converge
      : partitionedSignal && isSignalMemory
        ? []
        : symActive;

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 z-[5] h-full w-full max-h-[480px] max-w-[480px] -translate-x-1/2 -translate-y-1/2 overflow-visible"
      data-layer="effects"
      data-z="5"
      data-debug-anchor
      aria-hidden
    >
      <style>{`
        ${orbitKeyframes(22)}
        ${orbitKeyframes(32)}
        @keyframes atl-line-pulse-soft {
          0%, 100% { opacity: 0.04; }
          50% { opacity: 0.1; }
        }
        @keyframes atl-line-pulse-strong {
          0%, 100% { opacity: 0.08; }
          50% { opacity: 0.22; }
        }
        @keyframes atl-matter {
          0% { filter: brightness(0.88) saturate(0.95); }
          22% { filter: brightness(1) saturate(1); }
          48% { filter: brightness(1.18) saturate(1.08); }
          72% { filter: brightness(1.06) saturate(1.02); }
          100% { filter: brightness(1.14) saturate(1.06); }
        }
      `}</style>

      {/* STANDBY / REINICIO: continuous low-intensity field */}
      <motion.div
        className="absolute inset-0"
        animate={{
          opacity: latentOpacity,
          scale: latentPhaseOn ? 1 : activeStackOn ? 0.96 : 1,
        }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="absolute inset-0 overflow-visible">
          {partStandby.map((p) => (
            <div
              key={p.id}
              className="absolute rounded-full"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: p.size * 0.85,
                height: p.size * 0.85,
                marginLeft: -(p.size * 0.85) / 2,
                marginTop: -(p.size * 0.85) / 2,
                background: p.hue === 'c' ? cyanDim : purpleDim,
                opacity: p.op * (0.42 + 0.58 * p.depth) * 0.65,
                animationName: 'atl-orbit-22',
                animationDuration: `${p.dur * 1.65}s`,
                animationTimingFunction: 'linear',
                animationIterationCount: 'infinite',
                animationDelay: `${p.delay}s`,
                willChange: 'transform',
              }}
            />
          ))}
        </div>
        <div className="absolute inset-0 flex items-center justify-center overflow-visible">
          {symStandby.map((s) => {
            const col = s.color === 'cyan' ? cyanDim : purpleDim;
            const d = 0.5 + 0.5 * s.depth;
            const driftX = [s.x, s.x + s.ox, s.x - s.ox * 0.45, s.x];
            const driftY = [s.y, s.y + s.oy, s.y - s.oy * 0.5, s.y];
            return (
              <motion.span
                key={s.id}
                className="absolute left-1/2 top-1/2 whitespace-nowrap font-mono text-[9px] font-medium leading-none md:text-[10px]"
                style={{
                  color: col,
                  textShadow: isLight
                    ? `0 0 10px rgba(255,255,255,0.35), 0 0 18px rgba(34,211,238,${0.2 * d})`
                    : `0 0 12px rgba(255,255,255,0.28), 0 0 22px rgba(120,252,255,${0.35 * d})`,
                }}
                animate={{
                  x: driftX,
                  y: driftY,
                  opacity: [0.1 * d, 0.24 * d, 0.16 * d, 0.12 * d],
                  rotate: s.rotate ? [0, 4, -3, 0] : 0,
                  scale: 0.88 + 0.08 * d,
                }}
                transition={{
                  duration: s.dur * 1.4,
                  delay: s.delay,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                {s.text}
              </motion.span>
            );
          })}
        </div>
      </motion.div>

      {/* ACTIVE: ANALISIS / DETECCION / converge / signal memory ghosts */}
      <AnimatePresence>
        {(activeStackOn || isConverge) && (
          <motion.div
            key="active-layer"
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{
              opacity: 1,
              scale: isConverge ? 1.02 : 1,
            }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            style={
              isConverge || partitionedSignal
                ? { animationName: 'none' }
                : {
                    animationName: 'atl-matter',
                    animationDuration: '10s',
                    animationTimingFunction: 'ease-in-out',
                    animationIterationCount: 'infinite',
                  }
            }
          >
            {partitionedSignal && splitForSignal.memory.length > 0 && (
              <div className="absolute inset-0 z-[1] flex items-center justify-center overflow-visible">
                {splitForSignal.memory.map((s) => {
                  const col = s.color === 'cyan' ? cyan : purple;
                  const dm = 0.45 + 0.55 * s.depth;
                  const driftX = [s.x, s.x + s.ox * 0.35, s.x - s.ox * 0.25, s.x];
                  const driftY = [s.y, s.y + s.oy * 0.3, s.y - s.oy * 0.22, s.y];
                  return (
                    <motion.span
                      key={s._mid}
                      className="absolute left-1/2 top-1/2 whitespace-nowrap font-mono text-[10px] font-medium leading-none md:text-[11px]"
                      style={{
                        color: col,
                        filter: 'blur(0.9px)',
                        textShadow: isLight
                          ? `0 0 10px rgba(255,255,255,0.25), 0 0 18px rgba(34,211,238,${0.12 * dm})`
                          : `0 0 12px rgba(255,255,255,0.22), 0 0 20px rgba(120,252,255,${0.18 * dm})`,
                      }}
                      initial={{ x: s.x, y: s.y, opacity: 0.18 * dm, scale: 0.94 }}
                      animate={{
                        x: driftX,
                        y: driftY,
                        opacity: [0.14 * dm, 0.28 * dm, 0.22 * dm, 0.17 * dm],
                        rotate: 0,
                        scale: 0.94 + 0.04 * dm,
                      }}
                      transition={{
                        duration: s.dur * 2.35,
                        delay: s.delay * 0.5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    >
                      {s.text}
                    </motion.span>
                  );
                })}
              </div>
            )}

            <div className="absolute inset-0 z-[2] overflow-visible">
              {partActive.map((p) => (
                <div
                  key={p.id}
                  className="absolute rounded-full"
                  style={{
                    left: `${p.left}%`,
                    top: `${p.top}%`,
                    width: p.size,
                    height: p.size,
                    marginLeft: -p.size / 2,
                    marginTop: -p.size / 2,
                    background: p.hue === 'c' ? cyan : purple,
                    opacity: (isSignalMemory ? 0.38 : 1) *
                      (isConverge
                        ? Math.min(0.72, p.op * (0.55 + 0.45 * p.depth) * 2.4)
                        : p.op * (0.45 + 0.55 * p.depth)),
                    ...(isConverge || isSignalMemory
                      ? { animationName: 'none' }
                      : {
                          animationName: 'atl-orbit-32',
                          animationDuration: `${p.dur}s`,
                          animationTimingFunction: 'linear',
                          animationIterationCount: 'infinite',
                          animationDelay: `${p.delay}s`,
                        }),
                    transform: isConverge ? 'scale(1.15)' : undefined,
                    transition: 'opacity 0.45s ease, transform 0.75s cubic-bezier(0.22,1,0.36,1)',
                    willChange: 'transform',
                  }}
                />
              ))}
            </div>

            {!isConverge && !partitionedSignal && (
              <svg
                className="absolute inset-0 z-[3] h-full w-full overflow-visible"
                style={{
                  animationName: 'atl-line-pulse-strong',
                  animationDuration: '4.5s',
                  animationTimingFunction: 'ease-in-out',
                  animationIterationCount: 'infinite',
                }}
              >
                {lineIndices.map(([ia, ib], idx) => {
                  const sa = symActive[ia];
                  const sb = symActive[ib];
                  if (!sa || !sb) return null;
                  const x1 = CX + sa.x;
                  const y1 = CY + sa.y;
                  const x2 = CX + sb.x;
                  const y2 = CY + sb.y;
                  if (Math.hypot(x2 - x1, y2 - y1) > 200) return null;
                  const lineDepth = (sa.depth + sb.depth) * 0.5;
                  return (
                    <line
                      key={`ln-${idx}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={
                        isLight
                          ? `rgba(34,211,238,${0.1 + 0.14 * lineDepth})`
                          : `rgba(180,255,255,${0.12 + 0.2 * lineDepth})`
                      }
                      strokeWidth={0.55 + 0.35 * lineDepth}
                    />
                  );
                })}
              </svg>
            )}

            <div className="absolute inset-0 z-[4] flex items-center justify-center overflow-visible">
              {driftSymbols.map((s) => {
                const col = s.color === 'cyan' ? cyan : purple;
                const d = 0.42 + 0.58 * s.depth;
                const driftX = [s.x, s.x + s.ox, s.x - s.ox * 0.55, s.x];
                const driftY = [s.y, s.y + s.oy, s.y - s.oy * 0.5, s.y];
                const glowCyan = isLight
                  ? `0 0 14px rgba(255,255,255,0.45), 0 0 28px rgba(34,211,238,${0.35 * d})`
                  : `0 0 16px rgba(255,255,255,0.4), 0 0 36px rgba(120,252,255,${0.5 * d})`;
                const glowPurp = isLight
                  ? `0 0 14px rgba(255,255,255,0.4), 0 0 28px rgba(192,132,252,${0.32 * d})`
                  : `0 0 16px rgba(255,255,255,0.38), 0 0 34px rgba(216,180,254,${0.45 * d})`;
                return (
                  <motion.span
                    key={s.id}
                    className="absolute left-1/2 top-1/2 whitespace-nowrap font-mono text-[11px] font-bold leading-none md:text-xs"
                    style={{
                      color: col,
                      textShadow: isConverge
                        ? isLight
                          ? '0 0 20px rgba(255,255,255,0.65), 0 0 40px rgba(34,211,238,0.55)'
                          : '0 0 24px rgba(255,255,255,0.55), 0 0 48px rgba(180,255,255,0.5)'
                        : s.color === 'cyan'
                          ? glowCyan
                          : glowPurp,
                      filter: isConverge ? 'brightness(1.45)' : undefined,
                    }}
                    initial={{ x: s.x, y: s.y, opacity: 0.22 * d, scale: 0.82 + 0.1 * d }}
                    animate={
                      isConverge
                        ? {
                            x: 0,
                            y: 0,
                            opacity: 0,
                            scale: 1.52,
                          }
                        : {
                            x: driftX,
                            y: driftY,
                            opacity: [0.22 * d, 0.52 * d, 0.38 * d, 0.28 * d],
                            rotate: s.rotate ? [0, 9, -6, 0] : 0,
                            scale: [0.95 + 0.08 * d, 1.05 + 0.1 * d, 1 + 0.06 * d, 0.98 + 0.08 * d],
                          }
                    }
                    transition={
                      isConverge
                        ? { duration: 0.92, ease: [0.22, 1, 0.36, 1] }
                        : {
                            duration: s.dur * 0.88,
                            delay: s.delay,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }
                    }
                  >
                    {s.text}
                  </motion.span>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RESULTADO: memory collapse + multicolor burst */}
      <AnimatePresence>
        {isBurst && (
          <motion.div
            key="burst"
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            {collapseSymbols &&
              collapseSymbols.map((s) => {
                const col = s.color === 'cyan' ? cyan : purple;
                return (
                  <motion.span
                    key={`col-${s._mid}`}
                    className="absolute left-1/2 top-1/2 whitespace-nowrap font-mono text-[11px] font-bold"
                    style={{ color: col }}
                    initial={{ x: s.x, y: s.y, opacity: 0.35, scale: 1 }}
                    animate={{ x: 0, y: 0, opacity: 0, scale: 0.15 }}
                    transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {s.text}
                  </motion.span>
                );
              })}
            {burstParts.map((b) => {
              const dx = Math.cos(b.ang) * b.dist;
              const dy = Math.sin(b.ang) * b.dist;
              const fill =
                b.hue === 'c'
                  ? cyan
                  : b.hue === 'p'
                    ? purple
                    : b.hue === 'w'
                      ? isLight
                        ? 'rgb(248, 250, 252)'
                        : 'rgb(255, 255, 255)'
                      : 'rgb(251, 191, 36)';
              return (
                <motion.div
                  key={b.id}
                  className="absolute rounded-full"
                  style={{
                    width: b.size,
                    height: b.size,
                    marginLeft: -b.size / 2,
                    marginTop: -b.size / 2,
                    background: fill,
                    boxShadow: `0 0 ${b.size * 2}px ${fill}`,
                  }}
                  initial={{ x: 0, y: 0, opacity: 0.95, scale: 0.4 }}
                  animate={{ x: dx, y: dy, opacity: 0, scale: 1.2 }}
                  transition={{
                    duration: 0.62,
                    delay: b.delay,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
