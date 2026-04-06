import {
  ArrowLeftRight,
  BarChart3,
  GitBranch,
  Gift,
  LayoutDashboard,
  Mail,
  Server,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';

/** @typedef {{ id: string, label: string, icon: import('lucide-react').LucideIcon, description?: string }} AdminNavItem */

/** @type {readonly AdminNavItem[]} */
export const ADMIN_NAV_SECTIONS = Object.freeze([
  { id: 'overview', label: 'Vista general', icon: LayoutDashboard, description: 'Pulso y KPIs ejecutivos' },
  { id: 'users', label: 'Usuarios', icon: Users, description: 'Control total de cuentas' },
  { id: 'network', label: 'Red / Binario', icon: GitBranch, description: 'Volumen y posiciones' },
  { id: 'wallet', label: 'Wallet', icon: Wallet, description: 'Tesorería y retiros' },
  { id: 'bonuses', label: 'Recompensas', icon: Gift, description: 'Bonos y pagos' },
  { id: 'p2p', label: 'P2P', icon: ArrowLeftRight, description: 'Mercado y órdenes' },
  { id: 'config', label: 'Configuración', icon: Settings, description: 'Cerebro del sistema' },
  { id: 'notifications', label: 'Comunicaciones', icon: Mail, description: 'Email e in-app' },
  { id: 'security', label: 'Seguridad', icon: ShieldCheck, description: 'Auditoría y accesos' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, description: 'Métricas y cohortes' },
  { id: 'system', label: 'Sistema', icon: Server, description: 'Salud y entorno' },
]);

/** @type {readonly string[]} */
export const ADMIN_MODULE_IDS = Object.freeze(ADMIN_NAV_SECTIONS.map((s) => s.id));
