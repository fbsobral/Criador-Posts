import { OrganizationList, OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { getCtx } from '@/lib/ctx';
import { NavLink } from './nav-link';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { orgId } = await auth();

  // Marca (tenant) = Organization do Clerk. Sem marca ativa, escolhe ou cria uma.
  if (!orgId) {
    return (
      <main className="center">
        <h1>Escolha ou crie sua marca</h1>
        <OrganizationList hidePersonal afterCreateOrganizationUrl="/admin/posts" afterSelectOrganizationUrl="/admin/posts" />
      </main>
    );
  }
  const c = (await getCtx())!;

  return (
    <div className="admin">
      <aside className="side">
        <div className="side-top">
          <b>Criador de Posts</b>
          <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/admin/posts" afterCreateOrganizationUrl="/admin/posts" />
        </div>
        <nav>
          <div className="group">{c.brandName}</div>
          <NavLink href="/admin/posts" indent>Posts</NavLink>
          <NavLink href="/admin/configuracoes" indent>Configurações</NavLink>
          <NavLink href="/admin/templates">Templates</NavLink>
          <NavLink href="/admin/usuarios">Usuários</NavLink>
        </nav>
        <div className="side-bottom"><UserButton showName /></div>
      </aside>
      <section className="content">{children}</section>
    </div>
  );
}
