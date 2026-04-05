import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

/**
 * Subscribe to G-Pulse Socket.io — tx:update, balance:update, system:health.
 *
 * @param {string} url — API origin (e.g. http://localhost:5050)
 * @param {object} handlers
 */
export function useSocket(url, handlers = {}) {
  const hRef = useRef(handlers);
  hRef.current = handlers;

  useEffect(() => {
    const base = String(url || '').trim().replace(/\/$/, '');
    if (!base || typeof window === 'undefined') return undefined;

      const socket = io(base, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
      });

    const onTx = (ev) => hRef.current.onTxUpdate?.(ev);
    const onBal = (ev) => hRef.current.onBalanceUpdate?.(ev);
    const onHealth = (ev) => hRef.current.onSystemHealth?.(ev);

    socket.on('tx:update', onTx);
    socket.on('balance:update', onBal);
    socket.on('system:health', onHealth);

    return () => {
      socket.off('tx:update', onTx);
      socket.off('balance:update', onBal);
      socket.off('system:health', onHealth);
      socket.close();
    };
  }, [url]);
}

export { io };
