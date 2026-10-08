'use server';

import { and, count, eq, isNull, or } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/db';
import { brandSettings, colorPalettes, posts, templates } from '@/db/schema';
import { getCtx, getBrandSettings } from './ctx';
import { DEFAULT_STYLE, GLOBAL_PRESETS } from './themes';
import { EDITORS, type EditorKey } from './editors';

async function need() {
  const c = await getCtx();
  if (!c) throw new Error('Sem marca ativa');
  return c;
}

/** Cria um post já com perfil e estilo padrão da marca. */
export async function createPost(formData: FormData) {
  const c = await need();
  const [tpl] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, String(formData.get('templateId'))), or(isNull(templates.brandId), eq(templates.brandId, c.brandId))));
  if (!tpl) throw new Error('Escolha um template válido');
  const s = await getBrandSettings(c.brandId);
  const style = s?.style ?? DEFAULT_STYLE;
  const [post] = await db
    .insert(posts)
    .values({
      brandId: c.brandId,
      templateId: tpl.id,
      title: String(formData.get('title') || 'Sem título'),
      createdBy: c.userId,
      updatedBy: c.userId,
      data: {
        v: 2,
        slides: null,
        g: {
          name: s?.displayName, handle: s?.handle, topic: s?.topic, year: s?.year,
          avatar: s?.avatarUrl ?? null, font: style.font, width: style.width, theme: style.theme,
        },
      },
    })
    .returning({ id: posts.id });
  redirect(`/admin/posts/${post.id}`);
}

/** Duplica um post da marca ativa (sempre como rascunho). */
export async function duplicatePost(formData: FormData) {
  const c = await need();
  const [src] = await db.select().from(posts).where(and(eq(posts.id, String(formData.get('id'))), eq(posts.brandId, c.brandId)));
  if (!src) throw new Error('Post não encontrado');
  await db.insert(posts).values({
    brandId: c.brandId,
    templateId: src.templateId,
    title: `${src.title} (cópia)`,
    status: 'draft',
    data: structuredClone(src.data),
    createdBy: c.userId,
    updatedBy: c.userId,
  });
  revalidatePath('/admin/posts');
}

export async function deletePost(formData: FormData) {
  const c = await need();
  await db.delete(posts).where(and(eq(posts.id, String(formData.get('id'))), eq(posts.brandId, c.brandId)));
  revalidatePath('/admin/posts');
}

export async function setPostStatus(formData: FormData) {
  const c = await need();
  const status = formData.get('status') === 'published' ? 'published' : 'draft';
  await db.update(posts).set({ status }).where(and(eq(posts.id, String(formData.get('id'))), eq(posts.brandId, c.brandId)));
  revalidatePath('/admin/posts');
}

export async function saveSettings(formData: FormData) {
  const c = await need();
  if (!c.isBrandAdmin) throw new Error('Apenas admins da marca');
  const f = (k: string) => String(formData.get(k) ?? '').trim();
  const choice = f('colors');
  let theme = GLOBAL_PRESETS.find((p) => p.name === choice)?.theme;
  if (choice.startsWith('p:')) {
    const [saved] = await db.select().from(colorPalettes).where(and(eq(colorPalettes.id, choice.slice(2)), eq(colorPalettes.brandId, c.brandId), eq(colorPalettes.editor, 'carrossel')));
    theme = saved?.theme;
  }
  const current = (await getBrandSettings(c.brandId))?.style ?? DEFAULT_STYLE;
  await db
    .update(brandSettings)
    .set({
      displayName: f('displayName'), handle: f('handle'), topic: f('topic'), year: f('year'),
      style: theme ? { ...current, theme } : current,
      updatedAt: new Date(),
    })
    .where(eq(brandSettings.brandId, c.brandId));
  revalidatePath('/admin/configuracoes');
}

/** Cria um formato de post. Só o admin da plataforma (formato global). */
export async function createTemplate(formData: FormData) {
  const c = await need();
  if (!c.isPlatformAdmin) throw new Error('Apenas admin da plataforma');
  const editor = String(formData.get('editor'));
  if (!(editor in EDITORS)) throw new Error('Editor inválido');
  await db.insert(templates).values({
    name: String(formData.get('name')).trim(),
    description: String(formData.get('description') ?? '').trim(),
    editor: editor as EditorKey,
    createdBy: c.userId,
  });
  revalidatePath('/admin/templates');
}

export async function deleteTemplate(formData: FormData) {
  const c = await need();
  const id = String(formData.get('id'));
  const [t] = await db.select().from(templates).where(eq(templates.id, id));
  if (!t) return;
  if (t.brandId === null ? !c.isPlatformAdmin : !(t.brandId === c.brandId && c.isBrandAdmin)) throw new Error('Sem permissão');
  const [{ n }] = await db.select({ n: count() }).from(posts).where(eq(posts.templateId, id));
  if (n > 0) throw new Error(`Este template é usado por ${n} post(s) e não pode ser excluído`);
  await db.delete(templates).where(eq(templates.id, id));
  revalidatePath('/admin/templates');
}

export async function inviteMember(formData: FormData) {
  const { userId, orgId, has } = await auth();
  if (!userId || !orgId || !has({ role: 'org:admin' })) throw new Error('Apenas admins da marca');
  const role = formData.get('role') === 'org:admin' ? 'org:admin' : 'org:member';
  await (await clerkClient()).organizations.createOrganizationInvitation({
    organizationId: orgId,
    emailAddress: String(formData.get('email')).trim(),
    role,
    inviterUserId: userId,
  });
  revalidatePath('/admin/usuarios');
}

export async function removeMember(formData: FormData) {
  const { userId, orgId, has } = await auth();
  if (!userId || !orgId || !has({ role: 'org:admin' })) throw new Error('Apenas admins da marca');
  const target = String(formData.get('userId'));
  if (target === userId) throw new Error('Você não pode remover a si mesmo');
  await (await clerkClient()).organizations.deleteOrganizationMembership({ organizationId: orgId, userId: target });
  revalidatePath('/admin/usuarios');
}

