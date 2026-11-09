'use client';

import { useActionState, useState } from 'react';
import { inviteMember, type InviteState } from '@/lib/actions';
import { IconPlus } from '../../icons';

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteMember, null);
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} className="card-surface invite">
      <input name="email" type="email" placeholder="email@exemplo.com" required />
      <select name="role"><option value="org:member">Membro</option><option value="org:admin">Administrador</option></select>
      <button className="btn primary" disabled={pending}><IconPlus /> {pending ? 'Enviando…' : 'Convidar'}</button>
      {state?.error && <p role="alert" style={{ flexBasis: '100%', color: '#C8341F', fontSize: 13.5 }}>{state.error}</p>}
      {state?.ok && <p role="status" style={{ flexBasis: '100%', color: '#1F9D63', fontSize: 13.5 }}>{state.ok} {state.url && <button type="button" className="vd-link" onClick={() => { navigator.clipboard?.writeText(state.url!).then(() => setCopied(true)).catch(() => {}); }}>{copied ? 'Link copiado ✓' : 'Copiar o link do convite'}</button>}</p>}
      <p className="muted" style={{ flexBasis: '100%', fontSize: 12.5, margin: 0 }}>O convite chega por e-mail. Se a pessoa não encontrar, peça para olhar o spam ou as promoções, ou copie o link do convite e mande por WhatsApp.</p>
    </form>
  );
}
