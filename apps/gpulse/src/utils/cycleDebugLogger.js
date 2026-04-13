const cycles = new Map();

export function logCycleEvent(type, payload) {
  const key =
    payload?.correlationKey ||
    payload?.mesa + '|' + payload?.round ||
    'unknown';

  if (!cycles.has(key)) {
    cycles.set(key, { events: [], counters: {} });
  }

  const cycle = cycles.get(key);

  const entry = {
    ts: Date.now(),
    type,
    data: payload,
  };

  cycle.events.push(entry);
  cycle.counters[type] = (cycle.counters[type] || 0) + 1;

  console.log(`📊 [CYCLE ${key}]`, {
    type,
    count: cycle.counters[type],
  });
}

export function summarizeCycle(key) {
  const cycle = cycles.get(key);
  if (!cycle) return;

  console.log('🧾 CYCLE SUMMARY', key, {
    totalEvents: cycle.events.length,
    counters: cycle.counters,
  });
}

export function dumpCycle(key) {
  const cycle = cycles.get(key);
  console.log('🧾 FULL CYCLE', key, cycle);
}

export function dumpAllCycles() {
  console.log('🧾 ALL CYCLES', Array.from(cycles.entries()));
}
