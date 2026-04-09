/**
 * Clasificación de calidad de recuperación tras auto-resync (middleware).
 * @param {{
 *   round: string | number | null | undefined,
 *   correlationKey: unknown,
 *   ganador: unknown,
 *   hasCards: boolean,
 * }} p
 * @returns {'HIGH'|'MEDIUM'|'LOW'}
 */
export function classifyResyncQuality(p) {
  const roundStr = p.round != null ? String(p.round).trim() : '';
  const hasRoundValid = roundStr !== '' && roundStr !== '0';
  const hasCk = p.correlationKey != null && String(p.correlationKey).trim() !== '';
  const hasWinner = p.ganador != null && String(p.ganador).trim() !== '';
  const hasCards = Boolean(p.hasCards);

  // HIGH: round válido, correlationKey, ganador
  if (hasRoundValid && hasCk && hasWinner) return 'HIGH';

  // MEDIUM: ganador presente pero round fallback ('0'/vacío) o sin clave
  if (hasWinner && (!hasRoundValid || roundStr === '0' || !hasCk)) return 'MEDIUM';

  // Bajo: sin ganador y poca evidencia
  if (!hasWinner && !hasCards && (roundStr === '0' || !hasRoundValid)) return 'LOW';
  if (!hasWinner && !hasCards) return 'LOW';

  // Cartas sin ganador explícito aún — útil pero revisar
  if (!hasWinner && hasCards) return 'MEDIUM';

  return 'LOW';
}

/**
 * @param {'HIGH'|'MEDIUM'|'LOW'|string} level
 */
export function resyncQualityPresentation(level) {
  const L = String(level || '').toUpperCase();
  if (L === 'HIGH') {
    return {
      emoji: '🟢',
      line: 'Recuperación completa y confiable',
      investigate: null,
    };
  }
  if (L === 'MEDIUM') {
    return {
      emoji: '🟡',
      line: 'Recuperación válida con ajustes',
      investigate: null,
    };
  }
  return {
    emoji: '🔴',
    line: 'Recuperación parcial — revisar datos',
    investigate:
      'Revisa Cycle X-Ray, payload crudo del resultado y trazas /admin-signals; confirma round, ganador y cartas con el proveedor.',
  };
}
