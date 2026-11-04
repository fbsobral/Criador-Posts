'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { substackPosts } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { ARTICLE_STATUS, MAX_BODY_CHARS, type ArticleMeta, type ArticleStatus } from '@/lib/substack';
import { str } from '@/lib/substack-server';

async function ctx() {
  const c = await getCtx();
  if (!c) throw new Error('Não autorizado');
  return c;
}
const list = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);

/** Salva o artigo (texto, dados de publicação e etapa). */
export async function saveArticle(input: { id: string; title: string; subtitle: string; body: string; meta: ArticleMeta; status?: ArticleStatus }): Promise<{ error?: string }> {
  const c = await ctx();
  const m = input.meta ?? ({} as ArticleMeta);
  const meta: ArticleMeta = {
    emailSubject: str(m.emailSubject, 100), previewText: str(m.previewText, 160), seoDescription: str(m.seoDescription, 200),
    tags: list(m.tags, 8, 40).map((t) => t.replace(/^#/, '')), notes: list(m.notes, 6, 300), toVerify: list(m.toVerify, 10, 300),
  };
  const set: Partial<typeof substackPosts.$inferInsert> = { title: str(input.title, 160) || 'Sem título', subtitle: str(input.subtitle, 240), body: String(input.body ?? '').slice(0, MAX_BODY_CHARS), meta, updatedAt: new Date() };
  if (ARTICLE_STATUS.some((x) => x.id === input.status)) set.status = input.status;
  await db.update(substackPosts).set(set).where(and(eq(substackPosts.id, input.id), eq(substackPosts.brandId, c.brandId)));
  return {};
}

export async function setArticleStatus(id: string, status: ArticleStatus): Promise<{ error?: string }> {
  const c = await ctx();
  if (!ARTICLE_STATUS.some((x) => x.id === status)) return { error: 'Etapa inválida.' };
  await db.update(substackPosts).set({ status, updatedAt: new Date() }).where(and(eq(substackPosts.id, id), eq(substackPosts.brandId, c.brandId)));
  revalidatePath('/admin/substack');
  return {};
}

export async function duplicateArticle(id: string): Promise<{ id?: string; error?: string }> {
  const c = await ctx();
  const [a] = await db.select().from(substackPosts).where(and(eq(substackPosts.id, id), eq(substackPosts.brandId, c.brandId)));
  if (!a) return { error: 'Artigo não encontrado.' };
  const [r] = await db.insert(substackPosts).values({ brandId: c.brandId, ideaId: a.ideaId, title: `${a.title} (cópia)`.slice(0, 160), subtitle: a.subtitle, body: a.body, angle: a.angle, meta: a.meta, createdBy: c.userId }).returning({ id: substackPosts.id });
  revalidatePath('/admin/substack');
  return { id: r.id };
}

export async function deleteArticle(id: string): Promise<{ error?: string }> {
  const c = await ctx();
  await db.delete(substackPosts).where(and(eq(substackPosts.id, id), eq(substackPosts.brandId, c.brandId)));
  revalidatePath('/admin/substack');
  return {};
}
