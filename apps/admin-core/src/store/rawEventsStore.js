/** @type {Record<string, number>} */
let counters = {};
/** @type {Array<{ eventName: string, type: string, payload: unknown }>} */
let events = [];
/** @type {Array<() => void>} */
let listeners = [];

/**
 * @param {string} eventName
 * @param {unknown} payload
 */
export function addRawEvent(eventName, payload) {
  counters[eventName] = (counters[eventName] || 0) + 1;

  const type =
    /** @type {any} */ (payload)?.type != null
      ? String(/** @type {any} */ (payload).type)
      : /** @type {any} */ (payload)?.data?.type != null
        ? String(/** @type {any} */ (payload).data.type)
        : 'UNKNOWN';

  counters[type] = (counters[type] || 0) + 1;

  events.unshift({
    eventName,
    type,
    payload,
  });

  events = events.slice(0, 50);

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
