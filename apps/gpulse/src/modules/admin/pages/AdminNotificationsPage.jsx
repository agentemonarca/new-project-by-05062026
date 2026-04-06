import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { useAdmin } from '../context/AdminContext.jsx';
import { AdminPageHeader } from './AdminPageHeader.jsx';
import { staggerContainer, fadeUpBlur } from '@/ui-genesis/motion/variants.js';

export function AdminNotificationsPage() {
  const { state, sendEmailUser, sendInternal, sendBulk, resendVerify } = useAdmin();
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('Comunicado AiGenesis');
  const [emailBody, setEmailBody] = useState('');
  const [bulkEmails, setBulkEmails] = useState('');
  const [inUser, setInUser] = useState('');
  const [inTitle, setInTitle] = useState('');
  const [inBody, setInBody] = useState('');
  const [verifyEmail, setVerifyEmail] = useState('');

  const allEmails = useCallback(
    () => (state.users || []).map((u) => u.email).filter(Boolean),
    [state.users],
  );

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <AdminPageHeader
        eyebrow="Comunicaciones"
        title="Mensajería operativa"
        subtitle="Email individual, masivo, in-app y reenvío de verificación — todo mock hasta SMTP real."
      />

      <motion.div variants={fadeUpBlur} className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-5">
          <h3 className="text-sm font-semibold text-white">Email individual</h3>
          <input
            className="mt-3 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
            placeholder="Para"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
          />
          <input
            className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
            placeholder="Asunto"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
          />
          <textarea
            className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
            rows={3}
            placeholder="Cuerpo"
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
          />
          <button
            type="button"
            onClick={() => sendEmailUser(emailTo, emailSubject, emailBody)}
            className="mt-3 w-full rounded-xl bg-cyan-600 py-2 text-sm font-semibold text-white"
          >
            Enviar email
          </button>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-5">
          <h3 className="text-sm font-semibold text-white">Email masivo</h3>
          <p className="mt-1 text-xs text-slate-500">Un correo por línea, o botón para cargar todos los usuarios demo.</p>
          <textarea
            className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 font-mono text-xs"
            rows={4}
            placeholder="a@x.com\nb@y.com"
            value={bulkEmails}
            onChange={(e) => setBulkEmails(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setBulkEmails(allEmails().join('\n'))}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-300"
            >
              Pegar lista usuarios mock
            </button>
            <button
              type="button"
              onClick={() =>
                sendBulk(
                  bulkEmails.split(/\s+/).filter(Boolean),
                  emailSubject,
                  emailBody,
                )
              }
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Enviar masivo
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-5">
          <h3 className="text-sm font-semibold text-white">Notificación interna</h3>
          <input
            className="mt-3 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
            placeholder="User ID"
            value={inUser}
            onChange={(e) => setInUser(e.target.value)}
          />
          <input
            className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
            placeholder="Título"
            value={inTitle}
            onChange={(e) => setInTitle(e.target.value)}
          />
          <textarea
            className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
            rows={2}
            placeholder="Cuerpo"
            value={inBody}
            onChange={(e) => setInBody(e.target.value)}
          />
          <button
            type="button"
            onClick={() => sendInternal(inUser.trim(), inTitle, inBody)}
            className="mt-3 w-full rounded-xl border border-violet-500/35 bg-violet-500/15 py-2 text-sm font-medium text-violet-100"
          >
            Enviar in-app
          </button>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-5">
          <h3 className="text-sm font-semibold text-white">Reenviar código de verificación</h3>
          <input
            className="mt-3 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
            placeholder="Email"
            value={verifyEmail}
            onChange={(e) => setVerifyEmail(e.target.value)}
          />
          <button
            type="button"
            onClick={() => resendVerify(verifyEmail)}
            className="mt-3 w-full rounded-xl bg-amber-600/85 py-2 text-sm font-semibold text-white"
          >
            Reenviar código (mock)
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
