'use server';

import { and, count, eq, gte, isNull, or } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/db';
import { brandSettings, colorPalettes, generationBatches, generationItems, posts, templates } from '@/db/schema';
import { getCtx, getBrandSettings, ensureBrand } from './ctx';
import { DEFAULT_STYLE, GLOBAL_PRESETS } from './themes';
import { EDITORS, type EditorKey } from './editors';
import { applyBrandIdentity, initialPostData } from './posts';
import { supportsAi } from './ai/generate';
import { imageEnabled } from './ai/image';
import { MAX_ITEMS_PER_BATCH, MAX_SLIDES, collectBriefs } from './ai/constants';
import { kickBatch } from './ai/worker';
import { importPostImagesFor } from './assets';

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
  const [post] = await db
    .insert(posts)
    .values({
      brandId: c.brandId,
      templateId: tpl.id,
      title: String(formData.get('title') || 'Sem título'),
      createdBy: c.userId,
      updatedBy: c.userId,
      data: initialPostData(s),
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

/** Renomeia um post (usado na lista de posts). */
export async function renamePost(formData: FormData) {
  const c = await need();
  const title = String(formData.get('title') ?? '').trim().slice(0, 120);
  if (!title) return;
  await db.update(posts).set({ title, updatedBy: c.userId, updatedAt: new Date() }).where(and(eq(posts.id, String(formData.get('id'))), eq(posts.brandId, c.brandId)));
  revalidatePath('/admin/posts');
}

/**
 * Migra um post para outra marca (tenant). Só o super-admin da plataforma.
 * O post volta para rascunho; opcionalmente assume a identidade da marca de destino.
 */
export async function migratePost(formData: FormData) {
  const c = await need();
  if (!c.isPlatformAdmin) throw new Error('Apenas o admin da plataforma pode migrar posts entre marcas');

  const id = String(formData.get('id'));
  const destOrgId = String(formData.get('destOrgId') ?? '');
  const applyIdentity = formData.get('applyIdentity') === 'on';
  if (!destOrgId) throw new Error('Escolha a marca de destino');

  const [src] = await db
    .select({ post: posts, editor: templates.editor, tplBrand: templates.brandId })
    .from(posts)
    .leftJoin(templates, eq(templates.id, posts.templateId))
    .where(and(eq(posts.id, id), eq(posts.brandId, c.brandId)));
  if (!src) throw new Error('Post não encontrado');

  const org = await (await clerkClient()).organizations.getOrganization({ organizationId: destOrgId }).catch(() => null);
  if (!org) throw new Error('Marca de destino não encontrada');
  const dest = await ensureBrand(org.id, org.name);
  if (dest.id === c.brandId) throw new Error('O post já está nessa marca');
  if (src.tplBrand && src.tplBrand !== dest.id) throw new Error('O formato deste post é exclusivo da marca de origem');

  const data = applyIdentity ? applyBrandIdentity(src.post.data, src.editor, await getBrandSettings(dest.id)) : src.post.data;

  await db.update(posts).set({ brandId: dest.id, data, status: 'draft', updatedBy: c.userId, updatedAt: new Date() }).where(eq(posts.id, id));
  // lotes de IA da marca de origem deixam de apontar para este post
  await db.update(generationItems).set({ postId: null }).where(eq(generationItems.postId, id));
  revalidatePath('/admin/posts');
  redirect(`/admin/posts?moved=${encodeURIComponent(org.name)}`);
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
      displayName: f('displayName'),
      instagram: f('instagram'), tiktok: f('tiktok'), x: f('x'),
      handle: f('instagram') || f('tiktok') || f('x'), // @ principal (compatibilidade)
      topic: f('topic'), year: f('year'),
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



/* ================= geração com IA ================= */

const MAX_BRIEF_CHARS = 6000;
const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT) || 100;

export type BatchState = { error?: string } | null;

/** Cria um lote de geração e começa a processar em segundo plano. */
export async function createBatch(_prev: BatchState, formData: FormData): Promise<BatchState> {
  const c = await need();
  const mode = formData.get('mode') === 'roteiro' ? 'roteiro' : 'tema';
  const briefs = collectBriefs(mode, formData);
  const slidesTarget = Math.min(MAX_SLIDES, Math.max(3, Number(formData.get('slides')) || 7));

  if (!process.env.ANTHROPIC_API_KEY) return { error: 'A chave da IA ainda não foi configurada no servidor (ANTHROPIC_API_KEY).' };
  const withImages = formData.get('withImages') === 'on';
  if (withImages && !imageEnabled()) return { error: 'A geração de imagens ainda não foi configurada no servidor (GEMINI_API_KEY).' };
  if (!briefs.length) return { error: mode === 'roteiro' ? 'Cole pelo menos um roteiro.' : 'Escreva pelo menos um tema (um por linha).' };
  if (briefs.length > MAX_ITEMS_PER_BATCH) return { error: `Máximo de ${MAX_ITEMS_PER_BATCH} posts por lote (você enviou ${briefs.length}).` };
  if (briefs.some((b) => b.length > MAX_BRIEF_CHARS)) return { error: `Cada item pode ter até ${MAX_BRIEF_CHARS} caracteres.` };

  const [tpl] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, String(formData.get('templateId'))), or(isNull(templates.brandId), eq(templates.brandId, c.brandId))));
  if (!tpl || !supportsAi(tpl.editor)) return { error: 'Escolha um formato que suporte geração com IA.' };

  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const [{ n: today }] = await db.select({ n: count() }).from(generationItems).where(and(eq(generationItems.brandId, c.brandId), gte(generationItems.createdAt, startOfDay)));
  if (today + briefs.length > DAILY_LIMIT) return { error: `Limite diário da marca: ${DAILY_LIMIT} posts (já foram ${today} hoje).` };

  const [batch] = await db
    .insert(generationBatches)
    .values({
      brandId: c.brandId, templateId: tpl.id, mode, slidesTarget, withImages, createdBy: c.userId,
      facts: String(formData.get('facts') ?? '').trim().slice(0, 8000),
      instructions: String(formData.get('instructions') ?? '').trim().slice(0, 2000),
    })
    .returning({ id: generationBatches.id });
  await db.insert(generationItems).values(briefs.map((brief) => ({ batchId: batch.id, brandId: c.brandId, brief })));

  kickBatch(batch.id);
  redirect(`/admin/gerar/${batch.id}`);
}

async function ownBatchItems(batchId: string, brandId: string) {
  const [b] = await db.select({ id: generationBatches.id }).from(generationBatches).where(and(eq(generationBatches.id, batchId), eq(generationBatches.brandId, brandId)));
  return !!b;
}

/** Gera de novo um item (cria um novo post; o anterior continua em Posts). */
export async function regenerateItem(formData: FormData) {
  const c = await need();
  const id = String(formData.get('id'));
  const [it] = await db.select().from(generationItems).where(and(eq(generationItems.id, id), eq(generationItems.brandId, c.brandId)));
  if (!it) return;
  await db.update(generationItems).set({ status: 'queued', postId: null, error: null, notes: null, attempts: 0, updatedAt: new Date() }).where(eq(generationItems.id, id));
  kickBatch(it.batchId);
  revalidatePath(`/admin/gerar/${it.batchId}`);
}

/** Recoloca na fila todos os itens com erro do lote. */
export async function retryFailed(formData: FormData) {
  const c = await need();
  const batchId = String(formData.get('batchId'));
  if (!(await ownBatchItems(batchId, c.brandId))) return;
  await db.update(generationItems).set({ status: 'queued', error: null, attempts: 0, updatedAt: new Date() })
    .where(and(eq(generationItems.batchId, batchId), eq(generationItems.status, 'error')));
  kickBatch(batchId);
  revalidatePath(`/admin/gerar/${batchId}`);
}

/** Remove o lote do histórico (os posts gerados continuam em Posts). */
export async function deleteBatch(formData: FormData) {
  const c = await need();
  await db.delete(generationBatches).where(and(eq(generationBatches.id, String(formData.get('id'))), eq(generationBatches.brandId, c.brandId)));
  revalidatePath('/admin/gerar');
  redirect('/admin/gerar');
}

/** Identidade da marca usada pela IA (só admins). */
export async function saveAiProfile(formData: FormData) {
  const c = await need();
  if (!c.isBrandAdmin) throw new Error('Apenas admins da marca');
  const f = (k: string, max: number) => String(formData.get(k) ?? '').trim().slice(0, max);
  await db.update(brandSettings).set({
    aiNiche: f('aiNiche', 500), aiAudience: f('aiAudience', 500), aiVoice: f('aiVoice', 800),
    aiRules: f('aiRules', 1500), aiCta: f('aiCta', 300), aiExamples: f('aiExamples', 4000), aiImageStyle: f('aiImageStyle', 400), updatedAt: new Date(),
  }).where(eq(brandSettings.brandId, c.brandId));
  revalidatePath('/admin/configuracoes');
}


/**
 * Importa para a galeria as imagens embutidas nos posts da marca (deixa os posts mais leves).
 */
export async function importPostImages() {
  const c = await need();
  if (!c.isBrandAdmin) throw new Error('Apenas admins da marca');
  const r = await importPostImagesFor(c.brandId, c.userId);
  revalidatePath('/admin/galeria');
  redirect(`/admin/galeria?imported=${r.images}&posts=${r.posts}`);
}
