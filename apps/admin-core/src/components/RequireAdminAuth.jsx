import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';
import { redirectToAdminLogin } from '../lib/adminAuthRedirect.js';

export default function RequireAdminAuth({ children }) {
  const { status, admin } = useAdminAuth();

  useEffect(() => {
    if (status !== 'ready') return;
    if (!admin) redirectToAdminLogin();
  }, [status, admin]);

  if (status !== 'ready') {
    return (
      <div className="flex min-h-full flex-col items-center justify-center bg-[#05080f]">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" aria-hidden />
          <p className="text-sm">Comprobando sesión…</p>
        </div>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center bg-[#05080f]">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" aria-hidden />
          <p className="text-sm">Redirigiendo…</p>
        </div>
      </div>
    );
  }

  return children;
}
