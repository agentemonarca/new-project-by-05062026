import { describe, expect, it } from 'vitest';
import { unwrapLiveFrameMessage } from './adminSignalFrameUnwrap.js';

describe('unwrapLiveFrameMessage', () => {
  it('relay: usa payload plano', () => {
    const msg = {
      type: 'NEW_SIGNAL',
      payload: { mesa: 'T1', correlationKey: 'id:1', round: '' },
    };
    const { eventType, row } = unwrapLiveFrameMessage(msg);
    expect(eventType).toBe('NEW_SIGNAL');
    expect(row.mesa).toBe('T1');
    expect(row.correlationKey).toBe('id:1');
  });

  it('marco interpretado: layers.raw + eventName', () => {
    const msg = {
      eventName: 'NEW_SIGNAL',
      layers: {
        raw: { mesa: 'Baccarat 9', correlationKey: 'id:1775684033582', round: '' },
      },
    };
    const { eventType, row } = unwrapLiveFrameMessage(msg);
    expect(eventType).toBe('NEW_SIGNAL');
    expect(row.mesa).toBe('Baccarat 9');
    expect(row.correlationKey).toBe('id:1775684033582');
  });

  it('si hay payload y raw válido, prioriza raw', () => {
    const msg = {
      type: 'NEW_SIGNAL',
      payload: { mesa: 'stale' },
      layers: { raw: { mesa: 'from-raw', correlationKey: 'id:x' } },
    };
    const { row } = unwrapLiveFrameMessage(msg);
    expect(row.mesa).toBe('from-raw');
  });

  it('mensaje vacío → row vacío', () => {
    expect(unwrapLiveFrameMessage(null).row).toEqual({});
    expect(Object.keys(unwrapLiveFrameMessage({}).row)).toHaveLength(0);
  });
});
