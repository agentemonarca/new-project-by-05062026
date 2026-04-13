import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  CheckCheck,
  ChevronRight,
  Crown,
  Headphones,
  Plus,
  Send,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard.jsx';
import { GradientButton } from '../components/GradientButton.jsx';
import { NewTicketModal } from '../components/support/NewTicketModal.jsx';
import { fadeUpBlur } from '../motion/variants.js';
import { isGpulseRealProviderExecution } from '../../utils/gpulseRngPolicy.js';

/** @typedef {'open' | 'closed' | 'waiting_user'} TicketStatus */
/** @typedef {'low' | 'medium' | 'high'} TicketPriority */

/**
 * @typedef {{
 *   id: string,
 *   body: string,
 *   sender: 'user' | 'agent',
 *   ts: number,
 *   seen?: boolean,
 *   agent?: { name: string, level: string },
 * }} ChatMessage
 *
 * @typedef {{
 *   id: string,
 *   title: string,
 *   category: string,
 *   priority: TicketPriority,
 *   status: TicketStatus,
 *   unread: boolean,
 *   createdAt: number,
 *   messages: ChatMessage[],
 * }} SupportTicket
 */

function categoryLabel(cat) {
  const m = { retiro: 'Retiro', deposito: 'Depósito', red: 'Red', seguridad: 'Seguridad' };
  return m[cat] ?? cat;
}

function formatTime(ts) {
  return new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ts);
}

/** @returns {SupportTicket[]} */
function seedTickets() {
  const now = Date.now();
  return [
    {
      id: 'vip-1001',
      title: 'Retiro USDT no reflejado',
      category: 'retiro',
      priority: 'high',
      status: 'open',
      unread: true,
      createdAt: now - 7200_000,
      messages: [
        {
          id: 'm-a',
          body: 'Hola, intenté un retiro hace 48h y sigue en proceso.',
          sender: 'user',
          ts: now - 7100_000,
          seen: true,
        },
        {
          id: 'm-b',
          body:
            'Gracias por el detalle. Verificamos hash en cadena; si está confirmado, el backoffice suele liberar en 24–72h hábiles. ¿Puedes compartir el TXID?',
          sender: 'agent',
          ts: now - 6800_000,
          agent: { name: 'Soporte Técnico', level: 'L1' },
        },
      ],
    },
    {
      id: 'vip-1002',
      title: 'Consulta staking flexible',
      category: 'red',
      priority: 'medium',
      status: 'waiting_user',
      unread: true,
      createdAt: now - 86400_000,
      messages: [
        {
          id: 'm-c',
          body: '¿El unstaking tiene cooldown?',
          sender: 'user',
          ts: now - 86000_000,
          seen: true,
        },
        {
          id: 'm-d',
          body: 'Según el programa activo, el período de desbloqueo puede variar. ¿Me confirmas el ID del producto en tu panel?',
          sender: 'agent',
          ts: now - 85000_000,
          agent: { name: 'Ana · Especialista', level: 'L2' },
        },
      ],
    },
    {
      id: 'vip-1003',
      title: 'Acceso cuenta / 2FA',
      category: 'seguridad',
      priority: 'low',
      status: 'closed',
      unread: false,
      createdAt: now - 604800_000,
      messages: [
        {
          id: 'm-e',
          body: 'Recuperé acceso, gracias.',
          sender: 'user',
          ts: now - 604000_000,
          seen: true,
        },
        {
          id: 'm-f',
          body: 'Ticket cerrado. Cualquier incidencia nueva, abre un nuevo caso VIP.',
          sender: 'agent',
          ts: now - 603900_000,
          agent: { name: 'Soporte Técnico', level: 'L1' },
        },
      ],
    },
  ];
}

function priorityBadgeClasses(p) {
  if (p === 'high') return 'border-rose-500/50 bg-rose-500/10 text-rose-200 shadow-[0_0_14px_-2px_rgba(244,63,94,0.55)]';
  if (p === 'medium') return 'border-blue-500/45 bg-blue-500/10 text-blue-200';
  return 'border-slate-500/40 bg-slate-500/10 text-slate-400';
}

function priorityLabel(p) {
  if (p === 'high') return 'ALTA';
  if (p === 'medium') return 'MEDIA';
  return 'BAJA';
}

function ticketRowBorder(status) {
  if (status === 'open') return 'border-cyan-500/50 shadow-[0_0_22px_-6px_rgba(34,211,238,0.45)]';
  if (status === 'waiting_user') return 'border-amber-400/45 shadow-[0_0_16px_-6px_rgba(251,191,36,0.25)]';
  return 'border-white/10 opacity-75 grayscale-[0.25]';
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-cyan-400/90"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </div>
  );
}

/**
 * @param {{ text: string, onDone?: () => void }} props
 */
function TypewriterBubble({ text, onDone }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (i >= text.length) {
      onDone?.();
      return undefined;
    }
    const t = window.setTimeout(() => setI((x) => x + 1), i === 0 ? 80 : 16);
    return () => window.clearTimeout(t);
  }, [i, text, onDone]);
  return <span>{text.slice(0, i)}</span>;
}

const SUGGESTIONS = [
  { id: 's1', text: 'Mi retiro no llega' },
  { id: 's2', text: 'Problema con staking' },
  { id: 's3', text: 'No veo mi balance' },
];

/**
 * @param {{ hasSession?: boolean }} props
 */
export function GenesisSupportPage({ hasSession = true }) {
  const initial = useMemo(() => seedTickets(), []);
  const [tickets, setTickets] = useState(initial);
  const [activeId, setActiveId] = useState(() => initial[0]?.id ?? null);
  const [filter, setFilter] = useState(/** @type {'all' | 'open' | 'closed' | 'high'} */ ('all'));
  const [aiMode, setAiMode] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [systemPulse, setSystemPulse] = useState(() => ({
    congestion: /** @type {'baja' | 'alta'} */ ('baja'),
    gas: /** @type {'normal' | 'alto'} */ ('normal'),
    network: /** @type {'ok' | 'demora'} */ ('ok'),
  }));

  const chatEndRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const listRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const activeTicket = useMemo(() => tickets.find((t) => t.id === activeId) ?? null, [tickets, activeId]);

  const supportPulseTickRef = useRef(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      supportPulseTickRef.current += 1;
      const k = supportPulseTickRef.current;
      const u = (k * 7919) % 1000 / 1000;
      const v = (k * 6143) % 1000 / 1000;
      const w = (k * 4271) % 1000 / 1000;
      setSystemPulse({
        congestion: u > 0.88 ? 'alta' : 'baja',
        gas: v > 0.85 ? 'alto' : 'normal',
        network: w > 0.86 ? 'demora' : 'ok',
      });
    }, 11_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTicket?.messages.length, typing, aiThinking]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (filter === 'all') return true;
      if (filter === 'open') return t.status === 'open';
      if (filter === 'closed') return t.status === 'closed';
      if (filter === 'high') return t.priority === 'high';
      return true;
    });
  }, [tickets, filter]);

  const markRead = useCallback((ticketId) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, unread: false } : t)),
    );
  }, []);

  const selectTicket = useCallback(
    (id) => {
      setActiveId(id);
      markRead(id);
    },
    [markRead],
  );

  const pushMessage = useCallback((ticketId, msg) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              messages: [...(t.messages ?? []).map((m) => (m.sender === 'user' ? { ...m, seen: true } : m)), msg],
              status: t.status === 'waiting_user' && msg.sender === 'user' ? 'open' : t.status,
            }
          : t,
      ),
    );
  }, []);

  const simulateAgentReply = useCallback(
    (ticketId) => {
      const useAi = aiMode;
      const realProv = isGpulseRealProviderExecution();
      const ticketSum = String(ticketId).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      setTyping(true);
      if (useAi) setAiThinking(true);

      const delay = useAi
        ? 900 + (realProv ? ticketSum % 600 : Math.random() * 600)
        : 2200 + (realProv ? ticketSum % 1200 : Math.random() * 1200);

      window.setTimeout(() => {
        setTyping(false);
        setAiThinking(false);

        setTickets((prev) => {
          const ticket = prev.find((t) => t.id === ticketId);
          if (!ticket || ticket.status === 'closed') return prev;

          const agent = useAi
            ? { name: 'Génesis AI', level: 'IA' }
            : realProv
              ? ticketSum % 2 === 0
                ? { name: 'Soporte Técnico', level: 'L1' }
                : { name: 'Equipo Prioridad', level: 'L2' }
              : Math.random() > 0.5
                ? { name: 'Soporte Técnico', level: 'L1' }
                : { name: 'Equipo Prioridad', level: 'L2' };

          const replies = useAi
            ? [
                'He analizado tu caso: revisa el historial operativo y el estado del retiro en cadena. Si el hash está confirmado, escala a un agente humano con el TXID.',
                'Según la base de conocimiento: el balance puede tardar un ciclo de sincronización. Prueba “Sincronizar” en el dashboard tras 2–3 minutos.',
                'Para staking: confirma el producto bloqueado en la pestaña correspondiente; el cooldown depende del tramo contratado.',
              ]
            : [
                'Gracias por tu mensaje. Ya registramos el caso en cola prioritaria; te responderemos con un ETA cuando el equipo de operaciones confirme.',
                'Estamos validando con backoffice. Mantén el ticket abierto; te pediremos datos solo si hace falta.',
              ];

          const body =
            replies[realProv ? ticketSum % replies.length : Math.floor(Math.random() * replies.length)];
          const msg = {
            id: `m-${Date.now()}`,
            body,
            sender: /** @type {const} */ ('agent'),
            ts: Date.now(),
            agent,
          };

          return prev.map((t) =>
            t.id === ticketId
              ? {
                  ...t,
                  messages: [...(t.messages ?? []).map((m) => (m.sender === 'user' ? { ...m, seen: true } : m)), msg],
                  status: /** @type {TicketStatus} */ ('waiting_user'),
                  unread: false,
                }
              : t,
          );
        });
      }, delay);
    },
    [aiMode],
  );

  const sendUserMessage = useCallback(() => {
    const text = draft.trim();
    if (!text || !activeId || !activeTicket || activeTicket.status === 'closed') return;
    const msg = {
      id: `m-${Date.now()}`,
      body: text,
      sender: /** @type {const} */ ('user'),
      ts: Date.now(),
      seen: false,
    };
    pushMessage(activeId, msg);
    setDraft('');
    setTickets((prev) =>
      prev.map((t) => (t.id === activeId ? { ...t, status: 'open', unread: false } : t)),
    );
    simulateAgentReply(activeId);
  }, [draft, activeId, activeTicket, pushMessage, simulateAgentReply]);

  const onCreateTicket = useCallback(
    ({ title, category, priority, message }) => {
      const id = `vip-${Date.now().toString(36)}`;
      const firstMsg = {
        id: `m-${Date.now()}`,
        body: message,
        sender: /** @type {const} */ ('user'),
        ts: Date.now(),
        seen: false,
      };
      const ticket = {
        id,
        title,
        category,
        priority: /** @type {TicketPriority} */ (priority),
        status: /** @type {TicketStatus} */ ('open'),
        unread: false,
        createdAt: Date.now(),
        messages: [firstMsg],
      };
      setTickets((prev) => [ticket, ...prev]);
      setActiveId(id);
      setFilter('all');
      window.setTimeout(() => simulateAgentReply(id), 400);
    },
    [simulateAgentReply],
  );

  const systemAlert = systemPulse.congestion === 'alta' || systemPulse.gas === 'alto' || systemPulse.network === 'demora';

  return (
    <motion.div className="space-y-5" variants={fadeUpBlur}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/90">
            <Crown className="h-3.5 w-3.5" />
            Soporte VIP
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold text-white md:text-3xl">Centro de ayuda premium</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            Tickets priorizados, chat en vivo e asistencia IA — experiencia tipo exchange institucional.
          </p>
        </div>
      </div>

      <GlassCard className="border-white/10 p-4 md:p-5" contentClassName="p-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/20 text-emerald-200">
            <Activity className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold text-white">Estado del sistema</p>
            <p className="text-[11px] text-slate-500">Señales operativas simuladas — actualización periódica</p>
          </div>
          <Wifi className={`h-4 w-4 shrink-0 ${systemAlert ? 'text-amber-400' : 'text-emerald-400'}`} />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            {
              k: 'Congestión',
              v: systemPulse.congestion === 'alta' ? 'Alta' : 'Normal',
              bad: systemPulse.congestion === 'alta',
            },
            { k: 'Gas / red', v: systemPulse.gas === 'alto' ? 'Tarifas elevadas' : 'Estable', bad: systemPulse.gas === 'alto' },
            { k: 'Latencia API', v: systemPulse.network === 'demora' ? 'Demora detectada' : 'Óptima', bad: systemPulse.network === 'demora' },
          ].map((row) => (
            <div
              key={row.k}
              className={`rounded-xl border px-3 py-2.5 text-xs ${
                row.bad
                  ? 'border-rose-500/35 bg-rose-500/10 text-rose-100'
                  : 'border-white/10 bg-slate-950/50 text-slate-300'
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{row.k}</p>
              <p className="mt-1 font-medium">{row.v}</p>
            </div>
          ))}
        </div>
        {systemAlert ? (
          <p className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100/95">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Alerta operativa: puede haber demoras en retiros o confirmaciones — priorizamos tickets marcados ALTA.
          </p>
        ) : null}
      </GlassCard>

      <div className="grid min-h-[min(680px,78vh)] gap-4 lg:grid-cols-[minmax(280px,320px)_1fr]">
        {/* Ticket list */}
        <GlassCard className="flex flex-col border-white/10 p-0" contentClassName="flex h-full min-h-0 flex-col p-0">
          <div className="border-b border-white/10 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Headphones className="h-4 w-4 text-cyan-400" />
                <span className="font-display text-sm font-semibold text-white">Tus tickets</span>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-500/15"
              >
                <Plus className="h-3.5 w-3.5" />
                Nuevo ticket
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'open', label: 'Abiertos' },
                { id: 'closed', label: 'Cerrados' },
                { id: 'high', label: 'Alta prioridad' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(/** @type {'all' | 'open' | 'closed' | 'high'} */ (f.id))}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                    filter === f.id ? 'bg-white/15 text-white' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div ref={listRef} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
            {filteredTickets.length === 0 ? (
              <p className="px-2 py-8 text-center text-xs text-slate-500">No hay tickets en este filtro.</p>
            ) : (
              filteredTickets.map((t) => {
                const active = t.id === activeId;
                return (
                  <motion.button
                    key={t.id}
                    type="button"
                    layout
                    onClick={() => selectTicket(t.id)}
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    className={`relative mb-2 w-full rounded-xl border p-3 text-left transition ${ticketRowBorder(t.status)} ${
                      active ? 'ring-2 ring-cyan-400/40 ring-offset-2 ring-offset-slate-950' : ''
                    } ${active ? 'animate-[pulse-ring_2.8s_ease-in-out_infinite]' : 'hover:shadow-[0_0_20px_-8px_rgba(34,211,238,0.35)]'}`}
                  >
                    {active ? (
                      <span className="absolute inset-0 rounded-xl border border-cyan-400/20 pointer-events-none" aria-hidden />
                    ) : null}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-display text-xs font-semibold text-white">{t.title}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">{formatTime(t.createdAt)}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${priorityBadgeClasses(t.priority)}`}
                        >
                          {priorityLabel(t.priority)}
                        </span>
                        {t.unread ? (
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-40" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_2px_rgba(34,211,238,0.8)]" />
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-[10px] uppercase tracking-wider text-slate-500">
                      {t.status === 'open' && 'Abierto'}
                      {t.status === 'closed' && 'Cerrado'}
                      {t.status === 'waiting_user' && 'Esperando tu respuesta'}
                      {' · '}
                      {categoryLabel(t.category)}
                    </p>
                  </motion.button>
                );
              })
            )}
          </div>
        </GlassCard>

        {/* Chat + details */}
        <GlassCard className="flex min-h-0 flex-col border-cyan-500/15 p-0 shadow-[inset_0_0_40px_-20px_rgba(34,211,238,0.15)]" contentClassName="flex min-h-0 flex-1 flex-col p-0">
          {activeTicket ? (
            <>
              <div className="shrink-0 border-b border-white/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <motion.h2
                      key={activeTicket.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="font-display text-base font-semibold text-white md:text-lg"
                    >
                      {activeTicket.title}
                    </motion.h2>
                    <p className="mt-1 font-mono text-[10px] text-slate-500">
                      {activeTicket.id} · {categoryLabel(activeTicket.category)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${
                        activeTicket.status === 'open'
                          ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                          : activeTicket.status === 'waiting_user'
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                            : 'border-slate-500/40 bg-slate-500/10 text-slate-400'
                      }`}
                    >
                      {activeTicket.status === 'open' && 'Abierto'}
                      {activeTicket.status === 'waiting_user' && 'Esperando usuario'}
                      {activeTicket.status === 'closed' && 'Cerrado'}
                    </span>
                    <div className="flex rounded-xl border border-white/10 bg-slate-950/80 p-0.5">
                      <button
                        type="button"
                        onClick={() => setAiMode(false)}
                        className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase ${
                          !aiMode ? 'bg-violet-500/25 text-violet-100' : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        Humano
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiMode(true)}
                        className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase ${
                          aiMode ? 'bg-cyan-500/25 text-cyan-100' : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <Sparkles className="h-3 w-3" />
                        IA
                      </button>
                    </div>
                  </div>
                </div>
                {aiMode ? (
                  <p className="mt-2 text-[11px] text-cyan-200/80">Modo IA: respuestas rápidas basadas en base de conocimiento.</p>
                ) : (
                  <p className="mt-2 text-[11px] text-slate-500">Modo humano: cola de agentes certificados L1 / L2.</p>
                )}
              </div>

              <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <AnimatePresence initial={false}>
                  {(activeTicket.messages ?? []).map((m, idx) => (
                    <motion.div
                      key={m.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.22 }}
                      className={`mb-4 flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[92%] rounded-2xl border px-4 py-3 md:max-w-[78%] ${
                          m.sender === 'user'
                            ? 'border-cyan-500/25 bg-cyan-500/10 text-slate-100'
                            : 'border-white/10 bg-slate-900/70 text-slate-200'
                        }`}
                      >
                        {m.sender === 'agent' && m.agent ? (
                          <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-violet-300/90">
                            {m.agent.level === 'IA' ? m.agent.name : `${m.agent.name} ${m.agent.level}`}
                          </p>
                        ) : null}
                        <p className="text-sm leading-relaxed">
                          {m.sender === 'agent' &&
                          idx === (activeTicket.messages ?? []).length - 1 &&
                          !typing &&
                          Date.now() - m.ts < 120_000 ? (
                            <TypewriterBubble text={m.body} />
                          ) : (
                            m.body
                          )}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center justify-end gap-2 text-[10px] text-slate-500">
                          <span>{formatTime(m.ts)}</span>
                          {m.sender === 'user' && m.seen ? (
                            <span className="inline-flex items-center gap-0.5 text-cyan-400/90">
                              <CheckCheck className="h-3 w-3" />
                              Visto
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {typing && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 flex justify-start">
                    <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3">
                      <p className="mb-1 text-[10px] font-semibold uppercase text-slate-500">
                        {aiThinking ? 'IA pensando…' : 'Escribiendo…'}
                      </p>
                      <TypingDots />
                    </div>
                  </motion.div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="shrink-0 border-t border-white/10 p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Sugerencias rápidas</p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setDraft(s.text)}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-slate-300 transition hover:border-cyan-500/35 hover:bg-cyan-500/10 hover:text-cyan-100"
                    >
                      {s.text}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendUserMessage();
                      }
                    }}
                    rows={2}
                    disabled={activeTicket.status === 'closed' || !hasSession}
                    placeholder={
                      hasSession ? 'Escribe tu mensaje…' : 'Inicia sesión para chatear con soporte'
                    }
                    className="min-h-[48px] flex-1 resize-none rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none disabled:opacity-45"
                  />
                  <GradientButton
                    type="button"
                    className="h-[48px] w-12 shrink-0 !p-0"
                    onClick={sendUserMessage}
                    disabled={!draft.trim() || activeTicket.status === 'closed' || !hasSession}
                    aria-label="Enviar"
                  >
                    <Send className="mx-auto h-4 w-4" />
                  </GradientButton>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-10 text-center text-slate-500">
              <ChevronRight className="mb-2 h-8 w-8 opacity-40" />
              <p className="text-sm">Selecciona un ticket o crea uno nuevo.</p>
            </div>
          )}
        </GlassCard>
      </div>

      <p className="text-center text-[10px] text-slate-600">Información general. No constituye asesoramiento financiero.</p>

      <AnimatePresence>
        {modalOpen ? (
          <NewTicketModal open={modalOpen} onClose={() => setModalOpen(false)} onCreate={onCreateTicket} />
        ) : null}
      </AnimatePresence>

      <style>{`
        @keyframes pulse-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34, 211, 238, 0.25); }
          50% { box-shadow: 0 0 0 4px rgba(34, 211, 238, 0.08); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.25); border-radius: 6px; }
      `}</style>
    </motion.div>
  );
}

export default GenesisSupportPage;
