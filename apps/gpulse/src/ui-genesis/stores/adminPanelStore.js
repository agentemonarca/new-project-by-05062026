import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ADMIN_MODULE_IDS } from '../admin/adminNavConfig.js';

/**
 * Navegación global del Admin Core — persiste última sección en el cliente.
 */
export const useAdminPanelStore = create(
  persist(
    (set, get) => ({
      /** @type {string} */
      activeModule: 'overview',
      /** @param {string} id */
      setActiveModule: (id) => {
        const next = String(id ?? '').trim();
        if (!ADMIN_MODULE_IDS.includes(next)) return;
        set({ activeModule: next });
      },
      /** @returns {string} */
      getActiveModule: () => get().activeModule,
    }),
    {
      name: 'aigenesis-admin-panel-v1',
      partialize: (s) => ({ activeModule: s.activeModule }),
    },
  ),
);
