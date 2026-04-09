/** @type {Record<string, number>} */
let counters = {};
/** @type {Array<{ eventName: string, type: string, payload: unknown, receivedAt: number }>} */
let events = [];
const MAX_EVENTS = 100;
/** @type {Array<() => void>} */
let listeners = [];

/**
 * @param {string} eventName
 * @param {unknown} payload
 */
export function addRawEvent(eventName, payload) {
  counters[eventName] = (counters[eventName] || 0) + 1;

  const p = /** @type {any} */ (payload);
  const type =
    p?.type != null
      ? String(p.type)
      : p?.eventName != null
        ? String(p.eventName)
        : p?.data?.type != null
          ? String(p.data.type)
          : p?.data?.eventName != null
            ? String(p.data.eventName)
            : 'UNKNOWN';

  counters[type] = (counters[type] || 0) + 1;

  events.unshift({
    eventName,
    type,
    payload,
    receivedAt: Date.now(),
  });

  events = events.slice(0, MAX_EVENTS);

  listeners.forEach((fn) => fn());
}

/** @returns {{ counters: Record<string, number>, events: typeof events }} */
export function getRawStats() {
  return {
    counters: { ...counters },
    events: [...events],
  };
}

/** @param {() => void} fn */
export function subscribe(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((f) => f !== fn);
  };
}

export function clearRawEvents() {
  counters = {};
  events = [];
  listeners.forEach((fn) => fn());
}
