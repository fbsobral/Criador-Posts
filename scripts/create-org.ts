import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

// Uso: npm run org:create -- "D.C.T-Youts" fbsobral@gmail.com
// Cria a organização (marca) no Clerk com o usuário informado como admin.
async function main() {
  const [name, email] = process.argv.slice(2);
  if (!name || !email) throw new Error('Uso: npm run org:create -- "Nome da marca" email@dono.com');

  const { createClerkClient } = await import('@clerk/backend');
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

  const { data: found } = await clerk.users.getUserList({ emailAddress: [email] });
  if (!found.length) throw new Error(`Usuário ${email} não existe no Clerk. Crie no dashboard (Users → Create user) primeiro.`);

  const existing = await clerk.organizations.getOrganizationList({ query: name, limit: 20 });
  if (existing.data.some((o) => o.name === name)) {
    console.log(`Organização "${name}" já existe.`);
    return;
  }
  const org = await clerk.organizations.createOrganization({ name, createdBy: found[0].id });
  console.log(`Organização "${org.name}" criada (${org.id}); admin: ${email}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e.message ?? e); process.exit(1); });
