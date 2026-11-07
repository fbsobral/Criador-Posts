'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createPlatformUser, removePlatformMembership, setPlatformMembership, updatePlatformUser, type Role } from '@/lib/user-admin-actions';
import { initials } from '@/lib/format';
import { IconPlus } from '../../icons';

export type PUser = { id: string; name: string; email: string; createdAt: number; memberships: { orgId: string; role: Role }[] };
export type POrg = { id: string; name: string };

const ROLES: { id: Role; label: string }[] = [{ id: 'org:member', label: 'Membro' }, { id: 'org:admin', label: 'Administrador' }];
const roleLabel = (r: Role) => (r === 'org:admin' ? 'Administrador' : 'Membro');

/** Super-admin: todos os usuários da plataforma, com organização e nível; cadastrar e editar. */
export function PlatformUsers({ users, orgs, me }: { users: PUser[]; orgs: POrg[]; me: string }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PUser | null>(null);
  const [onlyLoose, setOnlyLoose] = useState(false);
  const orgName = useMemo(() => new Map(orgs.map((o) => [o.id, o.name])), [orgs]);
  const loose = users.filter((u) => !u.memberships.length).length;
  const shown = onlyLoose ? users.filter((u) => !u.memberships.length) : users;

  return (
    <>
      <div className="section-title">
        <h2>Todos os usuários da plataforma</h2><span className="pill dark">super-admin</span>
        <button type="button" className="btn small primary pu-new" onClick={() => setCreating(true)}><IconPlus /> Cadastrar usuário</button>
      </div>
      {loose > 0 && (
        <div className="notice pu-loose">
          <span><b>{loose} {loose === 1 ? 'pessoa está' : 'pessoas estão'} sem organização</b> e não {loose === 1 ? 'consegue' : 'conseguem'} usar o app. Edite para escolher a organização.</span>
          <button type="button" className="vd-link" onClick={() => setOnlyLoose(!onlyLoose)}>{onlyLoose ? 'Ver todos' : 'Ver só essas'}</button>
        </div>
      )}
      <div className="card-surface table-card">
        <table>
          <thead><tr><th>Pessoa</th><th>Organizações</th><th className="hide-s">Criado em</th><th className="right"></th></tr></thead>
          <tbody>
            {shown.map((u) => (
              <tr key={u.id}>
                <td><div className="person"><span className="av">{initials(u.name || u.email)}</span><div><b>{u.name || '—'}</b><small>{u.email}</small></div></div></td>
                <td>
                  <div className="pu-orgs">
                    {u.memberships.length ? u.memberships.map((m) => <span key={m.orgId} className={`pill ${m.role === 'org:admin' ? 'dark' : ''}`}>{orgName.get(m.orgId) ?? 'Organização'} · {roleLabel(m.role)}</span>)
                      : <span className="pill pu-none">Sem organização</span>}
                  </div>
                </td>
                <td className="hide-s muted">{new Date(u.createdAt).toLocaleDateString('pt-BR')}</td>
                <td className="right"><button type="button" className="btn small" onClick={() => setEditing(u)}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {creating && <CreateModal orgs={orgs} onClose={() => setCreating(false)} />}
      {editing && <EditModal key={editing.id} user={editing} orgs={orgs} me={me} onClose={() => setEditing(null)} />}
    </>
  );
}

function Modal({ title, children, foot, onClose }: { title: string; children: React.ReactNode; foot: React.ReactNode; onClose: () => void }) {
  return (
    <div className="pe-overlay center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pe-modal pu-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button type="button" className="btn small ghost" onClick={onClose} aria-label="Fechar">✕</button></header>
        <div className="pe-modal-body">{children}</div>
        <footer>{foot}</footer>
      </div>
    </div>
  );
}

function CreateModal({ orgs, onClose }: { orgs: POrg[]; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? '');
  const [r, setR] = useState<Role>('org:member');
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const res = await createPlatformUser({ name, email, orgId, role: r });
    setMsg(res);
    if (res.ok) { setName(''); setEmail(''); router.refresh(); }
  });
  return (
    <Modal title="Cadastrar usuário" onClose={onClose} foot={<><span className="muted">A pessoa entra com este e-mail.</span><button type="button" className="btn primary" disabled={pending || !email.trim() || !orgId} onClick={save}>{pending ? 'Cadastrando…' : 'Cadastrar'}</button></>}>
      <label className="field">Nome<input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Nome e sobrenome" /></label>
      <label className="field">E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" /></label>
      <div className="pu-row">
        <label className="field">Organização<select value={orgId} onChange={(e) => setOrgId(e.target.value)}>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <label className="field">Nível<select value={r} onChange={(e) => setR(e.target.value as Role)}>{ROLES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
      </div>
      <small className="muted">Administrador convida e remove pessoas e muda as configurações da organização. Membro usa o app. Se o e-mail já tiver conta, a pessoa só ganha acesso a esta organização.</small>
      {msg.error && <div className="notice err">{msg.error}</div>}
      {msg.ok && <div className="notice ok">{msg.ok}</div>}
    </Modal>
  );
}

function EditModal({ user, orgs, me, onClose }: { user: PUser; orgs: POrg[]; me: string; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [members, setMembers] = useState(user.memberships);
  const [addOrg, setAddOrg] = useState('');
  const [addRole, setAddRole] = useState<Role>('org:member');
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name ?? 'Organização';
  const free = orgs.filter((o) => !members.some((m) => m.orgId === o.id));
  const run = (fn: () => Promise<{ ok?: string; error?: string }>, after?: () => void) => start(async () => {
    const res = await fn();
    setMsg(res);
    if (res.ok) { after?.(); router.refresh(); }
  });
  const dirty = name !== user.name || email !== user.email;

  return (
    <Modal title="Editar usuário" onClose={onClose} foot={<><span className="muted">Organização e nível são salvos na hora.</span><button type="button" className="btn primary" disabled={pending || !dirty || !email.trim()} onClick={() => run(() => updatePlatformUser({ userId: user.id, name, email }))}>{pending ? 'Salvando…' : 'Salvar nome e e-mail'}</button></>}>
      <label className="field">Nome<input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></label>
      <label className="field">E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {email.trim().toLowerCase() !== user.email.toLowerCase() && <small className="muted">A pessoa passa a entrar com o e-mail novo; o antigo deixa de valer.</small>}
      </label>

      <div className="field">
        <div className="lbl">Organizações e nível</div>
        {!members.length && <div className="notice pu-loose">Sem organização: a pessoa não consegue usar o app. Adicione uma abaixo.</div>}
        <div className="pu-mlist">
          {members.map((m) => (
            <div key={m.orgId} className="pu-m">
              <b>{orgName(m.orgId)}</b>
              <select value={m.role} disabled={pending} onChange={(e) => { const v = e.target.value as Role; run(() => setPlatformMembership({ userId: user.id, orgId: m.orgId, role: v }), () => setMembers((l) => l.map((x) => (x.orgId === m.orgId ? { ...x, role: v } : x)))); }} aria-label={`Nível em ${orgName(m.orgId)}`}>
                {ROLES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
              <button type="button" className="btn small ghost danger" disabled={pending || (user.id === me && members.length === 1)} onClick={() => run(() => removePlatformMembership({ userId: user.id, orgId: m.orgId }), () => setMembers((l) => l.filter((x) => x.orgId !== m.orgId)))}>Remover</button>
            </div>
          ))}
        </div>
        {free.length > 0 && (
          <div className="pu-m pu-add">
            <select value={addOrg} onChange={(e) => setAddOrg(e.target.value)} aria-label="Adicionar a uma organização"><option value="">Adicionar a uma organização…</option>{free.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
            <select value={addRole} onChange={(e) => setAddRole(e.target.value as Role)} aria-label="Nível">{ROLES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
            <button type="button" className="btn small" disabled={pending || !addOrg} onClick={() => { const o = addOrg, rr = addRole; run(() => setPlatformMembership({ userId: user.id, orgId: o, role: rr }), () => { setMembers((l) => [...l, { orgId: o, role: rr }]); setAddOrg(''); }); }}><IconPlus /> Adicionar</button>
          </div>
        )}
      </div>
      {msg.error && <div className="notice err">{msg.error}</div>}
      {msg.ok && <div className="notice ok">{msg.ok}</div>}
    </Modal>
  );
}
