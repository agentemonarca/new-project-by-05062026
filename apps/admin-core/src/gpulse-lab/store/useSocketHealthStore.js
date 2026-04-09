import { create } from 'zustand';

/** @typedef {'connected' | 'disconnected' | 'reconnecting'} SocketHealthStatus */

export const useSocketHealthStore = create((set) => ({
  /** @type {SocketHealthStatus} */
  status: 'disconnected',
  lastDisconnectReason: null,
  reconnectAttempt: 0,

  setConnected() {
    set({ status: 'connected', reconnectAttempt: 0, lastDisconnectReason: null });
  },

  setDisconnected(reason) {
    set({
      status: 'disconnected',
      lastDisconnectReason: reason != null ? String(reason) : null,
    });
  },

  setReconnecting(attempt) {
    set({
      status: 'reconnecting',
      reconnectAttempt: typeof attempt === 'number' ? attempt : 0,
    });
  },

  setReconnectFailed() {
    set({ status: 'disconnected', reconnectAttempt: 0 });
  },
}));
