import React, { memo, useEffect, useRef } from 'react';

const VIDEO_SRC = '/hologram/goddess.mp4';
const MISSING_VIDEO_MESSAGE = 'Hologram video not found at /public/hologram/goddess.mp4';
const PLAYBACK_RATE = 0.4;

function HologramBackgroundInner() {
  const videoRef = useRef(/** @type {HTMLVideoElement | null} */ (null));
  const randomSeekDoneRef = useRef(false);

  const seekRandomStartOnce = () => {
    const el = videoRef.current;
    if (!el || randomSeekDoneRef.current) return;
    const d = el.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    randomSeekDoneRef.current = true;
    el.currentTime = Math.random() * d * 0.98;
  };

  const applyPlaybackRate = () => {
    const el = videoRef.current;
    if (el) el.playbackRate = PLAYBACK_RATE;
  };

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return undefined;

    const tryPlay = () => {
      applyPlaybackRate();
      const p = el.play();
      if (p !== undefined && typeof p.then === 'function') {
        p.catch(() => {});
      }
    };

    seekRandomStartOnce();
    tryPlay();

    if (el.readyState < 2) {
      const onCanPlay = () => {
        seekRandomStartOnce();
        applyPlaybackRate();
        tryPlay();
        el.removeEventListener('canplay', onCanPlay);
      };
      el.addEventListener('canplay', onCanPlay);
      return () => el.removeEventListener('canplay', onCanPlay);
    }
    return undefined;
  }, []);

  const handleCanPlay = () => {
    seekRandomStartOnce();
    applyPlaybackRate();
  };

  return (
    <div
      className="pointer-events-none"
      style={{ position: 'fixed', inset: 0, zIndex: -10 }}
      aria-hidden
    >
      <video
        ref={videoRef}
        className="animate-hologramBreathe"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        onLoadedMetadata={seekRandomStartOnce}
        onCanPlay={handleCanPlay}
        onError={() => {
          console.error(MISSING_VIDEO_MESSAGE);
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: 'hue-rotate(160deg) saturate(1.4) brightness(0.85)',
          mixBlendMode: 'screen',
        }}
      >
        <source src={VIDEO_SRC} type="video/mp4" />
      </video>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
      />
    </div>
  );
}

export const HologramBackground = memo(HologramBackgroundInner);
