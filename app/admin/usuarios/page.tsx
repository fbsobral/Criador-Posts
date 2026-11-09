import { auth, clerkClient } from '@clerk/nextjs/server';
import { getCtx } from '@/lib/ctx';
import { removeMember } from '@/lib/actions';
import { InviteForm } from './invite-form';
import { MemberRole } from './member-role';
import { InviteRow } from './invite-row';
import { PlatformUsers, type POrg, type PUser } from './platform-users';
import { initials } from '@/lib/format';
import { PageHead } from '../ui';

export const metadata = { title: 'Usuários' };

const roleName = (r: string) => (r === 'org:admin' ? 'Administrador' : 'Membro');

export default async function UsersPage() {
  const c = (await getCtx())!;
  const { orgId } = await auth();
  const clerk = await clerkClient();

  const [members, invites] = await Promise.all([
    clerk.organizations.getOrganizationMembershipList({ organizationId: orgId!, limit: 100 }),
    clerk.organizations.getOrganizationInvitationList({ organizationId: orgId!, status: ['pending'], limit: 100 }),
  ]);
  // super-admin: todos os usuários, com as organizações e o nível de cada um (lido por organização, que são poucas)
  let platform: { users: PUser[]; orgs: POrg[] } | null = null;
  if (c.isPlatformAdmin) {
    const [all, orgList] = await Promise.all([
      clerk.users.getUserList({ limit: 200, orderBy: '-created_at' }),
      clerk.organizations.getOrganizationList({ limit: 100 }),
    ]);
    const orgs = orgList.data.map((o) => ({ id: o.id, name: o.name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const lists = await Promise.all(orgs.map((o) => clerk.organizations.getOrganizationMembershipList({ organizationId: o.id, limit: 200 })));
    const byUser = new Map<string, PUser['memberships']>();
    lists.forEach((l, k) => l.data.forEach((m) => {
      const uid = m.publicUserData?.userId;
      if (uid) byUser.set(uid, [...(byUser.get(uid) ?? []), { orgId: orgs[k].id, role: m.role === 'org:admin' ? 'org:admin' : 'org:member' }]);
    }));
    platform = {
      orgs,
      users: all.data.map((u) => ({ id: u.id, name: [u.firstName, u.lastName].filter(Boolean).join(' '), email: u.primaryEmailAddress?.emailAddress ?? '', createdAt: u.createdAt, memberships: byUser.get(u.id) ?? [] })),
    };
  }

  return (
    <div className="page">
      <PageHead title="Usuários" description={`Quem tem acesso a ${c.brandName}. Administradores convidam, removem e mudam o nível das pessoas.`} />

      <div className="card-surface table-card users-t">
        <table>
          <thead><tr><th>Pessoa</th><th className="hide-s">E-mail</th><th>Papel</th><th className="right"></th></tr></thead>
          <tbody>
            {members.data.map((m) => {
              const name = [m.publicUserData?.firstName, m.publicUserData?.lastName].filter(Boolean).join(' ');
              return (
                <tr key={m.id}>
                  <td><div className="person"><span className="av">{initials(name || m.publicUserData?.identifier)}</span><div><b>{name || '—'}</b><small className="show-s">{m.publicUserData?.identifier}</small></div></div></td>
                  <td className="hide-s muted">{m.publicUserData?.identifier}</td>
                  <td>{c.isBrandAdmin && m.publicUserData?.userId && m.publicUserData.userId !== c.userId
                    ? <MemberRole userId={m.publicUserData.userId} role={m.role === 'org:admin' ? 'org:admin' : 'org:member'} />
                    : <span className={`pill ${m.role === 'org:admin' ? 'dark' : ''}`}>{roleName(m.role)}</span>}</td>
                  <td className="right">
                    {c.isBrandAdmin && m.publicUserData?.userId !== c.userId && (
                      <form action={removeMember}><input type="hidden" name="userId" value={m.publicUserData?.userId} /><button className="btn small danger">Remover</button></form>
                    )}
                  </td>
                </tr>
              );
            })}
            {invites.data.map((i) => (
              <InviteRow key={i.emailAddress} id={i.id} email={i.emailAddress} roleLabel={roleName(i.role)} createdAt={i.createdAt} expiresAt={i.expiresAt ?? 0} url={i.url ?? null} canManage={c.isBrandAdmin} />
            ))}
          </tbody>
        </table>
      </div>

      {c.isBrandAdmin && (
        <InviteForm />
      )}

      {platform && <PlatformUsers users={platform.users} orgs={platform.orgs} me={c.userId} />}
    </div>
  );
}
