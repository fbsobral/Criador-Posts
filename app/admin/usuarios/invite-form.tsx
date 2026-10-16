'use client';

import { useActionState } from 'react';
import { inviteMember, type InviteState } from '@/lib/actions';
import { IconPlus } from '../../icons';

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteMember, null);
  return (
    <form action={action} className="card-surface invite">
      <input name="email" type="email" placeholder="email@exemplo.com" required />
      <select name="role"><option value="org:member">Membro</option><option value="org:admin">Administrador</option></select>
      <button className="btn primary" disabled={pending}><IconPlus /> {pending ? 'Enviando…' : 'Convidar'}</button>
      {state?.error && <p role="alert" style={{ flexBasis: '100%', color: '#C8341F', fontSize: 13.5 }}>{state.error}</p>}
      {state?.ok && <p role="status" style={{ flexBasis: '100%', color: '#1F9D63', fontSize: 13.5 }}>{state.ok}</p>}
    </form>
  );
}
