/**
 * Etiquetas UI para estados del motor (solo lectura / presentación).
 */
export const mapState = (state) =>
  ({
    IDLE: 'STANDBY',
    SIGNAL_DETECTED: 'SEÑAL DETECTADA',
    SIGNAL_VALIDATING: 'VALIDANDO',
    SIGNAL_ACTIVE: 'SEÑAL ACTIVA',
    BETTING_WINDOW: 'APUESTAS ABIERTAS',
    BET_CLOSED: 'APUESTAS CERRADAS',
    DEALING: 'LANZANDO CARTAS',
    RESULT_RECEIVED: 'RESULTADO RECIBIDO',
    RESULT_PROCESSED: 'RESULTADO PROCESADO',
    COOLDOWN: 'ENFRIAMIENTO',
  }[state] || '—');
