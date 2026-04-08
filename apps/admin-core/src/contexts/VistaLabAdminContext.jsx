import React, { createContext, useContext } from 'react';

/** @type {React.Context<{ snap: object, cycle: object } | null>} */
const VistaLabAdminContext = createContext(null);

/** @param {{ children: React.ReactNode, value: { snap: object, cycle: object } }} props */
export function VistaLabAdminProvider({ children, value }) {
  return <VistaLabAdminContext.Provider value={value}>{children}</VistaLabAdminContext.Provider>;
}

/** @returns {{ snap: object, cycle: object }} */
export function useVistaLabAdmin() {
  const ctx = useContext(VistaLabAdminContext);
  if (ctx == null) {
    throw new Error('useVistaLabAdmin: falta VistaLabAdminProvider (envuelve /admin).');
  }
  return ctx;
}
