import { auth, clerkClient } from '@clerk/nextjs/server';
import { getCtx } from '@/lib/ctx';
import { inviteMember, removeMember } from '@/lib/actions';

const roleName = (r: string) => (r === 'org:admin' ? 'Admin' : 'Membro');

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
    <>
      <div className="page-head"><h1>Usuários</h1></div>

      <h2>Membros de {c.brandName}</h2>
      <table>
        <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th></th></tr></thead>
        <tbody>
          {members.data.map((m) => (
            <tr key={m.id}>
              <td>{[m.publicUserData?.firstName, m.publicUserData?.lastName].filter(Boolean).join(' ') || '—'}</td>
              <td>{m.publicUserData?.identifier}</td>
              <td>{roleName(m.role)}</td>
              <td className="right">
                {c.isBrandAdmin && m.publicUserData?.userId !== c.userId && (
                  <form action={removeMember}><input type="hidden" name="userId" value={m.publicUserData?.userId} /><button className="btn small danger">Remover</button></form>
                )}
              </td>
            </tr>
          ))}
          {invites.data.map((i) => (
            <tr key={i.id} className="muted"><td>—</td><td>{i.emailAddress}</td><td>{roleName(i.role)}</td><td className="right">Convite pendente</td></tr>
          ))}
        </tbody>
      </table>

      {c.isBrandAdmin && (
        <form action={inviteMember} className="inline" style={{ marginTop: 16 }}>
          <input name="email" type="email" placeholder="email@exemplo.com" required />
          <select name="role"><option value="org:member">Membro</option><option value="org:admin">Admin</option></select>
          <button className="btn primary">Convidar</button>
        </form>
      )}

      {all && (
        <>
          <h2 style={{ marginTop: 40 }}>Todos os usuários da plataforma <span className="pill">super-admin</span></h2>
          <table>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Criado em</th></tr></thead>
            <tbody>
              {all.data.map((u) => (
                <tr key={u.id}>
                  <td>{[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}</td>
                  <td>{u.primaryEmailAddress?.emailAddress}</td>
                  <td className="muted">{new Date(u.createdAt).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
