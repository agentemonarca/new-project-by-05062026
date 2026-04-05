import { getEnv } from '@/config/env';
import type { GpulseRuntimeStatus, GpulseStrategy } from '@ai-genesis/state';

function apiOrigin(): string {
  if (import.meta.env.DEV) return '';
  return (getEnv().apiGatewayUrl || '').replace(/\/$/, '');
}

export type GpulseApiStatus = {
  engine: 'idle' | 'running' | 'paused';
  strategy: GpulseStrategy;
  safeMode: boolean;
  autoMode?: boolean;
  modelConfidence?: number;
};

export type GpulseApiResponse = {
  success?: boolean;
  status?: GpulseApiStatus;
  timestamp?: number;
  error?: string;
};

export function mapEngineToStatus(engine: string): GpulseRuntimeStatus {
  if (engine === 'running') return 'running';
  if (engine === 'paused') return 'paused';
  return 'idle';
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const t = await res.text();
  if (!t) return {};
  try {
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    return { raw: t };
  }
}

export async function postGpulseControl(action: 'start' | 'pause'): Promise<{
  ok: boolean;
  latencyMs: number;
  data: GpulseApiResponse;
}> {
  const t0 = performance.now();
  const res = await fetch(`${apiOrigin()}/api/gpulse/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  const latencyMs = Math.round(performance.now() - t0);
  const data = (await parseJson(res)) as unknown as GpulseApiResponse;
  return { ok: res.ok, latencyMs, data };
}

export async function postGpulseStrategy(value: GpulseStrategy): Promise<{
  ok: boolean;
  latencyMs: number;
  data: GpulseApiResponse;
}> {
  const t0 = performance.now();
  const res = await fetch(`${apiOrigin()}/api/gpulse/strategy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
  const latencyMs = Math.round(performance.now() - t0);
  const data = (await parseJson(res)) as unknown as GpulseApiResponse;
  return { ok: res.ok, latencyMs, data };
}

export async function postGpulseSafety(enabled: boolean): Promise<{
  ok: boolean;
  latencyMs: number;
  data: GpulseApiResponse;
}> {
  const t0 = performance.now();
  const res = await fetch(`${apiOrigin()}/api/gpulse/safety`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  const latencyMs = Math.round(performance.now() - t0);
  const data = (await parseJson(res)) as unknown as GpulseApiResponse;
  return { ok: res.ok, latencyMs, data };
}

export async function postGpulseAuto(enabled: boolean): Promise<{
  ok: boolean;
  latencyMs: number;
  data: GpulseApiResponse;
}> {
  const t0 = performance.now();
  const res = await fetch(`${apiOrigin()}/api/gpulse/auto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  const latencyMs = Math.round(performance.now() - t0);
  const data = (await parseJson(res)) as unknown as GpulseApiResponse;
  return { ok: res.ok, latencyMs, data };
}
