/**
 * Estilos inline para celdas P/B/T en VistaLab y tira admin (vector_forecast → forecast6).
 * @param {unknown} cell
 */
export function vistaLabForecastCellStyle(cell) {
  const s = String(cell ?? '')
    .trim()
    .toUpperCase();
  if (s === 'P' || s.startsWith('PLAY')) {
    return {
      borderColor: 'rgba(59,130,246,0.45)',
      backgroundColor: 'rgba(59,130,246,0.12)',
      color: '#60A5FA',
    };
  }
  if (s === 'B' || s.startsWith('BANK')) {
    return {
      borderColor: 'rgba(246,70,93,0.45)',
      backgroundColor: 'rgba(246,70,93,0.1)',
      color: '#F6465D',
    };
  }
  if (s === 'T' || s.includes('TIE') || s.includes('EMPATE')) {
    return {
      borderColor: '#474D57',
      backgroundColor: 'rgba(132,142,156,0.08)',
      color: '#B7BDC6',
    };
  }
  return {
    borderColor: '#474D57',
    backgroundColor: 'rgba(252, 213, 53, 0.06)',
    color: '#FCD535',
  };
}
