/**
 * Etiquetas y fase de proceso para eventos del socket / rawEvents del ciclo.
 * Cubre envoltorios tipo { type, data } y dashboardUpdate con data.type anidado.
 */

const DISPLAY = {
  NEW_SIGNAL: 'Nueva señal',
  NEW_RESULT: 'Resultado',
  DASHBOARDUPDATE: 'Actualización panel',
  SIGNAL_STREAM_FRAME: 'Frame stream',
  ADMIN_SIGNAL_FRAME: 'Frame admin',
  UNKNOWN: 'Evento',
};

const PHASE = {
  NEW_SIGNAL: 'Apertura · esperando resultado',
  NEW_RESULT: 'Cierre · correlación y liquidación',
  DASHBOARDUPDATE: 'Transporte panel',
  SIGNAL_STREAM_FRAME: 'Transporte stream',
  ADMIN_SIGNAL_FRAME: 'Transporte admin',
  UNKNOWN: '—',
};

function upper(s) {
  return String(s ?? '').trim().toUpperCase();
}

/**
 * Tipo de negocio o transporte unificado (para colores y logs).
 */
export function resolveSocketEventKind(ev) {
  if (ev == null) return 'UNKNOWN';
  const top = upper(ev.type);
  const data = ev.data;
  const dataObj = data != null && typeof data === 'object' && !Array.isArray(data) ? data : null;

  if (top === 'DASHBOARDUPDATE' && dataObj) {
    const inner = upper(dataObj.type ?? dataObj.tipo ?? dataObj.payloadType);
    if (inner === 'NEW_SIGNAL' || inner === 'NEW_RESULT') return inner;
    if (inner) return inner;
  }

  if (top === 'NEW_SIGNAL' || top === 'NEW_RESULT') return top;

  if (dataObj) {
    const inner = upper(dataObj.type ?? dataObj.tipo);
    if (inner === 'NEW_SIGNAL' || inner === 'NEW_RESULT') return inner;
  }

  if (top) return top;
  return 'UNKNOWN';
}

/**
 * @returns {{ kind: string, displayName: string, processPhase: string }}
 */
export function describeSocketEvent(ev) {
  const kind = resolveSocketEventKind(ev);
  const displayName = DISPLAY[kind] ?? (kind.replace(/_/g, ' ') || DISPLAY.UNKNOWN);
  const processPhase = PHASE[kind] ?? PHASE.UNKNOWN;
  return { kind, displayName, processPhase };
}

/**
 * Etiqueta corta del estado del motor (UI en español).
 */
export const ENGINE_STATE_LABELS = {
  IDLE: 'En espera',
  SIGNAL_DETECTED: 'Señal detectada',
  SIGNAL_VALIDATING: 'Validando',
  SIGNAL_ACTIVE: 'Señal activa',
  BETTING_WINDOW: 'Ventana apuesta',
  DEALING: 'Reparto',
  WAITING_RESULT: 'Esperando resultado (proveedor)',
  RESULT_RECEIVED: 'Resultado recibido',
  RESULT_PROCESSED: 'Resultado procesado',
  COOLDOWN: 'Enfriamiento',
};

export function engineStateLabel(state) {
  return ENGINE_STATE_LABELS[state] ?? String(state ?? '—');
}
