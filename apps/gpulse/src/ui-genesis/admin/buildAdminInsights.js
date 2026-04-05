/**
 * Admin “AI insights” — rule-based signals derived from snapshot (no external model).
 *
 * @param {ReturnType<typeof import('./useAdminCoreSnapshot.js').useAdminCoreSnapshot>} snap
 */
export function buildAdminInsights(snap) {
  /** @type {{ id: string, priority: 'high'|'medium'|'low', title: string, description: string, metric: string, cta: string, alert?: string }[]} */
  const out = [];

  if (snap.imbalanceSeverity === 'high') {
    out.push({
      id: 'imbalance',
      priority: 'high',
      title: 'Desequilibrio binario elevado',
      description:
        'La diferencia entre piernas supera el umbral recomendado para match eficiente. Priorizar coaching en la pierna débil.',
      metric: `${snap.imbalancePct}%`,
      cta: 'Ver red',
      alert: 'Riesgo de arrastre de volumen no emparejado en cierre mensual.',
    });
  }

  if (snap.inactiveNodes > 12) {
    out.push({
      id: 'inactive',
      priority: 'medium',
      title: 'Nodos inactivos detectados',
      description: 'Volumen de red crece pero participación activa puede estar subóptima. Campaña de reactivación sugerida.',
      metric: `${snap.inactiveNodes} nodos`,
      cta: 'Exportar lista',
    });
  }

  out.push({
    id: 'revenue',
    priority: snap.growthPct >= 0 ? 'medium' : 'high',
    title: snap.growthPct >= 0 ? 'Oportunidad de expansión' : 'Revisión de ingresos',
    description:
      snap.growthPct >= 0
        ? 'La tendencia de operaciones admite aumentar el techo de promos GPulse sin saturar conversiones.'
        : 'Caída relativa en volumen sintético del ledger; auditar conversiones y flash binario.',
    metric: `${snap.growthPct >= 0 ? '+' : ''}${snap.growthPct}% vs ventana`,
    cta: 'Abrir libro',
  });

  out.push({
    id: 'liquidity',
    priority: 'low',
    title: 'Liquidez del sistema',
    description: 'Balance agregado estable respecto al historial reciente. Mantener vigilancia en retiros pico.',
    metric: `$${Math.round(snap.systemTotalUsdt).toLocaleString()}`,
    cta: 'Métricas',
  });

  return out.slice(0, 4);
}
