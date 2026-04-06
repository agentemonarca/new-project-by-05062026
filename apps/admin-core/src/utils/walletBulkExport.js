/** Escape field for CSV (RFC basics). */
function esc(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Descarga CSV de filas de ledger seleccionadas (cliente — estilo Binance export).
 * @param {object[]} rows
 * @param {{ project?: string, filename?: string }} opts
 */
export function exportLedgerSelection(rows, opts = {}) {
  const project = opts.project ?? 'project';
  const filename = opts.filename ?? `ledger-selection-${project}-${Date.now()}.csv`;
  const headers = ['id', 'userId', 'type', 'asset', 'amount', 'status', 'createdAt', 'project'];

  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        esc(r.id),
        esc(r.userId),
        esc(r.type),
        esc(r.asset),
        esc(r.amount),
        esc(r.status),
        esc(r.createdAt),
        esc(r.project ?? project),
      ].join(','),
    );
  }

  const blob = new Blob(['\ufeff', lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
