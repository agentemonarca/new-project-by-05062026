import React, { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useGpulseSystem } from '../../context/GpulseContext.jsx';
import { dispatchQueueStatsFromSocket } from '../../realtime/queueStatsBridge.js';

/** Aligns with wallet MOCK_TX_STATUS in App.jsx */
const TX_STATUS = {
  PENDING: 'PENDING',
  CONFIRMING: 'CONFIRMING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
};

const FLUSH_MS = 80;

/**
 * Real-time bridge: Socket.io tx + system health (same origin as API by default).
 * No UI — updates GpulseContext and wallet ledger via callbacks.
 * Buffers bursts of socket events and flushes periodically to cut render churn.
 */
export default function GpulseSocketSync({ socketUrl, userAddress, appendWalletTx }) {
  const { setSystemHealth } = useGpulseSystem();
  const appendRef = useRef(appendWalletTx);
  const healthRef = useRef(setSystemHealth);
  appendRef.current = appendWalletTx;
  healthRef.current = setSystemHealth;

  const txQueueRef = useRef([]);
  const healthPendingRef = useRef(null);
  const flushTimerRef = useRef(null);

  const clearFlushTimer = () => {
    if (flushTimerRef.current != null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  };

  const flush = () => {
    clearFlushTimer();
    const batch = txQueueRef.current;
    txQueueRef.current = [];
    for (const entry of batch) {
      appendRef.current(entry);
    }
    const h = healthPendingRef.current;
    healthPendingRef.current = null;
    if (h && typeof h === 'object') {
      healthRef.current?.(h);
    }
  };

  const scheduleFlush = () => {
    if (flushTimerRef.current != null) return;
    flushTimerRef.current = window.setTimeout(() => {
      flushTimerRef.current = null;
      flush();
    }, FLUSH_MS);
  };

  useEffect(() => {
    const base = String(socketUrl || '').trim().replace(/\/$/, '');
    if (!base || typeof window === 'undefined') return undefined;

    const socket = io(base, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    const user = String(userAddress || '').toLowerCase();

    const onTx = (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const addr = String(payload.userAddress || '').toLowerCase();
      if (user && addr && addr !== user) return;

      const rid = String(payload.withdrawalId || '');
      const txHash = String(payload.txHash || '');

      if (payload.status === 'BROADCASTED' && txHash) {
        txQueueRef.current.push({
          kind: 'withdraw',
          token: 'ETH',
          amount: 0,
          note: 'Broadcasting on-chain',
          status: TX_STATUS.CONFIRMING,
          txHash,
          requestId: rid || undefined,
        });
      } else if (payload.status === 'CONFIRMED' && txHash) {
        txQueueRef.current.push({
          kind: 'withdraw',
          token: 'ETH',
          amount: 0,
          note: 'backend withdrawal',
          status: TX_STATUS.COMPLETED,
          txHash,
          requestId: rid || undefined,
        });
      } else if (payload.status === 'FAILED') {
        txQueueRef.current.push({
          kind: 'withdraw',
          token: 'ETH',
          amount: 0,
          status: TX_STATUS.FAILED,
          txHash: rid ? `failed:${rid}` : '',
          requestId: rid || undefined,
        });
      }
      scheduleFlush();
    };

    const onHealth = (h) => {
      if (!h || typeof h !== 'object') return;
      healthPendingRef.current = {
        network: h.network,
        signer: h.signer,
        mempool: h.mempool,
        backend: h.backend,
        riskLevel: h.riskLevel,
      };
      scheduleFlush();
    };

    const onQueueStats = (p) => {
      dispatchQueueStatsFromSocket(p);
    };

    socket.on('tx:update', onTx);
    socket.on('system:health', onHealth);
    socket.on('queue:stats', onQueueStats);

    return () => {
      socket.off('tx:update', onTx);
      socket.off('system:health', onHealth);
      socket.off('queue:stats', onQueueStats);
      clearFlushTimer();
      flush();
      socket.close();
    };
  }, [socketUrl, userAddress]);

  return null;
}
