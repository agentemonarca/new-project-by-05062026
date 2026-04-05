import { useEffect } from 'react';
import { subscribe } from '@ai-genesis/state';
import { MessageType, MESSAGE_SOURCE_BACKOFFICE } from '@ai-genesis/config';
import { getEnv } from '@/config/env';
import { getGpulseIframeTarget } from './gpulseIframeRegistry';

/**
 * Subscribes to control-plane events and forwards them to the G-Pulse iframe via postMessage.
 * Must stay mounted while the app runs (mounted from App).
 */
export default function GpulseControlRelay() {
  const { gpulseOrigin } = getEnv();
  const targetOrigin = new URL(gpulseOrigin).origin;

  useEffect(() => {
    const postControl = (payload: Record<string, unknown>) => {
      const win = getGpulseIframeTarget();
      if (!win) return;
      win.postMessage(
        {
          type: MessageType.CONTROL,
          source: MESSAGE_SOURCE_BACKOFFICE,
          payload,
          ts: Date.now(),
        },
        targetOrigin,
      );
    };

    const u1 = subscribe('gpulse:control', (p) => {
      postControl({ action: 'engine', engineAction: p.action });
    });
    const u2 = subscribe('gpulse:strategy', (p) => {
      postControl({ action: 'strategy', value: p.value });
    });
    const u3 = subscribe('gpulse:safety', (p) => {
      postControl({ action: 'safety', enabled: p.enabled });
    });

    return () => {
      u1();
      u2();
      u3();
    };
  }, [targetOrigin]);

  return null;
}
