'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { resendInvitation, revokeInvitation } from '@/lib/user-admin-actions';

const ago = (ms: number) => {
  const d = Math.floor((Date.now() - ms) / 86_400_000);
  if (d <= 0) { const h = Math.floor((Date.now() - ms) / 3_600_000); return h <= 0 ? 'agora há pouco' : `há ${h} h`; }
  return d === 1 ? 'ontem' : `há ${d} dias`;
};
const fmt = (ms: number) => new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

/** Convite pendente: quando foi enviado, até quando vale e as ações (reenviar, copiar o link, cancelar). */
export function InviteRow({ id, email, roleLabel, createdAt, expiresAt, url, canManage }: { id: string; email: string; roleLabel: string; createdAt: number; expiresAt: number; url: string | null; canManage: boolean }) {
  const router = useRouter();
  const [link, setLink] = useState(url);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const expired = expiresAt > 0 && expiresAt < Date.now();

  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setMsg({ ok: 'Link copiado. Mande por WhatsApp ou mensagem: a pessoa abre e cria a conta já na marca.' }); }
    catch { setMsg({ error: 'Não deu para copiar. Selecione e copie o link abaixo.' }); }
  };

  return (
    <tr>
      <td>
        <div className="person"><span className="av" style={{ background: '#d8d2c3' }}>@</span><div>
          <b className="muted">{expired ? 'Convite expirado' : 'Convite enviado'}</b>
          <small>{ago(createdAt)}{expiresAt > 0 ? ` · ${expired ? 'expirou' : 'vale até'} ${fmt(expiresAt)}` : ''}</small>
          <small className="show-s">{email}</small>
        </div></div>
        {msg.ok && <p className="inv-msg ok">{msg.ok}</p>}
        {msg.error && <p className="inv-msg err">{msg.error}</p>}
        {msg.error && link && <input className="inv-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Link do convite" />}
      </td>
      <td className="hide-s muted">{email}</td>
      <td><span className="pill">{roleLabel}</span></td>
      <td className="right">
        {canManage ? (
          <div className="inv-actions">
            {link && <button type="button" className="btn small" disabled={pending} onClick={copy} title="Copia o link do convite para mandar por outro canal">Copiar link</button>}
            <button type="button" className="btn small" disabled={pending} onClick={() => start(async () => { const r = await resendInvitation(id); setMsg(r); if (r.ok) { setLink(r.url ?? null); router.refresh(); } })}>{pending ? '…' : 'Reenviar'}</button>
            <button type="button" className="btn small ghost danger" disabled={pending} onClick={() => { if (confirm(`Cancelar o convite de ${email}? O link deixa de funcionar.`)) start(async () => { const r = await revokeInvitation(id); setMsg(r); if (r.ok) router.refresh(); }); }}>Cancelar</button>
          </div>
        ) : <span className="pill draft">Pendente</span>}
      </td>
    </tr>
  );
}
