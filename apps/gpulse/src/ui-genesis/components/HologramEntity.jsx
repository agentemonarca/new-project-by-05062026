import React, { memo } from 'react';

const VIDEO_SRC = '/hologram/goddess.mp4';

/** Readable figure: lifted brightness + system hue (does not over-fade silhouette) */
const ENTITY_VIDEO_FILTER =
  'hue-rotate(200deg) saturate(1.65) brightness(0.9) contrast(1.05)';

/**
 * Soft radial mask — long smooth ramps, no hard stops; fades to clear only at 100%.
 * Keeps full figure visible while dissolving into the scene at the rim.
 */
const ENTITY_MASK =
  'radial-gradient(ellipse 78% 68% at 47% 43%, #000 0%, rgba(0,0,0,0.99) 16%, rgba(0,0,0,0.95) 28%, rgba(0,0,0,0.86) 40%, rgba(0,0,0,0.68) 52%, rgba(0,0,0,0.44) 66%, rgba(0,0,0,0.22) 78%, rgba(0,0,0,0.08) 88%, rgba(0,0,0,0.02) 96%, transparent 100%)';

/** Ambient AiGenesis wash — mid radii stay gentle so the body reads */
const SYSTEM_TINT_GRADIENT =
  'radial-gradient(ellipse 88% 78% at 44% 41%, rgba(14,165,233,0.14) 0%, rgba(99,102,241,0.16) 45%, rgba(99,102,241,0.06) 72%, transparent 100%)';

/** Tight luminous core — emotional anchor; color-dodge adds energy bloom */
const INNER_CORE_GLOW =
  'radial-gradient(ellipse 36% 42% at 48% 44%, rgba(224,242,254,0.65) 0%, rgba(186,230,253,0.42) 28%, rgba(165,180,252,0.28) 48%, rgba(99,102,241,0.08) 68%, transparent 82%)';

function HologramEntityInner() {
  return (
    <div
      className="pointer-events-none fixed z-[1]"
      style={{
        left: '60%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      }}
      aria-hidden
    >
      <div
        className="origin-center will-change-[transform,opacity] animate-hologramEntityPresence"
        style={{
          mixBlendMode: 'screen',
        }}
      >
        <div
          className="relative"
          style={{
            filter: 'blur(1.5px)',
            WebkitMaskImage: ENTITY_MASK,
            maskImage: ENTITY_MASK,
            WebkitMaskSize: '100% 100%',
            maskSize: '100% 100%',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
          }}
        >
          <video
            className="h-[min(70vh,600px)] w-[min(74vw,500px)] max-w-[92vw] object-cover"
            style={{
              filter: ENTITY_VIDEO_FILTER,
            }}
            src={VIDEO_SRC}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: SYSTEM_TINT_GRADIENT,
              mixBlendMode: 'screen',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 will-change-[opacity,filter] animate-hologramEntityCorePulse"
            style={{
              background: INNER_CORE_GLOW,
              mixBlendMode: 'color-dodge',
            }}
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}

export const HologramEntity = memo(HologramEntityInner);
