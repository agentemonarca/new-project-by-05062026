import {
  MESSAGE_SOURCE_BACKOFFICE,
  MESSAGE_SOURCE_GPULSE,
  MessageType,
  STORAGE_KEYS,
} from '@ai-genesis/config';

type GpulseStrategy = 'speed' | 'balanced' | 'protection';

function isStrategy(x: unknown): x is GpulseStrategy {
  return x === 'speed' || x === 'balanced' || x === 'protection';
}

export type GpulseControlMirror = {
  lastEngine?: 'start' | 'pause';
  strategy?: GpulseStrategy;
  safeMode?: boolean;
  updatedAt: number;
};

function readMirror(): GpulseControlMirror {
  const w = window as Window & { __GPULSE_CONTROL_MIRROR__?: GpulseControlMirror };
  return { ...(w.__GPULSE_CONTROL_MIRROR__ ?? {}), updatedAt: Date.now() };
}

function writeMirror(next: GpulseControlMirror) {
  const w = window as Window & { __GPULSE_CONTROL_MIRROR__?: GpulseControlMirror };
  w.__GPULSE_CONTROL_MIRROR__ = next;
  window.dispatchEvent(new CustomEvent('ai-genesis-control', { detail: next }));
}

function applyAuthPayload(payload: { token: unknown; user: unknown }) {
  const { token, user } = payload;
  try {
    if (token != null) localStorage.setItem(STORAGE_KEYS.TOKEN, String(token));
    else localStorage.removeItem(STORAGE_KEYS.TOKEN);
    if (user != null) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEYS.USER);
  } catch {
    /* quota / private mode */
  }
  window.dispatchEvent(new CustomEvent('ai-genesis-auth-sync', { detail: payload }));
}

function handleControlPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return;
  const p = payload as Record<string, unknown>;
  const next = readMirror();

  if (p.action === 'engine') {
    const ea = p.engineAction;
    if (ea === 'start' || ea === 'pause') {
      next.lastEngine = ea;
      console.info('[G-Pulse] CONTROL engine', ea);
    }
  } else if (p.action === 'strategy' && isStrategy(p.value)) {
    next.strategy = p.value;
    console.info('[G-Pulse] CONTROL strategy', p.value);
  } else if (p.action === 'safety' && typeof p.enabled === 'boolean') {
    next.safeMode = p.enabled;
    console.info('[G-Pulse] CONTROL safety', p.enabled);
  }

  next.updatedAt = Date.now();
  writeMirror(next);
}

/**
 * Parent Backoffice → G-Pulse: AUTH_SYNC, PING, CONTROL. Child responds with PONG.
 */
export function installBackofficeAuthSync(): () => void {
  if (typeof window === 'undefined') return () => {};

  const onMessage = (event: MessageEvent) => {
    if (event.source !== window.parent) return;
    const data = event.data as Record<string, unknown> | null;
    if (!data || typeof data !== 'object') return;

    if (data.type === MessageType.AUTH_SYNC) {
      if (data.source && data.source !== MESSAGE_SOURCE_BACKOFFICE) return;
      applyAuthPayload({ token: data.token, user: data.user });
      return;
    }

    if (data.type === MessageType.PING) {
      const targetOrigin =
        typeof event.origin === 'string' && event.origin.length ? event.origin : '*';
      (event.source as Window | null)?.postMessage(
        {
          type: MessageType.PONG,
          source: MESSAGE_SOURCE_GPULSE,
          ts: Date.now(),
          pingTs: data.ts,
        },
        targetOrigin,
      );
      return;
    }

    if (data.type === MessageType.CONTROL) {
      if (data.source && data.source !== MESSAGE_SOURCE_BACKOFFICE) return;
      handleControlPayload(data.payload);
    }
  };

  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}
