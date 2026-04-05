export function createLogger() {
  const base = () => ({ at: new Date().toISOString() });

  return {
    metric(name, fields) {
      console.log(JSON.stringify({ level: 'metric', name, ...base(), ...(fields || {}) }));
    },
    info(msg, meta) {
      console.log(JSON.stringify({ level: 'info', msg, ...base(), ...(meta || {}) }));
    },
    warn(msg, meta) {
      console.warn(JSON.stringify({ level: 'warn', msg, ...base(), ...(meta || {}) }));
    },
    error(msg, meta) {
      console.error(JSON.stringify({ level: 'error', msg, ...base(), ...(meta || {}) }));
    },
  };
}

