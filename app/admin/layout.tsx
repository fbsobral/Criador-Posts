import { OrganizationList, OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { getCtx } from '@/lib/ctx';
import { IconPosts, IconSettings, IconSpark, IconTemplates, IconUsers } from '../icons';
import { NavLink } from './nav-link';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { orgId } = await auth();

  // Marca (tenant) = Organization do Clerk. Sem marca ativa, escolhe ou cria uma.
  if (!orgId) {
    return (
      <main className="center auth-bg">
        <div className="auth-brand"><span className="mark"><IconSpark /></span>Criador de Posts</div>
        <h1 style={{ fontSize: 22 }}>Escolha ou crie sua marca</h1>
        <p className="auth-tag">Cada marca tem seus próprios posts, configurações e equipe.</p>
        <OrganizationList hidePersonal afterCreateOrganizationUrl="/admin/posts" afterSelectOrganizationUrl="/admin/posts" />
      </main>
    );
  }
  const c = (await getCtx())!;

  return (
    <div className="admin">
      <aside className="side">
        <div className="side-top">
          <div className="logo-row"><span className="mark"><IconSpark /></span><span>Criador de Posts</span></div>
          <OrganizationSwitcher
            hidePersonal
            afterSelectOrganizationUrl="/admin/posts"
            afterCreateOrganizationUrl="/admin/posts"
            appearance={{ elements: { rootBox: { maxWidth: '100%' }, organizationSwitcherTrigger: { borderRadius: 12, border: '1px solid #E8E3D8', padding: '6px 10px', background: '#fff' } } }}
          />
        </div>
        <nav>
          <div className="brand-chip">
            <span className="av">{c.brandName.slice(0, 1).toUpperCase()}</span>
            <div style={{ minWidth: 0 }}><b>{c.brandName}</b><small>{c.isBrandAdmin ? 'Administrador' : 'Membro'}</small></div>
          </div>
          <div className="nav-label">Marca</div>
          <NavLink href="/admin/posts" icon={<IconPosts />}>Posts</NavLink>
          <NavLink href="/admin/gerar" icon={<IconSpark />}>Gerar com IA</NavLink>
          <NavLink href="/admin/configuracoes" icon={<IconSettings />}>Configurações</NavLink>
          <div className="nav-label">Geral</div>
          <NavLink href="/admin/templates" icon={<IconTemplates />}>Templates</NavLink>
          <NavLink href="/admin/usuarios" icon={<IconUsers />}>Usuários</NavLink>
        </nav>
        <div className="side-bottom"><UserButton showName /></div>
      </aside>
      <section className="content">{children}</section>
    </div>
  );
}
