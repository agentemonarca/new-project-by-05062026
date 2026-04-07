/**
 * Smoke de endpoints admin-signals (requiere GENESIS_ADMIN_API_KEY; no imprime la clave).
 *
 * @param {{ port: number, logger: { warn?: Function } }} opts
 */
export async function runAdminSignalsHttpSmoke(opts) {
  const { port, logger } = opts;
  console.log('\n── Admin-signals HTTP smoke ──');

  const key = String(process.env.GENESIS_ADMIN_API_KEY || '').trim();
  if (!key) {
    console.log(
      'Omitido: sin GENESIS_ADMIN_API_KEY (o usa sesión admin en el navegador). Endpoints pueden responder 401.',
    );
    return;
  }

  const to = new Date();
  const toStr = to.toISOString().slice(0, 10);
  const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  from.setUTCDate(from.getUTCDate() - 13);
  const fromStr = from.toISOString().slice(0, 10);

  const paths = [
    { method: 'GET', path: '/api/admin/signals/stats' },
    { method: 'GET', path: '/api/admin/signals/analytics' },
    { method: 'GET', path: '/api/admin/signals/alerts-daily?days=7' },
    { method: 'GET', path: `/api/admin/signals/metrics-daily?fromDate=${fromStr}&toDate=${toStr}` },
  ];

  const base = `http://127.0.0.1:${port}`;

  for (const { method, path } of paths) {
    try {
      const res = await fetch(base + path, {
        method,
        headers: { 'X-Admin-Api-Key': key },
      });
      let body = {};
      try {
        body = await res.json();
      } catch {
        body = {};
      }
      const mongoReady = body.mongoReady;
      const shortPath = path.split('?')[0];
      console.log(`${method} ${shortPath} → HTTP ${res.status} mongoReady=${mongoReady ?? 'n/a'}`);

      if (shortPath.endsWith('/analytics')) {
        console.log(
          '  · settledTotal:',
          body.settledTotal,
          'winRateGlobal:',
          body.winRateGlobal,
          'signalsPerMinute:',
          body.signalsPerMinute,
        );
      }
      if (shortPath.endsWith('/stats') && body.stats && typeof body.stats === 'object') {
        const st = body.stats;
        console.log('  · wins:', st.wins, 'losses:', st.losses, 'totalSignals:', st.totalSignals);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger?.warn?.('admin_signals_smoke_fetch_failed', { path, message: msg });
      console.log(`${method} ${path} → error:`, msg);
    }
  }

  console.log('Resumen smoke: revisar HTTP 200 y mongoReady=true en analytics/alerts donde aplique.');
}
