import { OrganizationList, OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { onboardingSeen } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { IconSpark } from '../icons';
import { MobileNav } from './mobile-nav';
import { NAV } from './nav-config';
import { GuideProvider, HelpButton } from './guia/guide-provider';
import { NavLink } from './nav-link';
import { OrgSync } from './org-sync';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { orgId } = await auth();

  // Marca (tenant) = Organization do Clerk. Sem marca ativa, escolhe ou cria uma.
  if (!orgId) {
    return (
      <main className="center auth-bg">
        <div className="auth-brand"><span className="mark"><IconSpark /></span>Criador de Posts</div>
        <h1 style={{ fontSize: 22 }}>Escolha ou crie sua marca</h1>
        <p className="auth-tag">Cada marca tem seus próprios posts, configurações e equipe.</p>
        <OrganizationList hidePersonal afterCreateOrganizationUrl="/admin" afterSelectOrganizationUrl="/admin" />
      </main>
    );
  }
  const c = (await getCtx())!;
  // guias que este usuário já viu; se a leitura falhar, não mostra nada (melhor que atrapalhar o uso)
  const seen = await db.select({ key: onboardingSeen.key }).from(onboardingSeen).where(eq(onboardingSeen.userId, c.userId)).then((r) => r.map((x) => x.key)).catch(() => ['geral', 'posts', 'gerar', 'galeria', 'templates', 'roteiros', 'substack', 'personas', 'territorios', 'ideias', 'configuracoes', 'usuarios']);

  return (
    <GuideProvider seen={seen}>
    <div className="admin">
      <OrgSync serverOrgId={orgId} />
      <aside className="side">
        <div className="side-top">
          <div className="logo-row"><span className="mark"><IconSpark /></span><span>Criador de Posts</span></div>
          <OrganizationSwitcher
            hidePersonal
            afterSelectOrganizationUrl="/admin"
            afterCreateOrganizationUrl="/admin"
            appearance={{ elements: { rootBox: { maxWidth: '100%' }, organizationSwitcherTrigger: { borderRadius: 12, border: '1px solid #E8E3D8', padding: '6px 10px', background: '#fff' } } }}
          />
        </div>
        <nav>
          <div className="brand-chip">
            <span className="av">{c.brandName.slice(0, 1).toUpperCase()}</span>
            <div style={{ minWidth: 0 }}><b>{c.brandName}</b><small>{c.isBrandAdmin ? 'Administrador' : 'Membro'}</small></div>
          </div>
          {NAV.map((g) => (
            <div key={g.label} style={{ display: 'contents' }}>
              <div className="nav-label">{g.label}</div>
              {g.items.map((it) => <NavLink key={it.href} href={it.href} icon={it.icon} exclude={it.exclude} also={it.also} exact={it.exact}>{it.label}</NavLink>)}
            </div>
          ))}
        </nav>
        <div className="side-bottom"><HelpButton /><UserButton showName /></div>
      </aside>
      <MobileNav brandName={c.brandName} role={c.isBrandAdmin ? 'Administrador' : 'Membro'} />
      <section className="content">{children}</section>
    </div>
    </GuideProvider>
  );
}
