import React, { memo, useCallback, useEffect, useState } from 'react';
import { FlaskConical, Radio, WifiOff } from 'lucide-react';
import getAdminSignalsSocket from '../services/socket-admin.js';
import { adminApiFetch } from '../lib/adminBackendApi.js';

/**
 * @param {{ label: string }} props
 */
function CardFace({ label }) {
  return (
    <div
      className="flex h-16 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-slate-200 bg-white text-xl font-black text-slate-800 shadow-md"
      aria-hidden
    >
      {label}
    </div>
  );
}

/**
 * @param {{ title: string, subtitle: string, cards: string[] | null | undefined, score: string | number | null | undefined, accent: 'blue' | 'red' }} props
 */
function HandBlock({ title, subtitle, cards, score, accent }) {
  const bar = accent === 'blue' ? 'bg-sky-500' : 'bg-rose-600';
  const titleCls = accent === 'blue' ? 'text-sky-700' : 'text-rose-700';
  const list = Array.isArray(cards) && cards.length > 0 ? cards : null;
  const scoreLabel = score != null && score !== '' ? String(score) : null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`h-1 w-12 rounded-full ${bar}`} aria-hidden />
      <p className={`mt-3 text-xs font-bold uppercase tracking-[0.2em] ${titleCls}`}>{title}</p>
      <p className="text-sm font-medium text-slate-500">{subtitle}</p>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        {list ? (
          list.map((c, i) => <CardFace key={`${c}-${i}`} label={c} />)
        ) : (
          <span className="text-sm text-slate-400">Sin cartas</span>
        )}
      </div>
      {scoreLabel != null ? (
        <p className="mt-5 text-5xl font-black tabular-nums text-slate-900">{scoreLabel}</p>
      ) : (
        <p className="mt-5 text-sm text-slate-400">Puntos no informados</p>
      )}
    </div>
  );
}

/**
 * @param {{ code: string }} props
 */
function VerdictPill({ code }) {
  const c = String(code || '—').toUpperCase();
  let cls = 'bg-slate-100 text-slate-700';
  let label = '—';
  if (c === 'WIN') {
    cls = 'bg-emerald-100 text-emerald-900';
    label = 'WIN';
  } else if (c === 'LOSS') {
    cls = 'bg-rose-100 text-rose-900';
    label = 'LOSS';
  } else if (c === 'TIE') {
    cls = 'bg-amber-100 text-amber-900';
    label = 'EMPATE';
  }
  return (
    <span className={`inline-flex rounded-full px-6 py-2 text-sm font-black tracking-wide ${cls}`}>{label}</span>
  );
}

function SignalLabPageInner() {
  const [session, setSession] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApiFetch('/api/admin/signals/canonical/latest', {}, 'genesis');
      const j = await res.json().catch(() => ({}));
      if (j?.ok && j.session) setSession(j.session);
      else setSession(null);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const socket = getAdminSignalsSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onClosed = (payload) => {
      if (payload && typeof payload === 'object') setSession(payload);
    };
    setConnected(socket.connected);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('signal_session_closed', onClosed);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('signal_session_closed', onClosed);
    };
  }, []);

  const meta = session?.meta;
  const sig = session?.signal;
  const rst = session?.result;
  const eng = session?.engine;

  const ganador = rst?.ganador != null ? String(rst.ganador) : '—';
  const ganadorColor =
    ganador === 'PLAYER' ? 'text-sky-600' : ganador === 'BANKER' ? 'text-rose-600' : 'text-slate-700';

  return (
    <div className="min-h-[70vh] rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Laboratorio</p>
            <h1 className="mt-2 flex items-center gap-3 text-3xl font-light text-slate-900">
              <FlaskConical className="h-9 w-9 text-violet-500" aria-hidden />
              Signal Lab
            </h1>
            <p className="mt-2 max-w-md text-sm text-slate-600">Una sola sesión cerrada: mano, puntos y resultado.</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                connected ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
              }`}
            >
              {connected ? <Radio className="h-3.5 w-3.5" aria-hidden /> : <WifiOff className="h-3.5 w-3.5" aria-hidden />}
              {connected ? 'En vivo' : 'Sin socket'}
            </span>
            <button
              type="button"
              onClick={() => load()}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Actualizar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-16 text-center text-slate-500">Cargando…</div>
        ) : !session ? (
          <div className="mt-16 rounded-2xl border border-dashed border-slate-300 bg-white/80 px-6 py-14 text-center">
            <p className="text-lg font-medium text-slate-700">Aún no hay una sesión cerrada</p>
            <p className="mt-2 text-sm text-slate-500">Cuando llegue un resultado al tracker, aparecerá aquí.</p>
          </div>
        ) : (
          <div className="mt-10 space-y-8">
            <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-slate-200 pb-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Mesa</p>
                <p className="text-2xl font-semibold text-slate-900">{meta?.mesa ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Tu señal</p>
                <p
                  className={`text-2xl font-bold ${
                    sig?.side === 'PLAYER' ? 'text-sky-600' : sig?.side === 'BANKER' ? 'text-rose-600' : 'text-slate-700'
                  }`}
                >
                  {sig?.side === 'PLAYER' || sig?.side === 'BANKER' ? sig.side : '—'}
                </p>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <HandBlock
                title="Player"
                subtitle="Cartas jugador"
                cards={rst.player?.cards}
                score={rst.player?.score}
                accent="blue"
              />
              <HandBlock
                title="Banker"
                subtitle="Cartas banca"
                cards={rst.banker?.cards}
                score={rst.banker?.score}
                accent="red"
              />
            </div>

            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-10 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Ganador</p>
              <p className={`text-4xl font-black uppercase ${ganadorColor}`}>{ganador}</p>
              <VerdictPill code={eng?.verdict} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const SignalLabPage = memo(SignalLabPageInner);
SignalLabPage.displayName = 'SignalLabPage';
