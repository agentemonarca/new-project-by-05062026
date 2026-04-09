import { ALERT_TYPES } from '../store/useAlertStore.js';
import { extractNestedMesaInfo } from './supplierIntelExtract.js';
import { enrichAlertForDisplay } from './alertContextEnrichment.js';
import { resyncQualityPresentation } from './resyncQuality.js';

/** @param {unknown} raw */
export function extractPayloadForensics(raw) {
  if (raw == null || typeof raw !== 'object') {
    return {
      ganador: null,
      cartas_player: null,
      cartas_banker: null,
      puntaje_player: null,
      puntaje_banker: null,
      puntajes: null,
      martingala: null,
    };
  }
  const p = /** @type {Record<string, unknown>} */ (raw);
  const mi = extractNestedMesaInfo(raw) ?? (p.mesa_info != null && typeof p.mesa_info === 'object' ? p.mesa_info : null);
  const m = mi && typeof mi === 'object' && !Array.isArray(mi) ? /** @type {Record<string, unknown>} */ (mi) : {};
  const mg = m.martingala ?? m.martingale;
  const puntaje_player = p.puntaje_player ?? m.puntaje_player ?? null;
  const puntaje_banker = p.puntaje_banker ?? m.puntaje_banker ?? null;
  return {
    ganador: p.ganador ?? m.ganador ?? null,
    cartas_player: m.cartas_player ?? null,
    cartas_banker: m.cartas_banker ?? null,
    puntaje_player,
    puntaje_banker,
    puntajes:
      p.puntajes != null && typeof p.puntajes === 'object'
        ? p.puntajes
        : { player: puntaje_player, banker: puntaje_banker },
    martingala: mg != null && typeof mg === 'object' ? mg : mg,
  };
}

/** @param {Record<string, unknown>} f */
export function isForensicsDataComplete(f) {
  if (f == null || typeof f !== 'object') return false;
  const cp = f.cartas_player;
  const cb = f.cartas_banker;
  const cardsOk = Array.isArray(cp) && cp.length > 0 && Array.isArray(cb) && cb.length > 0;
  const pp = f.puntaje_player;
  const pb = f.puntaje_banker;
  const scoresOk =
    pp != null && String(pp).trim() !== '' && pb != null && String(pb).trim() !== '';
  return Boolean(cardsOk && scoresOk);
}

/**
 * @param {string} causa
 * @param {string} explicacion
 */
function pi(causa, explicacion) {
  return { causa, explicacion };
}

const PASOS_ACCION = {
  warmup:
    'Modo warmup: reconectar el lab, activar Debug logs en la barra operativa y observar 1–2 ciclos sin operar.',
  correlationKey:
    'Validar correlationKey: mismo valor en NEW_SIGNAL y NEW_RESULT (traza admin-core + core-api /admin-signals).',
  backendLog:
    'Backend: activar o subir logging estructurado por evento (mesa, round, correlationKey, payload resumido).',
};

/**
 * @param {string} t
 * @param {boolean} streamMsg
 * @param {Record<string, unknown>} forensics
 * @param {'info'|'warning'|'error'} severity
 */
function buildImpacto(t, streamMsg, forensics, severity) {
  const dataOk = isForensicsDataComplete(forensics);
  const hasPayload = forensics && Object.keys(forensics).some((k) => forensics[k] != null);

  let ciclo = 'Estado del ciclo no clasificado; revisar tipo de alerta.';
  if (t === ALERT_TYPES.RESULTADO_SIN_SEÑAL || (t.includes('RESULTADO') && t.includes('SIN'))) {
    ciclo = streamMsg
      ? 'Ciclo stream inválido: resultado sin fila de señal (huérfano).'
      : 'Ciclo lab inválido: resultado sin señal activa coherente.';
  } else if (t === ALERT_TYPES.SEÑAL_BLOQUEADA) {
    ciclo = 'Ciclo aún abierto en mesa: la nueva señal no entra hasta cerrar el anterior.';
  } else if (t === ALERT_TYPES.ROUND_CORREGIDO) {
    ciclo = 'Ciclo recuperable: round alineado por middleware; coherencia parcial hasta validar proveedor.';
  } else if (t === ALERT_TYPES.STREAM_INTERRUPTED) {
    ciclo =
      'Ciclo en espera prolongada: el stream no cerró en el umbral; el laboratorio sigue escuchando sin reset forzado.';
  } else if (t === ALERT_TYPES.DELAY_FUERA_DE_RANGO) {
    ciclo =
      'Ciclo con retardo real señal→resultado por encima del umbral adaptativo observado para la mesa.';
  } else if (t === ALERT_TYPES.LAB_TIMEOUT || t === ALERT_TYPES.STREAM_TIMEOUT) {
    ciclo = 'Ciclo interrumpido o fuera de tiempo: no se completó el par señal→resultado esperado.';
  } else if (t === ALERT_TYPES.CICLO_INCOMPLETO || t.includes('INCOMPLETO')) {
    ciclo = 'Ciclo marcado incompleto: hay incoherencias entre lab, stream o tiempos.';
  } else if (severity === 'error') {
    ciclo = 'Ciclo en estado de error operativo; tratar como no válido para decisión automática.';
  } else {
    ciclo = 'Ciclo bajo revisión manual según severidad y mensaje.';
  }

  let datos = 'Confianza en datos: media — contrastar con panel de validación y stream.';
  if (!hasPayload) {
    datos = 'Confianza en datos: baja — casi sin campos en payload; no basar apuestas solo en este evento.';
  } else if (!dataOk) {
    datos = 'Confianza en datos: media-baja — faltan cartas o puntajes; el proveedor no envió el paquete completo.';
  } else {
    datos = 'Confianza en datos: según cartas/puntajes presentes, el fragmento es coherente (sigue dependiendo del tipo de alerta).';
  }

  const mg = forensics?.martingala;
  let martingalaForecast = 'Martingala / forecast: sin datos en payload — vectores pueden quedar desalineados.';
  if (mg != null && typeof mg === 'object' && !Array.isArray(mg) && Object.keys(mg).length > 0) {
    martingalaForecast =
      'Martingala / forecast: datos presentes — validar active/paso/vectores contra ganador antes de confiar en pronóstico.';
  } else if (mg != null) {
    martingalaForecast = 'Martingala / forecast: valor escalar o formato inesperado — revisar mesa_info en proveedor.';
  }

  return { ciclo, datos, martingalaForecast };
}

/**
 * @param {string[]} pasosExtra
 */
function pasosAccion(...pasosExtra) {
  const core = [PASOS_ACCION.warmup, PASOS_ACCION.correlationKey, PASOS_ACCION.backendLog];
  return [...pasosExtra.filter(Boolean), ...core].filter((s, i, a) => a.indexOf(s) === i);
}

const TRACES = {
  [ALERT_TYPES.RESULTADO_SIN_SEÑAL]: [
    'useLabSocket.handleResult',
    'useSignalMiddleware.handleResult',
    'useValidationStore.logValidationAnomaly',
    'useAlertStore.pushAlert',
  ],
  streamResultadoSinSeñal: [
    'useLabSocket.onNewResult',
    'useValidationStore.recordStreamResult',
    'useAlertStore.pushAlert · RESULTADO SIN SEÑAL (stream)',
  ],
  [ALERT_TYPES.SEÑAL_BLOQUEADA]: [
    'useLabSocket.onNewSignal',
    'useSignalMiddleware.handleSignal',
    'useValidationStore.logValidationBlocked',
  ],
  [ALERT_TYPES.ROUND_CORREGIDO]: [
    'useSignalMiddleware.handleResult',
    'useLabStore.setResult',
    'recordLabCycleEnd',
    'useValidationStore.pushAlert',
  ],
  [ALERT_TYPES.DELAY_FUERA_DE_RANGO]: [
    'useSignalMiddleware.handleResult',
    'recordLabCycleEnd',
    'pushAlert · DELAY_FUERA_DE_RANGO',
  ],
  [ALERT_TYPES.LAB_TIMEOUT]: [
    'useSignalMiddleware.handleResult',
    'recordLabCycleEnd',
    'pushAlert · LAB_TIMEOUT',
  ],
  [ALERT_TYPES.STREAM_TIMEOUT]: [
    'useValidationStore.handleStreamCycleTimeout',
    'setTimeout (MAX_CYCLE_DURATION_MS)',
    'pushAlert · STREAM_TIMEOUT',
  ],
  [ALERT_TYPES.STREAM_INTERRUPTED]: [
    'useValidationStore.handleStreamCycleTimeout',
    'useLabStore.enterStreamInterrupted',
    'pushAlert · STREAM_INTERRUPTED (info)',
  ],
  [ALERT_TYPES.STREAM_DELAY_EXPECTED]: [
    'useValidationStore.scheduleDelayExpectedHint',
    'setTimeout (~avgDelay stream)',
    'pushAlert · STREAM_DELAY_EXPECTED (info)',
  ],
  [ALERT_TYPES.CICLO_INCOMPLETO]: [
    'recordLabCycleEnd',
    'useValidationStore.pushLog',
    'pushAlert · CICLO_INCOMPLETO',
  ],
  [ALERT_TYPES.CICLO_RECUPERADO]: [
    'useSignalMiddleware.handleResult',
    'markGpulseLabAutoResync',
    'recordLabCycleEnd · COMPLETE_RESYNC',
  ],
  default: ['useLabSocket', 'middleware / validation', 'useAlertStore.pushAlert'],
};

function traceForType(type) {
  const t = String(type);
  if (t === ALERT_TYPES.RESULTADO_SIN_SEÑAL) return TRACES[ALERT_TYPES.RESULTADO_SIN_SEÑAL];
  if (t.includes('RESULTADO SIN') && t.includes('Stream')) return TRACES.streamResultadoSinSeñal;
  if (t === ALERT_TYPES.STREAM_DELAY_EXPECTED) return TRACES[ALERT_TYPES.STREAM_DELAY_EXPECTED];
  if (TRACES[t]) return TRACES[t];
  return TRACES.default;
}

/**
 * Forensic narrative + trace for GPulse Lab alerts (operator + developer).
 * @param {{ type?: string, message?: string, mesa?: unknown, round?: unknown, timestamp?: number, rawPayload?: unknown, context?: object }} alert
 */
export function generateAlertAnalysis(alert) {
  const enriched = enrichAlertForDisplay(alert);
  const forensics = extractPayloadForensics(alert.rawPayload);
  const data = {
    forensics,
    context: enriched,
  };
  const trace = traceForType(alert.type);
  const cuando = alert.timestamp != null ? new Date(alert.timestamp).toLocaleString() : '—';
  const donde = {
    mesa: alert.mesa != null ? String(alert.mesa) : '—',
    round: alert.round != null ? String(alert.round) : '—',
    summary: `Mesa ${alert.mesa ?? '—'} · Round ${alert.round ?? '—'} · correlationKey ${enriched.correlationKey ?? '—'}`,
  };

  const base = {
    cuando,
    donde,
    data,
    rutaTecnica: trace,
    dondeBuscar: [
      'apps/admin-core/src/gpulse-lab/hooks/useLabSocket.js',
      'apps/admin-core/src/gpulse-lab/middleware/useSignalMiddleware.js',
      'apps/admin-core/src/gpulse-lab/store/useValidationStore.js',
      'backend/core-api/src/admin-signals/',
    ],
  };

  const t = String(alert.type);
  const sev = alert.severity === 'error' || alert.severity === 'warning' || alert.severity === 'info' ? alert.severity : 'info';

  // UI/UX inconsistency (or any alert) can provide a prebuilt analysis block via rawPayload.analysis.
  const rp = alert?.rawPayload;
  if (rp != null && typeof rp === 'object' && !Array.isArray(rp) && rp.analysis != null && typeof rp.analysis === 'object') {
    const a = /** @type {any} */ (rp).analysis;
    const porQue = a.porQue ?? a.porque;
    const porqueItems = porQue
      ? [pi('Causa', String(porQue))]
      : [pi('Desalineación', 'Datos presentes pero la UI no los refleja.')];
    return {
      que: String(a.que ?? 'UI no refleja datos reales del proveedor'),
      cuando: base.cuando,
      donde: base.donde,
      impacto: buildImpacto(t, false, forensics, sev),
      porqueItems,
      como: String(a.como ?? 'Datos presentes pero no renderizados'),
      data: base.data,
      rutaTecnica: traceForType(alert.type),
      dondeBuscar: base.dondeBuscar,
      recomendacion: String(a.recomendacion ?? 'Verificar mapping supplierMesaInfoFull en UI'),
      recomendacionPasos: pasosAccion(),
    };
  }

  if (t === ALERT_TYPES.RESULTADO_SIN_SEÑAL || (t.includes('RESULTADO') && t.includes('SIN'))) {
    const streamMsg = String(alert.message ?? '').includes('Stream');
    const impacto = buildImpacto(t, streamMsg, forensics, sev);
    return {
      que: streamMsg
        ? 'Se recibió NEW_RESULT en el stream sin fila previa para esa correlationKey (no hubo NEW_SIGNAL registrado en el mapa de validación).'
        : 'Se recibió un resultado en el lab sin señal activa coherente (anomalía de validación).',
      cuando: base.cuando,
      donde: base.donde,
      impacto,
      porqueItems: [
        pi('Cliente conectó tarde', 'Perdiste NEW_SIGNAL al unirte; el mapa streamByKey nunca registró la pareja.'),
        pi('Backend sin señal', 'El core-api o el proveedor no emitió señal para esa mesa/ronda antes del resultado.'),
        pi('correlationKey distinta', 'Señal y resultado usan claves distintas o round desfasado; el lab no puede enlazarlos.'),
        pi('Señal filtrada antes', 'Middleware o validación descartó la señal; el resultado llega “solo”.'),
      ],
      como: streamMsg
        ? 'Flujo: socket NEW_RESULT → recordStreamResult → no existe entrada en streamByKey → alerta.'
        : 'Flujo: socket NEW_RESULT → handleResult → logValidationAnomaly → alerta.',
      data: base.data,
      rutaTecnica: streamMsg ? TRACES.streamResultadoSinSeñal : TRACES[ALERT_TYPES.RESULTADO_SIN_SEÑAL],
      dondeBuscar: base.dondeBuscar,
      recomendacion:
        'Alinear señal y resultado en el mismo correlationKey antes de operar; usar warmup y logs de backend para reproducir.',
      recomendacionPasos: pasosAccion(
        'Reproducir en frío: una mesa, un round, capturar WS NEW_SIGNAL + NEW_RESULT y comparar keys.',
      ),
    };
  }

  if (t === ALERT_TYPES.SEÑAL_BLOQUEADA) {
    const impacto = buildImpacto(t, false, forensics, sev);
    return {
      que: 'Señal descartada porque la mesa ya tenía un ciclo abierto en el middleware.',
      cuando: base.cuando,
      donde: base.donde,
      impacto,
      porqueItems: [
        pi('Cola por mesa', 'Solo una señal activa hasta llegar el resultado; evita solapar recomendaciones.'),
        pi('Duplicado del proveedor', 'Dos NEW_SIGNAL seguidos sin NEW_RESULT intermedio suelen venir del feed.'),
      ],
      como: 'handleSignal → activeSignalsByMesa.has(mesa) → logValidationBlocked(signal)',
      data: base.data,
      rutaTecnica: TRACES[ALERT_TYPES.SEÑAL_BLOQUEADA],
      dondeBuscar: base.dondeBuscar,
      recomendacion: 'Esperar el resultado del ciclo actual o revisar si el proveedor envía señales duplicadas.',
      recomendacionPasos: pasosAccion(
        'Si es esperado: no forzar señal; dejar cerrar ciclo. Si no: filtrar duplicados upstream o por correlationKey.',
      ),
    };
  }

  if (t === ALERT_TYPES.ROUND_CORREGIDO) {
    const impacto = buildImpacto(t, false, forensics, sev);
    return {
      que: 'El round del resultado en wire no coincidía con la señal activa; el middleware alineó al round bloqueado.',
      cuando: base.cuando,
      donde: base.donde,
      impacto,
      porqueItems: [
        pi('Desfase stream vs lab', 'El wire trae otro round que el bloqueado en middleware; se corrige para cerrar ciclo.'),
        pi('Retraso o replay', 'Eventos reordenados o mesa reconectada pueden provocar mismatch de round.'),
      ],
      como: 'handleResult → corrected.round = roundLocked → recordLabCycleEnd',
      data: base.data,
      rutaTecnica: TRACES[ALERT_TYPES.ROUND_CORREGIDO],
      dondeBuscar: base.dondeBuscar,
      recomendacion: 'Corregir en origen la secuencia mesa/round; usar validación de correlationKey en cada par.',
      recomendacionPasos: pasosAccion(
        'Registrar en logs el round en señal vs resultado antes y después del correctivo.',
      ),
    };
  }

  if (t === ALERT_TYPES.DELAY_FUERA_DE_RANGO) {
    const impacto = buildImpacto(t, false, forensics, sev);
    return {
      que: 'El tiempo real entre aceptación de señal y recepción de resultado superó el umbral adaptativo de la mesa.',
      cuando: base.cuando,
      donde: base.donde,
      impacto,
      porqueItems: [
        pi('Latencia end-to-end', 'resultReceivedAt − signalAcceptedAt excede el umbral derivado de retardos observados en stream.'),
        pi('Proveedor o red', 'Colas, pausa de mesa o red pueden alargar el cierre del ciclo sin error de correlación.'),
      ],
      como: 'recordLabCycleEnd → realDelayMs > streamDeadlineMsForMesa(mesa) → DELAY_FUERA_DE_RANGO',
      data: base.data,
      rutaTecnica: TRACES[ALERT_TYPES.DELAY_FUERA_DE_RANGO],
      dondeBuscar: [...base.dondeBuscar, 'useValidationStore.js (streamDeadlineMsForMesa)'],
      recomendacion:
        'Contrastar con panel de validación (actualDelayMs vs adaptiveThresholdMs) y con latencia proveedor/core-api.',
      recomendacionPasos: pasosAccion(
        'Verificar timestamps signalAcceptedAt / resultReceivedAt en el ciclo y traza socket.',
      ),
    };
  }

  if (t === ALERT_TYPES.STREAM_INTERRUPTED) {
    const impacto = buildImpacto(t, false, forensics, sev);
    return {
      que:
        'El umbral adaptativo señal→resultado se superó sin NEW_RESULT. El estado es de vigilancia: no implica fallo del laboratorio.',
      cuando: base.cuando,
      donde: base.donde,
      impacto,
      porqueItems: [
        pi('Variación del proveedor', 'La mesa puede haber pausado o retrasado el cierre en stream.'),
        pi('Red', 'Latencia o reconexión puede demorar el paquete de resultado.'),
      ],
      como: 'handleStreamCycleTimeout → enterStreamInterrupted · pushAlert STREAM_INTERRUPTED',
      data: base.data,
      rutaTecnica: TRACES[ALERT_TYPES.STREAM_INTERRUPTED],
      dondeBuscar: base.dondeBuscar,
      recomendacion:
        'Siguiente NEW_SIGNAL o NEW_RESULT cierra o recupera el ciclo sin acción forzada. Mantener socket activo.',
      recomendacionPasos: pasosAccion('Confirmar en panel que lifecycle pasó a STREAM_INTERRUPTED y sigue la mesa visible.'),
    };
  }

  if (t === ALERT_TYPES.STREAM_TIMEOUT) {
    const impacto = buildImpacto(t, false, forensics, sev);
    return {
      que: 'Pasó el plazo máximo sin NEW_RESULT en el stream para una correlationKey con señal registrada.',
      cuando: base.cuando,
      donde: base.donde,
      impacto,
      porqueItems: [
        pi('Proveedor lento', 'No llegó resultado dentro del plazo configurado para esa key.'),
        pi('Red o socket', 'Pérdida intermitente o reconexión puede saltarse NEW_RESULT.'),
        pi('Mesa pausada', 'La mesa dejó de emitir resultados en vivo.'),
      ],
      como: 'setTimeout stream → handleStreamCycleTimeout → STREAM_TIMEOUT',
      data: base.data,
      rutaTecnica: TRACES[ALERT_TYPES.STREAM_TIMEOUT],
      dondeBuscar: base.dondeBuscar,
      recomendacion: 'Subir observabilidad en core-api y proveedor; revisar MAX_CYCLE_DURATION_MS si el negocio lo permite.',
      recomendacionPasos: pasosAccion(
        'Medir latencia señal→resultado en logs backend y comparar con el timeout del cliente.',
      ),
    };
  }

  if (t === ALERT_TYPES.STREAM_DELAY_EXPECTED) {
    const rp = alert.rawPayload != null && typeof alert.rawPayload === 'object' ? /** @type {Record<string, unknown>} */ (alert.rawPayload) : {};
    const elapsedMs = typeof rp.elapsed === 'number' && Number.isFinite(rp.elapsed) ? rp.elapsed : null;
    const avgDelay = typeof rp.avgDelay === 'number' && Number.isFinite(rp.avgDelay) ? rp.avgDelay : null;
    const tiempoTranscurridoS = elapsedMs != null ? Math.round(elapsedMs / 1000) : '—';
    const tiempoPromedioMesaS = avgDelay != null && avgDelay > 0 ? (avgDelay / 1000).toFixed(1) : '—';
    const clasificacion =
      elapsedMs != null && avgDelay != null && avgDelay > 0
        ? elapsedMs < avgDelay
          ? 'NORMAL'
          : 'PROCESANDO'
        : 'PROCESANDO';

    return {
      que:
        alert.message ||
        'El proveedor está dentro de su comportamiento normal: el ciclo sigue activo a la espera del resultado en stream.',
      cuando: base.cuando,
      donde: base.donde,
      impacto: {
        variant: 'reassurance',
        lines: [
          '• Ciclo: En progreso normal (esperando resultado)',
          '• Estado: Sin anomalías detectadas',
          '• Sistema: Operando dentro del comportamiento esperado',
        ],
      },
      estadoActual: {
        fase: 'WAITING_RESULT',
        tiempoTranscurridoS,
        tiempoPromedioMesaS,
        clasificacion,
      },
      porqueItems: [
        pi('Comportamiento esperado', 'El tiempo transcurrido está dentro del rango normal del proveedor'),
      ],
      como: 'Tras NEW_SIGNAL, el motor de validación espera NEW_RESULT; al superarse el retardo medio observado, se informa sin tratarlo como error.',
      data: base.data,
      rutaTecnica: TRACES[ALERT_TYPES.STREAM_DELAY_EXPECTED],
      dondeBuscar: base.dondeBuscar,
      recomendacion:
        'No se requiere acción: el sistema sigue vigilando el par señal→resultado. Si el resultado no llega tras el umbral adaptativo, el estado pasa a STREAM_INTERRUPTED (vigilancia).',
      recomendacionPasos: [],
    };
  }

  if (t === ALERT_TYPES.CICLO_RECUPERADO) {
    const rp = alert.rawPayload != null && typeof alert.rawPayload === 'object' ? /** @type {Record<string, unknown>} */ (alert.rawPayload) : {};
    const rd = rp.resyncDebug != null && typeof rp.resyncDebug === 'object' ? /** @type {Record<string, unknown>} */ (rp.resyncDebug) : null;
    const metaRp = rp.meta != null && typeof rp.meta === 'object' ? /** @type {Record<string, unknown>} */ (rp.meta) : {};
    const rqRaw = metaRp.resyncQuality ?? rp.resyncQuality;
    const rq = rqRaw != null && String(rqRaw).trim() !== '' ? String(rqRaw).toUpperCase() : 'MEDIUM';
    const calPres = resyncQualityPresentation(rq);
    const calidadRecuperacion = {
      titulo: '🧠 [CALIDAD DE RECUPERACION]',
      emoji: calPres.emoji,
      nivel: rq,
      texto: calPres.line,
      investigar: calPres.investigate,
    };
    const datosKeys =
      rd != null
        ? `Claves: sin señal previa (null) · resultado=${String(rd.resultKeyFromPayload ?? '—')} · sintética=${String(rd.syntheticSignalKey ?? '—')} · resuelta=${String(rd.resolvedKeyAfterMiddleware ?? '—')} · calidad=${rq}`
        : `Ver rawPayload.resyncDebug para claves; calidad=${rq}`;
    const recomendacionBase =
      'Comportamiento esperado cuando el resultado llega sin señal previa en cola (reconexión, desfase, etc.).';
    const investigateLine =
      rq === 'LOW' && calPres.investigate ? String(calPres.investigate) : '';
    return {
      que: alert.message || 'El ciclo fue reconstruido automáticamente a partir del resultado',
      calidadRecuperacion,
      cuando: base.cuando,
      donde: base.donde,
      impacto: {
        ciclo: 'Ciclo cerrado como COMPLETE_RESYNC: el par señal/resultado fue reconstruido en middleware.',
        datos: datosKeys,
        martingalaForecast: '—',
      },
      porqueItems: [pi('Auto-resync', 'No había señal activa; se generó una señal sintética coherente con el resultado antes de emitir al lab.')],
      como: 'handleResult → active==null → synth + markGpulseLabAutoResync → setResult retardado → recordLabCycleEnd',
      data: base.data,
      rutaTecnica: TRACES[ALERT_TYPES.CICLO_RECUPERADO],
      dondeBuscar: base.dondeBuscar,
      recomendacion: investigateLine ? `${recomendacionBase} ${investigateLine}` : recomendacionBase,
      recomendacionPasos: investigateLine ? [investigateLine] : [],
    };
  }

  if (t === ALERT_TYPES.CICLO_INCOMPLETO || t.includes('INCOMPLETO')) {
    const impacto = buildImpacto(t, false, forensics, sev);
    const fragments = (alert.message || '').split('·').map((s) => s.trim()).filter(Boolean);
    const porqueItems =
      fragments.length > 0
        ? fragments.map((frag) => pi(frag.length > 48 ? `${frag.slice(0, 45)}…` : frag, 'Detectado al cerrar el ciclo de validación.'))
        : [pi('Incoherencias múltiples', 'Ver issues en el panel de ciclos y comparar lab vs stream.')];
    return {
      que: 'El ciclo de validación cerró con incoherencias (stream, delay, ganador, etc.).',
      cuando: base.cuando,
      donde: base.donde,
      impacto,
      porqueItems,
      como: 'recordLabCycleEnd → issues[] → pushAlert',
      data: base.data,
      rutaTecnica: TRACES[ALERT_TYPES.CICLO_INCOMPLETO],
      dondeBuscar: base.dondeBuscar,
      recomendacion: 'Aislar cada issue del mensaje; contrastar ganador, delays y pareja señal/resultado.',
      recomendacionPasos: pasosAccion(
        'Exportar el ciclo desde el panel inferior y cruzar con RAW PAYLOAD si debug está activo.',
      ),
    };
  }

  const impacto = buildImpacto(t, false, forensics, sev);
  return {
    que: alert.message || 'Alerta del motor de validación / flujo GPulse Lab.',
    cuando: base.cuando,
    donde: base.donde,
    impacto,
    porqueItems: [pi('Contexto genérico', 'Revisa el mensaje de la alerta y el payload en modo debug.')],
    como: 'Ver traza técnica y payload.',
    data: base.data,
    rutaTecnica: traceForType(alert.type),
    dondeBuscar: base.dondeBuscar,
    recomendacion: 'Activar Debug logs, modo warmup y seguir la traza en archivos indicados en DONDE BUSCAR.',
    recomendacionPasos: pasosAccion(),
  };
}
