import React, { memo } from 'react';

const INPUT =
  'w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-500/40';

/**
 * @param {{
 *   email: string,
 *   username: string,
 *   onEmailChange: (v: string) => void,
 *   onUsernameChange: (v: string) => void,
 *   onSave: () => void,
 *   disabled?: boolean,
 *   saving?: boolean,
 * }} props
 */
function EditableFieldsInner({
  email,
  username,
  onEmailChange,
  onUsernameChange,
  onSave,
  disabled,
  saving,
}) {
  return (
    <div className="space-y-3 rounded-xl border border-white/[0.06] bg-slate-950/35 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Email</span>
          <input
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className={INPUT}
            disabled={disabled}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Username</span>
          <input
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
            className={INPUT}
            disabled={disabled}
          />
        </label>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={disabled || saving}
          onClick={onSave}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saving ? 'Guardando…' : 'Guardar información'}
        </button>
      </div>
    </div>
  );
}

export const EditableFields = memo(EditableFieldsInner);
EditableFields.displayName = 'EditableFields';
