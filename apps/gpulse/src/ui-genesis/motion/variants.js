/** Shared Framer Motion presets — AiGenesis “living” UI */

export const springSoft = { type: 'spring', stiffness: 420, damping: 28 };

export const hoverScale = {
  rest: { scale: 1 },
  hover: { scale: 1.02, transition: springSoft },
  tap: { scale: 0.98 },
};

export const fadeUpBlur = {
  hidden: { opacity: 0, y: 16, filter: 'blur(8px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

export const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};

/** Page cross-fade + slide between dashboard sections (~260ms) */
export const pageCrossfade = {
  initial: { opacity: 0, x: 14 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -10 },
  transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] },
};

export const modalBackdrop = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.25 } },
};

export const modalContent = {
  hidden: { opacity: 0, scale: 0.94, y: 12, filter: 'blur(10px)' },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 380, damping: 30 },
  },
};
