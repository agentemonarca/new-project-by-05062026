import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGenesisStore, emit } from '@ai-genesis/state';
import {
  MessageType,
  MESSAGE_SOURCE_BACKOFFICE,
  MESSAGE_SOURCE_GPULSE,
  STORAGE_KEYS,
} from '@ai-genesis/config';
import { getEnv } from '@/config/env';
import { setGpulseIframeTarget } from '@/system/gpulseIframeRegistry';
import type { GenesisUser } from '@ai-genesis/types';

const HANDSHAKE_TIMEOUT_MS = 6000;

function persistSharedAuth(token: string | null, user: GenesisUser | null) {
  try {
    if (token) localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    else localStorage.removeItem(STORAGE_KEYS.TOKEN);
    if (user) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEYS.USER);
  } catch {
    /* private mode */
  }
}

/**
 * G-Pulse iframe: AUTH on load, event-driven PING/PONG handshake, timeout fallback.
 */
export default function GPulseWrapper() {
  const { gpulseOrigin } = getEnv();
  const gpulseTargetOrigin = new URL(gpulseOrigin).origin;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pingSentAt = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const token = useGenesisStore((s) => s.token);
  const user = useGenesisStore((s) => s.user);
  const setGpulseSlice = useGenesisStore((s) => s.setGpulseSlice);

  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [showFrame, setShowFrame] = useState(false);

  const clearHandshakeTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const sendAuth = useCallback(
    (target: Window | null) => {
      if (!target) return;
      const payload = {
        type: MessageType.AUTH_SYNC,
        token,
        user,
        source: MESSAGE_SOURCE_BACKOFFICE,
        ts: Date.now(),
      };
      persistSharedAuth(token, user);
      target.postMessage(payload, gpulseTargetOrigin);
    },
    [gpulseTargetOrigin, token, user],
  );

  const sendPing = useCallback(
    (target: Window | null) => {
      if (!target) return;
      pingSentAt.current = Date.now();
      setGpulseSlice({ status: 'syncing' });
      target.postMessage(
        {
          type: MessageType.PING,
          source: MESSAGE_SOURCE_BACKOFFICE,
          ts: pingSentAt.current,
        },
        gpulseTargetOrigin,
      );

      clearHandshakeTimer();
      timeoutRef.current = setTimeout(() => {
        setGpulseSlice({ connected: false, status: 'idle' });
        emit('gpulse:handshake', { ok: false });
        timeoutRef.current = null;
      }, HANDSHAKE_TIMEOUT_MS);
    },
    [clearHandshakeTimer, gpulseTargetOrigin, setGpulseSlice],
  );

  const runHandshake = useCallback(
    (target: Window | null) => {
      sendAuth(target);
      sendPing(target);
    },
    [sendAuth, sendPing],
  );

  useEffect(() => {
    runHandshake(iframeRef.current?.contentWindow ?? null);
  }, [runHandshake, token, user]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== gpulseTargetOrigin) return;
      const data = event.data as Record<string, unknown> | null;
      if (!data || typeof data !== 'object') return;
      if (data.type !== MessageType.PONG) return;
      if (data.source && data.source !== MESSAGE_SOURCE_GPULSE) return;

      clearHandshakeTimer();
      const now = Date.now();
      const pingTs = Number(data.pingTs) || pingSentAt.current;
      const latencyMs = Math.max(0, now - pingTs);
      const prevStatus = useGenesisStore.getState().gpulse.status;
      setGpulseSlice({
        connected: true,
        lastSync: now,
        status: prevStatus === 'paused' ? 'paused' : 'running',
      });
      emit('gpulse:handshake', { ok: true, latencyMs });
    };

    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      clearHandshakeTimer();
    };
  }, [clearHandshakeTimer, gpulseTargetOrigin, setGpulseSlice]);

  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState !== 'visible') return;
      runHandshake(iframeRef.current?.contentWindow ?? null);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [runHandshake]);

  useEffect(() => {
    return () => {
      clearHandshakeTimer();
      setGpulseSlice({ connected: false, status: 'idle' });
    };
  }, [clearHandshakeTimer, setGpulseSlice]);

  useEffect(() => {
    if (!iframeLoaded) {
      setGpulseIframeTarget(null);
      return;
    }
    const id = window.requestAnimationFrame(() => {
      setGpulseIframeTarget(iframeRef.current?.contentWindow ?? null);
    });
    return () => {
      window.cancelAnimationFrame(id);
      setGpulseIframeTarget(null);
    };
  }, [iframeLoaded]);

  const onLoad = () => {
    setIframeLoaded(true);
    window.requestAnimationFrame(() => {
      setShowFrame(true);
      setGpulseIframeTarget(iframeRef.current?.contentWindow ?? null);
    });
    const w = iframeRef.current?.contentWindow ?? null;
    runHandshake(w);
  };

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full bg-[#070b14]">
      <AnimatePresence>
        {!iframeLoaded ? (
          <motion.div
            key="loading"
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#070b14]/95 backdrop-blur-md"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400"
              style={{ boxShadow: '0 0 24px rgba(0, 240, 255, 0.25)' }}
            />
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/45">
              Initializing G-Pulse
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div
        className="h-full w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: showFrame ? 1 : 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <iframe
          ref={iframeRef}
          title="G-Pulse"
          src={gpulseOrigin}
          className="h-full w-full border-0"
          onLoad={onLoad}
          allow="clipboard-read; clipboard-write; payment"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
        />
      </motion.div>
    </div>
  );
}
