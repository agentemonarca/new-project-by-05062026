import { isForensicsDataComplete } from './alertAnalysisEngine.js';
import { ALERT_SECTION_ICONS, ALERT_SECTION_SEP } from './alertAnalysisPresentation.js';
import { ALERT_TYPES } from '../store/useAlertStore.js';

/**
 * @param {unknown} arr
 * @returns {string}
 */
export function formatCards(arr) {
  if (!Array.isArray(arr) || !arr.length) return '—';
  return `[${arr.join(' ')}]`;
}

/**
 * @param {unknown[]} items
 * @returns {string}
 */
function formatPorqueItemsForCopy(items) {
  if (!Array.isArray(items) || !items.length) return '—';
  return items
    .map((it, i) => {
      if (typeof it === 'string') {
        return `${i + 1}. ${it}`;
      }
      const causa = String(/** @type {{ causa?: string }} */ (it).causa ?? '—').trim();
      const exp = String(/** @type {{ explicacion?: string }} */ (it).explicacion ?? '').trim();
      return exp ? `${i + 1}. ${causa}\n   ${exp}` : `${i + 1}. ${causa}`;
    })
    .join('\n\n');
}

/**
 * @param {Record<string, unknown>} analysis
 */
export function normalizePorqueItems(analysis) {
  const raw = analysis?.porqueItems;
  if (Array.isArray(raw) && raw.length) return raw;
  const legacy = analysis?.porque;
  if (Array.isArray(legacy)) return legacy;
  if (legacy != null) return [legacy];
  return [];
}

/**
 * @param {Record<string, unknown>} f
 * @returns {string}
 */
function formatMartingalaBlock(f) {
  const mg = f?.martingala;
  const m = mg != null && typeof mg === 'object' && !Array.isArray(mg) ? /** @type {Record<string, unknown>} */ (mg) : null;
  let vecRes;
  let vecWin;
  try {
    vecRes = JSON.stringify(m?.vector_resultado ?? []);
  } catch {
    vecRes = '[]';
  }
  try {
    vecWin = JSON.stringify(m?.vector_win ?? []);
  } catch {
    vecWin = '[]';
  }
  return `Martingala:
- activa: ${m?.active ?? '—'}
- paso: ${m?.contador_martingala ?? '—'}
- resultado: ${vecRes}
- win: ${vecWin}`;
}

/**
 * @param {Record<string, unknown>} analysis
 * @returns {Record<string, unknown>}
 */
function getForensics(analysis) {
  const d = analysis?.data;
  if (d != null && typeof d === 'object' && !Array.isArray(d) && 'forensics' in d) {
    const f = /** @type {Record<string, unknown>} */ (d).forensics;
    if (f != null && typeof f === 'object' && !Array.isArray(f)) return /** @type {Record<string, unknown>} */ (f);
  }
  return {};
}

/**
 * @param {string} icon
 * @param {string} title
 */
function sec(icon, title) {
  return `${ALERT_SECTION_SEP}\n${icon} [${title}]`;
}

/**
 * Plain-text export of a full alert analysis (operator + dev handoff).
 * @param {{ type?: string, mesa?: unknown, round?: unknown, severity?: string, rawPayload?: unknown, timestamp?: number }} alert
 * @param {Record<string, unknown>} analysis
 * @param {{ includeRaw?: boolean, includeRawPayload?: boolean }} [options]
 */
export function buildAlertCopyText(alert, analysis, options = {}) {
  const includeRaw = options.includeRaw ?? options.includeRawPayload ?? false;

  const tipo = String(alert?.type ?? '—');
  const severidad = String(alert?.severity ?? '—');
  const timestampHeader =
    analysis?.cuando ?? (alert?.timestamp != null ? new Date(alert.timestamp).toLocaleString() : '—');

  const mesaStr = String(
    (analysis?.donde != null && typeof analysis.donde === 'object' && !Array.isArray(analysis.donde)
      ? /** @type {{ mesa?: unknown }} */ (analysis.donde).mesa
      : undefined) ??
      alert?.mesa ??
      '—',
  );
  const roundStr = String(
    (analysis?.donde != null && typeof analysis.donde === 'object' && !Array.isArray(analysis.donde)
      ? /** @type {{ round?: unknown }} */ (analysis.donde).round
      : undefined) ??
      alert?.round ??
      '—',
  );

  const f = getForensics(analysis);
  const dataComplete = isForensicsDataComplete(f);
  const ganador = f?.ganador != null ? String(f.ganador) : '—';
  const pp = f?.puntaje_player != null ? String(f.puntaje_player) : '—';
  const pb = f?.puntaje_banker != null ? String(f.puntaje_banker) : '—';

  const trace = Array.isArray(analysis?.rutaTecnica) ? analysis.rutaTecnica.map(String) : [];
  const rutaLine = trace.length ? trace.join(' → ') : '—';
  const paths = Array.isArray(analysis?.dondeBuscar) ? analysis.dondeBuscar.map(String) : [];
  const dondeBuscarBlock = paths.length ? paths.join('\n') : '—';

  const ic = ALERT_SECTION_ICONS;
  const imp = analysis?.impacto;
  /** @type {string} */
  let impactoBlock;
  if (imp != null && typeof imp === 'object' && /** @type {{ variant?: string, lines?: unknown }} */ (imp).variant === 'reassurance' && Array.isArray(/** @type {{ lines?: unknown[] }} */ (imp).lines)) {
    const lines = /** @type {{ lines: string[] }} */ (imp).lines.map((l) => String(l)).join('\n');
    impactoBlock = `${sec(ic.impacto, 'IMPACTO')}
${lines}`;
  } else if (imp != null && typeof imp === 'object') {
    impactoBlock = `${sec(ic.impacto, 'IMPACTO')}
• Ciclo: ${String(/** @type {{ ciclo?: string }} */ (imp).ciclo ?? '—')}
• Datos: ${String(/** @type {{ datos?: string }} */ (imp).datos ?? '—')}
• Martingala / forecast: ${String(/** @type {{ martingalaForecast?: string }} */ (imp).martingalaForecast ?? '—')}`;
  } else {
    impactoBlock = `${sec(ic.impacto, 'IMPACTO')}
—`;
  }

  const dataNote =
    tipo === ALERT_TYPES.STREAM_DELAY_EXPECTED
      ? '\nℹ️ Datos aún no disponibles (esperando resultado)'
      : !dataComplete
        ? '\n⚠️ Proveedor no envió datos completos'
        : '';

  const ea = analysis?.estadoActual;
  const tTrans =
    ea != null && typeof ea === 'object' ? /** @type {{ tiempoTranscurridoS?: unknown }} */ (ea).tiempoTranscurridoS : null;
  const tAvg =
    ea != null && typeof ea === 'object' ? /** @type {{ tiempoPromedioMesaS?: unknown }} */ (ea).tiempoPromedioMesaS : null;
  const estadoActualBlock =
    ea != null && typeof ea === 'object'
      ? `
${sec(ic.estadoActual, 'ESTADO ACTUAL')}
• Fase: ${String(/** @type {{ fase?: unknown }} */ (ea).fase ?? '—')}
• Tiempo transcurrido: ${tTrans === '—' || tTrans == null ? '—' : `${tTrans}s`}
• Tiempo promedio de mesa: ${tAvg === '—' || tAvg == null ? '—' : `${tAvg}s`}
• Clasificación: ${String(/** @type {{ clasificacion?: unknown }} */ (ea).clasificacion ?? '—')}`
      : '';

  const porqueBlock = formatPorqueItemsForCopy(normalizePorqueItems(analysis));

  const pasos = Array.isArray(analysis?.recomendacionPasos) ? analysis.recomendacionPasos.map(String) : [];
  const recomendacionBlock =
    pasos.length > 0
      ? `${String(analysis?.recomendacion ?? '—')}

${pasos.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
      : String(analysis?.recomendacion ?? '—');

  const cal = analysis?.calidadRecuperacion;
  const calidadBlock =
    cal != null && typeof cal === 'object'
      ? `
${sec(ic.calidadRecuperacion, 'CALIDAD DE RECUPERACION')}
${String(/** @type {{ emoji?: unknown }} */ (cal).emoji ?? '—')} ${String(/** @type {{ nivel?: unknown }} */ (cal).nivel ?? '—')}: ${String(/** @type {{ texto?: unknown }} */ (cal).texto ?? '—')}${
          /** @type {{ investigar?: unknown }} */ (cal).investigar
            ? `\n→ ${String(/** @type {{ investigar?: unknown }} */ (cal).investigar)}`
            : ''
        }`
      : '';

  let out = `=== ALERTA GPULSE LAB ===
TIPO: ${tipo}
SEVERIDAD: ${severidad}
TIMESTAMP: ${timestampHeader}

${sec(ic.que, 'QUE')}
${String(analysis?.que ?? '—')}
${calidadBlock}

${sec(ic.cuando, 'CUANDO')}
${String(analysis?.cuando ?? '—')}

${sec(ic.donde, 'DONDE')}
Mesa: ${mesaStr}
Round: ${roundStr}

${impactoBlock}
${estadoActualBlock}

${sec(tipo === ALERT_TYPES.STREAM_DELAY_EXPECTED ? ic.porqueInfo : ic.porque, 'POR QUE')}
${porqueBlock}

${sec(ic.como, 'COMO')}
${String(analysis?.como ?? '—')}

${sec(ic.data, 'DATA')}
Ganador: ${ganador}
Player: ${formatCards(f?.cartas_player)} (${pp})
Banker: ${formatCards(f?.cartas_banker)} (${pb})
${dataNote}

${formatMartingalaBlock(f)}

${sec(ic.rutaTecnica, 'RUTA TECNICA')}
${rutaLine}

${sec(ic.dondeBuscar, 'DONDE BUSCAR')}
${dondeBuscarBlock}

${sec(ic.recomendacion, 'RECOMENDACION')}
${recomendacionBlock}
`;

  if (includeRaw) {
    try {
      out += `\n${sec('📎', 'RAW PAYLOAD')}\n${JSON.stringify(alert?.rawPayload ?? {}, null, 2)}\n`;
    } catch {
      out += `\n${sec('📎', 'RAW PAYLOAD')}\n{}\n`;
    }
  }

  return out.trimEnd() + '\n';
}

/** Alias for non-alert contexts (debug events, details panels). */
export const buildAnalysisCopyText = buildAlertCopyText;

/**
 * @param {string} text
 * @returns {boolean}
 */
export function fallbackCopy(text) {
  try {
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '0';
    ta.style.top = '0';
    ta.style.opacity = '0';
    ta.style.pointerEvents = 'none';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyTextToClipboard(text) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback below */
  }
  return fallbackCopy(text);
}
