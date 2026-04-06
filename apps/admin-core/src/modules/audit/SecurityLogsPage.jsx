import React, { memo, useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ScrollText, Search } from 'lucide-react';
import { useAdminCore } from '../../context/AdminCoreContext.jsx';
import { AdminPageHeader } from '../../components/AdminPageHeader.jsx';
import { AdminSidePanel } from '../../components/AdminSidePanel.jsx';
import { staggerContainer, fadeUpBlur } from '../../motion/variants.js';
import { PROJECT_LIST } from '../../data/mockMaster.js';
import { displayAuditRow, isCriticalAuditAction } from '../../lib/auditLog.js';

function formatTs(ts) {
  if (ts == null || !Number.isFinite(Number(ts))) return '—';
  return new Date(Number(ts)).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
}

function projectLabel(id) {
  return PROJECT_LIST.find((p) => p.id === id)?.label ?? id ?? '—';
}

/**
 * @param {object[]} logs
 * @param {{
 *   actionNeedle: string,
 *   userNeedle: string,
 *   project: string,
 *   dateFrom: string,
 *   dateTo: string,
 * }} f
 */
function filterAuditLogs(logs, f) {
  const list = Array.isArray(logs) ? logs : [];
  const actionN = f.actionNeedle.trim().toLowerCase();
  const userN = f.userNeedle.trim().toLowerCase();
  const proj = f.project.trim();

  return list.filter((raw) => {
    const row = displayAuditRow(raw);
    if (actionN && !String(row.action).toLowerCase().includes(actionN)) return false;
    if (proj && row.project !== proj) return false;
    if (userN) {
      const t = row.targetId ? String(row.targetId).toLowerCase() : '';
      const metaStr = JSON.stringify(row.meta ?? {}).toLowerCase();
      if (!t.includes(userN) && !metaStr.includes(userN)) return false;
    }
    if (f.dateFrom || f.dateTo) {
      const t = row.timestamp;
      if (!Number.isFinite(t)) return false;
      if (f.dateFrom) {
        const start = new Date(`${f.dateFrom}T00:00:00`).getTime();
        if (t < start) return false;
      }
      if (f.dateTo) {
        const end = new Date(`${f.dateTo}T23:59:59.999`).getTime();
        if (t > end) return false;
      }
    }
    return true;
  });
}

function SecurityLogsPageInner() {
  const { logs, projectList } = useAdminCore();
  const [actionNeedle, setActionNeedle] = useState('');
  const [userNeedle, setUserNeedle] = useState('');
  const [project, setProject] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState(/** @type {object | null} */ (null));

  const filters = useMemo(
    () => ({ actionNeedle, userNeedle, project, dateFrom, dateTo }),
    [actionNeedle, userNeedle, project, dateFrom, dateTo],
  );

  const sorted = useMemo(() => {
    const list = Array.isArray(logs) ? [...logs] : [];
    list.sort((a, b) => (displayAuditRow(b).timestamp || 0) - (displayAuditRow(a).timestamp || 0));
    return list;
  }, [logs]);

  const filtered = useMemo(() => filterAuditLogs(sorted, filters), [sorted, filters]);

  const detail = useMemo(() => (selected ? displayAuditRow(selected) : null), [selected]);

  const rowClass = useCallback((raw) => {
    const row = displayAuditRow(raw);
    const critical = isCriticalAuditAction(row.action);
    if (critical) {
      return 'bg-rose-500/[0.07] ring-1 ring-inset ring-rose-500/15 border-l-2 border-l-rose-400/70';
    }
    return 'hover:bg-white/[0.02] border-l-2 border-l-transparent';
  }, []);

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <motion.div variants={fadeUpBlur}>
        <AdminPageHeader
          eyebrow="Cumplimiento"
          title="Registro de auditoría"
          subtitle="Todas las acciones críticas del Admin Core · orden descendente · AiGenesis"
        >
          <span className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/25 bg-slate-900/80 px-3 py-2 text-[11px] font-mono text-cyan-100/90">
            <ScrollText className="h-4 w-4" aria-hidden />
            {sorted.length} evento{sorted.length !== 1 ? 's' : ''}
          </span>
        </AdminPageHeader>
      </motion.div>

      <motion.div
        variants={fadeUpBlur}
        className="rounded-xl border border-white/[0.08] bg-slate-950/55 p-4"
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Filtros</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-500">Acción</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                value={actionNeedle}
                onChange={(e) => setActionNeedle(e.target.value)}
                placeholder="p. ej. blockUser"
                className="w-full rounded-lg border border-white/10 bg-slate-900 py-2 pl-8 pr-3 text-sm text-white outline-none focus:border-cyan-500/35"
              />
            </div>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-500">Usuario / target</span>
            <input
              value={userNeedle}
              onChange={(e) => setUserNeedle(e.target.value)}
              placeholder="targetId o meta"
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/35"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-500">Proyecto</span>
            <select
              value={project}
              onChange={(e) => setProject(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/35"
            >
              <option value="">Todos</option>
              {(projectList || PROJECT_LIST).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-500">Desde</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-500">Hasta</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setActionNeedle('');
                setUserNeedle('');
                setProject('');
                setDateFrom('');
                setDateTo('');
              }}
              className="w-full rounded-lg border border-white/10 bg-slate-900/80 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              Limpiar filtros
            </button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Mostrando <span className="font-mono text-cyan-200/90">{filtered.length}</span> de{' '}
          <span className="font-mono text-slate-400">{sorted.length}</span> · más reciente primero
        </p>
      </motion.div>

      <motion.div variants={fadeUpBlur} className="overflow-x-auto rounded-xl border border-white/[0.08]">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-white/[0.06] bg-slate-900/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-3">Acción</th>
              <th className="px-3 py-3">Admin</th>
              <th className="px-3 py-3">Usuario / target</th>
              <th className="px-3 py-3">Proyecto</th>
              <th className="px-3 py-3">Fecha</th>
              <th className="px-3 py-3 text-right"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filtered.length ? (
              filtered.map((raw) => {
                const row = displayAuditRow(raw);
                const critical = isCriticalAuditAction(row.action);
                return (
                  <tr
                    key={row.id}
                    className={`cursor-pointer bg-slate-950/30 transition ${rowClass(raw)}`}
                    onClick={() => setSelected(raw)}
                  >
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-xs text-cyan-200/90">{row.action}</span>
                      {critical ? (
                        <span className="ml-2 rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-100">
                          crítico
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-2.5 text-xs text-slate-300" title={row.admin}>
                      {row.admin}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-400">
                      {row.targetId ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-300">{projectLabel(row.project)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-slate-500">
                      {formatTs(row.timestamp)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[11px] font-semibold text-cyan-400/90">
                      Detalle →
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-3 py-12 text-center text-slate-500">
                  Sin eventos que coincidan con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </motion.div>

      <AdminSidePanel
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        eyebrow="Evento de auditoría"
        title={detail?.action ?? '—'}
        subtitle={detail?.id ?? ''}
        widthClassName="md:max-w-lg lg:max-w-xl"
      >
        {detail ? (
          <div className="space-y-4 text-sm">
            <dl className="grid gap-2 text-xs">
              <div className="flex justify-between gap-2 border-b border-white/[0.06] py-2">
                <dt className="text-slate-500">Proyecto</dt>
                <dd className="font-mono text-cyan-200/90">{detail.project}</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-white/[0.06] py-2">
                <dt className="text-slate-500">Admin</dt>
                <dd className="max-w-[60%] truncate text-right text-slate-200" title={detail.admin}>
                  {detail.admin}
                </dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-white/[0.06] py-2">
                <dt className="text-slate-500">Target</dt>
                <dd className="font-mono text-slate-200">{detail.targetId ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-white/[0.06] py-2">
                <dt className="text-slate-500">Timestamp</dt>
                <dd className="font-mono text-slate-400">{formatTs(detail.timestamp)}</dd>
              </div>
            </dl>
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-500">meta (JSON)</p>
              <pre className="custom-scrollbar mt-2 max-h-64 overflow-auto rounded-lg border border-white/[0.08] bg-slate-950/80 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
                {JSON.stringify(detail.meta ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </AdminSidePanel>
    </motion.div>
  );
}

export const SecurityLogsPage = memo(SecurityLogsPageInner);
SecurityLogsPage.displayName = 'SecurityLogsPage';
