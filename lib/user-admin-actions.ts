'use server';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { users } from '@/db/schema';
import { ensureBrand, getCtx } from '@/lib/ctx';

/** Gestão de usuários pela plataforma (super-admin) e troca de nível pelo admin da marca. Tudo passa pelo Clerk, que é quem guarda usuários e organizações. */

export type Role = 'org:admin' | 'org:member';
type Result = { ok?: string; error?: string };

const role = (v: unknown): Role => (v === 'org:admin' ? 'org:admin' : 'org:member');
const isEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v);
const splitName = (full: string) => { const p = full.trim().replace(/\s+/g, ' ').split(' '); return { firstName: p[0] ?? '', lastName: p.slice(1).join(' ') }; };
const done = () => revalidatePath('/admin/usuarios');

function msg(e: unknown, fallback: string): string {
  const err = e as { errors?: { code?: string; longMessage?: string; message?: string }[]; message?: string };
  const first = err?.errors?.[0];
  const code = first?.code ?? '';
  if (code === 'form_identifier_exists') return 'Este e-mail já é usado por outra conta.';
  if (code === 'duplicate_record' || code === 'already_a_member_in_organization') return 'Esta pessoa já faz parte desta organização.';
  if (code === 'form_identifier_invalid' || code === 'form_param_format_invalid') return 'E-mail inválido.';
  if (code === 'organization_membership_quota_exceeded') return 'Limite de membros do plano do Clerk atingido.';
  if (code === 'form_password_incorrect' || code === 'form_param_missing') return 'O Clerk exige mais dados para criar a conta (verifique as opções de login no painel do Clerk).';
  console.error('[usuarios]', JSON.stringify(err?.errors ?? String(e)));
  return first?.longMessage || first?.message || fallback;
}

async function platformAdmin() {
  const c = await getCtx();
  if (!c?.isPlatformAdmin) throw new Error('Apenas o super-admin pode gerenciar usuários da plataforma.');
  return c;
}

/** Não deixa uma organização ficar sem nenhum administrador. */
async function wouldLeaveNoAdmin(organizationId: string, userId: string, next: Role | null) {
  if (next === 'org:admin') return false;
  const list = await (await clerkClient()).organizations.getOrganizationMembershipList({ organizationId, limit: 200 });
  const admins = list.data.filter((m) => m.role === 'org:admin').map((m) => m.publicUserData?.userId);
  return admins.length === 1 && admins[0] === userId;
}

async function orgName(organizationId: string) {
  return (await (await clerkClient()).organizations.getOrganization({ organizationId })).name;
}

/** Cadastra um usuário já dentro de uma organização. Se o e-mail já tem conta, só acrescenta a organização. */
export async function createPlatformUser(input: { name: string; email: string; orgId: string; role: Role }): Promise<Result> {
  try { await platformAdmin(); } catch (e) { return { error: (e as Error).message }; }
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim().slice(0, 120);
  if (!isEmail(email)) return { error: 'Informe um e-mail válido.' };
  if (!input.orgId) return { error: 'Escolha a organização.' };
  const clerk = await clerkClient();
  try {
    const { data: found } = await clerk.users.getUserList({ emailAddress: [email] });
    let user = found[0];
    const existed = !!user;
    if (!user) {
      // sem senha: a pessoa entra com o e-mail (código por e-mail ou "Esqueci a senha", conforme o login do Clerk)
      user = await clerk.users.createUser({ emailAddress: [email], ...splitName(name), skipPasswordRequirement: true });
    }
    await clerk.organizations.createOrganizationMembership({ organizationId: input.orgId, userId: user.id, role: role(input.role) });
    const org = await orgName(input.orgId);
    await ensureBrand(input.orgId, org);
    await db.insert(users).values({ id: user.id, email, name: name || null }).onConflictDoNothing();
    done();
    return { ok: existed ? `${email} já tinha conta e agora faz parte de ${org}.` : `${name || email} cadastrado em ${org}. Na primeira entrada, a pessoa usa este e-mail (código por e-mail ou "Esqueci a senha").` };
  } catch (e) { return { error: msg(e, 'Não foi possível cadastrar o usuário.') }; }
}

/** Edita nome e e-mail de um usuário existente. */
export async function updatePlatformUser(input: { userId: string; name: string; email: string }): Promise<Result> {
  try { await platformAdmin(); } catch (e) { return { error: (e as Error).message }; }
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim().slice(0, 120);
  if (!isEmail(email)) return { error: 'Informe um e-mail válido.' };
  const clerk = await clerkClient();
  try {
    const u = await clerk.users.getUser(input.userId);
    await clerk.users.updateUser(u.id, splitName(name));
    const current = u.emailAddresses.find((x) => x.id === u.primaryEmailAddressId);
    if (current?.emailAddress.toLowerCase() !== email) {
      const existing = u.emailAddresses.find((x) => x.emailAddress.toLowerCase() === email);
      // o e-mail novo vira o principal (já verificado, porque quem troca é o super-admin) e os antigos saem
      if (existing) await clerk.emailAddresses.updateEmailAddress(existing.id, { primary: true, verified: true });
      else await clerk.emailAddresses.createEmailAddress({ userId: u.id, emailAddress: email, primary: true, verified: true });
      for (const old of u.emailAddresses) if (old.emailAddress.toLowerCase() !== email) await clerk.emailAddresses.deleteEmailAddress(old.id);
    }
    await db.insert(users).values({ id: u.id, email, name: name || null }).onConflictDoUpdate({ target: users.id, set: { email, name: name || null } });
    done();
    return { ok: 'Dados salvos.' };
  } catch (e) { return { error: msg(e, 'Não foi possível salvar.') }; }
}

/** Coloca o usuário numa organização ou troca o nível dele nela. */
export async function setPlatformMembership(input: { userId: string; orgId: string; role: Role }): Promise<Result> {
  let c; try { c = await platformAdmin(); } catch (e) { return { error: (e as Error).message }; }
  const clerk = await clerkClient();
  const r = role(input.role);
  try {
    const list = await clerk.users.getOrganizationMembershipList({ userId: input.userId, limit: 100 });
    const has = list.data.find((m) => m.organization.id === input.orgId);
    if (has) {
      if (has.role === r) return { ok: 'Nada mudou.' };
      if (await wouldLeaveNoAdmin(input.orgId, input.userId, r)) return { error: 'Esta é a única pessoa administradora da organização. Promova outra pessoa antes.' };
      if (input.userId === c.userId && r !== 'org:admin') return { error: 'Você não pode tirar o seu próprio acesso de administrador por aqui.' };
      await clerk.organizations.updateOrganizationMembership({ organizationId: input.orgId, userId: input.userId, role: r });
    } else {
      await clerk.organizations.createOrganizationMembership({ organizationId: input.orgId, userId: input.userId, role: r });
      await ensureBrand(input.orgId, await orgName(input.orgId));
    }
    done();
    return { ok: has ? 'Nível alterado.' : 'Organização adicionada.' };
  } catch (e) { return { error: msg(e, 'Não foi possível alterar a organização.') }; }
}

/** Tira o usuário de uma organização. */
export async function removePlatformMembership(input: { userId: string; orgId: string }): Promise<Result> {
  let c; try { c = await platformAdmin(); } catch (e) { return { error: (e as Error).message }; }
  const { orgId: activeOrg } = await auth();
  if (input.userId === c.userId && input.orgId === activeOrg) return { error: 'Você não pode sair da organização em que está agora.' };
  try {
    if (await wouldLeaveNoAdmin(input.orgId, input.userId, null)) return { error: 'Esta é a única pessoa administradora da organização. Promova outra pessoa antes.' };
    await (await clerkClient()).organizations.deleteOrganizationMembership({ organizationId: input.orgId, userId: input.userId });
    done();
    return { ok: 'Removido da organização.' };
  } catch (e) { return { error: msg(e, 'Não foi possível remover.') }; }
}

/** Admin da marca: troca o nível de um membro da organização atual. */
export async function setMemberRole(input: { userId: string; role: Role }): Promise<Result> {
  const { userId, orgId, has } = await auth();
  if (!userId || !orgId || !has({ role: 'org:admin' })) return { error: 'Apenas administradores da marca podem mudar o nível.' };
  if (input.userId === userId) return { error: 'Você não pode mudar o seu próprio nível.' };
  const r = role(input.role);
  try {
    if (await wouldLeaveNoAdmin(orgId, input.userId, r)) return { error: 'Esta é a única pessoa administradora da organização.' };
    await (await clerkClient()).organizations.updateOrganizationMembership({ organizationId: orgId, userId: input.userId, role: r });
    done();
    return { ok: 'Nível alterado.' };
  } catch (e) { return { error: msg(e, 'Não foi possível mudar o nível.') }; }
}

