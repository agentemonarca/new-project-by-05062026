import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { GradientButton } from '../GradientButton.jsx';

const CATEGORIES = [
  { id: 'retiro', label: 'Retiro' },
  { id: 'deposito', label: 'Depósito' },
  { id: 'red', label: 'Red' },
  { id: 'seguridad', label: 'Seguridad' },
];

const PRIORITIES = [
  { id: 'soporte_ticket_pr_low', label: 'Baja', value: 'low' },
  { id: 'soporte_ticket_pr_med', label: 'Media', value: 'medium' },
  { id: 'soporte_ticket_pr_hi', label: 'Alta', value: 'high' },
];

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onCreate: (payload: { title: string, category: string, priority: string, message: string }) => void,
 * }} props
 */
export function NewTicketModal({ open, onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('retiro');
  const [priority, setPriority] = useState('medium');
  const [message, setMessage] = useState('');

  const reset = useCallback(() => {
    setTitle('');
    setCategory('retiro');
    setPriority('medium');
    setMessage('');
  }, []);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      const t = title.trim();
      const m = message.trim();
      if (!t || !m) return;
      onCreate({ title: t, category, priority, message: m });
      reset();
      onClose();
    },
    [title, category, priority, message, onCreate, onClose, reset],
  );

  if (!open) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-ticket-title"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-cyan-500/25 bg-slate-950/95 shadow-[0_0_60px_-12px_rgba(34,211,238,0.35)]"
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-slate-950/90 px-5 py-4 backdrop-blur">
          <h2 id="new-ticket-title" className="font-display text-lg font-semibold text-white">
            Nuevo ticket VIP
          </h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Título</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
              placeholder="Resumen del caso"
              maxLength={120}
              required
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-cyan-500/40 focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Prioridad</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                    priority === p.value
                      ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-100'
                      : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mensaje</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
              placeholder="Describe el problema con el mayor detalle posible (montos, fechas, capturas si aplica)…"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/5"
            >
              Cancelar
            </button>
            <GradientButton type="submit" className="!px-5 !py-2.5 !text-xs" disabled={!title.trim() || !message.trim()}>
              Crear ticket
            </GradientButton>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
