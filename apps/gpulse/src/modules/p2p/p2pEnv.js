/**
 * P2P con backend real solo cuando la variable es exactamente `"true"`.
 * Cualquier otro valor → modo demostración en memoria (sin persistencia).
 */
export const P2P_USE_BACKEND = import.meta.env.VITE_P2P_USE_BACKEND === 'true';
