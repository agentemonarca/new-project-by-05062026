import { useEffect } from 'react';
import { connectGpulseRealtimeWs } from '@/lib/wsClient';

/** Mount once: WebSocket client for live execution state from api-gateway. */
export default function RealtimeWsBridge() {
  useEffect(() => connectGpulseRealtimeWs(), []);
  return null;
}
