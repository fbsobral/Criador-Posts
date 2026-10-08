import { auth } from '@clerk/nextjs/server';
import { OrganizationList, OrganizationSwitcher, UserButton } from '@clerk/nextjs';

export default async function Home() {
  const { orgId } = await auth();

  // Tenant = Organization do Clerk. Sem organização ativa, escolhe ou cria uma.
  if (!orgId) {
    return (
      <main className="center">
        <h1>Escolha ou crie sua organização</h1>
        <OrganizationList hidePersonal afterCreateOrganizationUrl="/" afterSelectOrganizationUrl="/" />
      </main>
    );
  }

  return (
    <div className="shell">
      <header className="bar">
        <b>Editor de Carrossel</b>
        <div className="right">
          <OrganizationSwitcher hidePersonal />
          <UserButton />
        </div>
      </header>
      <iframe key={orgId} src="/editor" title="Editor de Carrossel" />
    </div>
  );
}
