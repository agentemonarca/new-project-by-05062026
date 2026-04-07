import { useEffect, useState } from 'react';
import getAdminSignalsSocket from '../services/socket-admin.js';

export default function AdminSignalsRealtimePanel() {
  const [signals, setSignals] = useState([]);
  const [results, setResults] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getAdminSignalsSocket();

    const onConnect = () => {
      setConnected(true);
      console.log('🟢 conectado admin-signals');
    };
    const onDisconnect = () => setConnected(false);
    const onConnectError = (err) => {
      setConnected(false);
      console.error('❌ socket error:', err?.message || err);
    };
    const onSignal = (data) => {
      setSignals((prev) => [data, ...prev].slice(0, 50));
    };
    const onResult = (data) => {
      setResults((prev) => [data, ...prev].slice(0, 50));
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('NEW_SIGNAL', onSignal);
    socket.on('NEW_RESULT', onResult);

    let onDebug = /** @type {((...args: unknown[]) => void) | null} */ (null);
    let onAny = /** @type {((...args: unknown[]) => void) | null} */ (null);

    if (import.meta.env.VITE_ADMIN_SIGNALS_DEBUG === '1') {
      onDebug = (data) => {
        console.log('🧠 DEBUG STREAM', data);
      };
      onAny = (event, ...args) => {
        const data = args.length <= 1 ? args[0] : args;
        console.log('[REALTIME]', event, data);
      };
      socket.on('DEBUG_STREAM', onDebug);
      socket.onAny(onAny);
    }

    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('NEW_SIGNAL', onSignal);
      socket.off('NEW_RESULT', onResult);
      if (onDebug) socket.off('DEBUG_STREAM', onDebug);
      if (onAny) socket.offAny(onAny);
    };
  }, []);

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-slate-100">
      <p className="mb-3 text-sm font-medium">
        {connected ? (
          <span className="text-emerald-400">🟢 conectado</span>
        ) : (
          <span className="text-rose-400">🔴 desconectado</span>
        )}
      </p>
      <h2 className="mb-2 text-lg font-semibold">🔥 Señales en Vivo</h2>
      {signals.map((s, i) => (
        <div key={i} className="font-mono text-sm">
          {String(s?.mesa ?? '')} - {String(s?.recommendation ?? '')} - M{String(s?.martingale ?? '')}{' '}
          <span className="text-slate-500">
            {s?.serverTs != null ? new Date(Number(s.serverTs)).toLocaleTimeString() : ''}
          </span>
        </div>
      ))}

      <h2 className="mt-6 mb-2 text-lg font-semibold">📊 Resultados</h2>
      {results.map((r, i) => (
        <div key={i} className="font-mono text-sm">
          {String(r?.mesa ?? '')} - {String(r?.ganador ?? '')} - {String(r?.winStatus ?? '')}{' '}
          <span className="text-slate-500">
            {r?.serverTs != null ? new Date(Number(r.serverTs)).toLocaleTimeString() : ''}
          </span>
        </div>
      ))}
    </div>
  );
}
