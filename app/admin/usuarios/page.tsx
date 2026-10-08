import { auth, clerkClient } from '@clerk/nextjs/server';
import { getCtx } from '@/lib/ctx';
import { inviteMember, removeMember } from '@/lib/actions';
import { initials } from '@/lib/format';
import { IconPlus } from '../../icons';

const roleName = (r: string) => (r === 'org:admin' ? 'Administrador' : 'Membro');

export default async function UsersPage() {
  const c = (await getCtx())!;
  const { orgId } = await auth();
  const clerk = await clerkClient();

  const [members, invites] = await Promise.all([
    clerk.organizations.getOrganizationMembershipList({ organizationId: orgId!, limit: 100 }),
    clerk.organizations.getOrganizationInvitationList({ organizationId: orgId!, status: ['pending'], limit: 100 }),
  ]);
  const all = c.isPlatformAdmin ? await clerk.users.getUserList({ limit: 100, orderBy: '-created_at' }) : null;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Usuários</h1>
          <p>Quem tem acesso a {c.brandName}. Administradores convidam e removem pessoas.</p>
        </div>
      </div>

      <div className="card-surface table-card">
        <table>
          <thead><tr><th>Pessoa</th><th className="hide-s">E-mail</th><th>Papel</th><th className="right"></th></tr></thead>
          <tbody>
            {members.data.map((m) => {
              const name = [m.publicUserData?.firstName, m.publicUserData?.lastName].filter(Boolean).join(' ');
              return (
                <tr key={m.id}>
                  <td><div className="person"><span className="av">{initials(name || m.publicUserData?.identifier)}</span><div><b>{name || '—'}</b><small className="show-s">{m.publicUserData?.identifier}</small></div></div></td>
                  <td className="hide-s muted">{m.publicUserData?.identifier}</td>
                  <td><span className={`pill ${m.role === 'org:admin' ? 'dark' : ''}`}>{roleName(m.role)}</span></td>
                  <td className="right">
                    {c.isBrandAdmin && m.publicUserData?.userId !== c.userId && (
                      <form action={removeMember}><input type="hidden" name="userId" value={m.publicUserData?.userId} /><button className="btn small danger">Remover</button></form>
                    )}
                  </td>
                </tr>
              );
            })}
            {invites.data.map((i) => (
              <tr key={i.id}>
                <td><div className="person"><span className="av" style={{ background: '#d8d2c3' }}>@</span><div><b className="muted">Convite enviado</b></div></div></td>
                <td className="hide-s muted">{i.emailAddress}</td>
                <td><span className="pill">{roleName(i.role)}</span></td>
                <td className="right"><span className="pill draft">Pendente</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {c.isBrandAdmin && (
        <form action={inviteMember} className="card-surface invite">
          <input name="email" type="email" placeholder="email@exemplo.com" required />
          <select name="role"><option value="org:member">Membro</option><option value="org:admin">Administrador</option></select>
          <button className="btn primary"><IconPlus /> Convidar</button>
        </form>
      )}

      {all && (
        <>
          <div className="section-title"><h2>Todos os usuários da plataforma</h2><span className="pill dark">super-admin</span></div>
          <div className="card-surface table-card">
            <table>
              <thead><tr><th>Pessoa</th><th className="hide-s">E-mail</th><th className="hide-s">Criado em</th></tr></thead>
              <tbody>
                {all.data.map((u) => {
                  const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
                  return (
                    <tr key={u.id}>
                      <td><div className="person"><span className="av">{initials(name || u.primaryEmailAddress?.emailAddress)}</span><div><b>{name || '—'}</b><small className="show-s">{u.primaryEmailAddress?.emailAddress}</small></div></div></td>
                      <td className="hide-s muted">{u.primaryEmailAddress?.emailAddress}</td>
                      <td className="hide-s muted">{new Date(u.createdAt).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
