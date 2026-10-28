'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { contentIdeas, personas, territories } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { pathOf, PUBLICO_ID, type TNode } from '@/lib/territory';
import { IDEA_INSTRUCTIONS, ideaBrief, type Idea, type IdeaFields, type IdeaInput, type IdeaStatus } from '@/lib/idea';
import { createBatch } from '@/lib/actions';
import { personaBlock } from '@/lib/ai/idea';

async function ctx() {
  const c = await getCtx();
  if (!c) throw new Error('Não autorizado');
  return c;
}
const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const done = () => revalidatePath('/admin/ideias');
const STATUSES = ['idea', 'approved', 'used'];

/** Valida a persona/território do usuário e devolve os nomes (guardados como texto na ideia). */
async function resolve(brandId: string, i: { personaId: string | null; territoryId: string | null; territory: string }) {
  let personaId: string | null = null, personaName = '';
  if (i.personaId && i.personaId !== PUBLICO_ID) {
    const [p] = await db.select({ id: personas.id, name: personas.name }).from(personas).where(and(eq(personas.id, i.personaId), eq(personas.brandId, brandId)));
    if (!p) return { error: 'Persona não encontrada.' as const };
    personaId = p.id; personaName = p.name;
  } else personaName = 'Público geral';
  let territoryId: string | null = null, territory = str(i.territory, 200);
  if (i.territoryId) {
    const all = await db.select({ id: territories.id, personaId: territories.personaId, parentId: territories.parentId, name: territories.name, description: territories.description, position: territories.position, source: territories.source })
      .from(territories).where(eq(territories.brandId, brandId));
    const me = all.find((n) => n.id === i.territoryId);
    if (!me) return { error: 'Território não encontrado.' as const };
    const mine = all.filter((n) => n.personaId === me.personaId).map((n) => ({ ...n, personaId: n.personaId ?? PUBLICO_ID })) as TNode[];
    territoryId = me.id; territory = pathOf(mine, me.id).join(' › ');
  }
  return { personaId, personaName, territoryId, territory };
}
const fields = (i: IdeaFields) => ({ pain: str(i.pain, 400), impact: str(i.impact, 400), cause: str(i.cause, 400), guide: str(i.guide, 600), plan: str(i.plan, 700), gain: str(i.gain, 400), desire: str(i.desire, 400), cta: str(i.cta, 300) });

const toIdea = (r: typeof contentIdeas.$inferSelect): Idea => ({
  id: r.id, personaId: r.personaId, personaName: r.personaName, territoryId: r.territoryId, territory: r.territory,
  pain: r.pain, impact: r.impact, cause: r.cause, guide: r.guide, plan: r.plan, gain: r.gain, desire: r.desire, cta: r.cta, status: r.status as IdeaStatus, source: r.source, createdAt: r.createdAt.toISOString(),
});

export async function createIdea(input: IdeaInput): Promise<{ idea?: Idea; error?: string }> {
  const c = await ctx();
  const f = fields(input);
  if (!f.pain) return { error: 'Escreva a dor.' };
  const r = await resolve(c.brandId, input);
  if ('error' in r) return { error: r.error };
  const [row] = await db.insert(contentIdeas).values({ brandId: c.brandId, ...r, ...f, source: 'manual', createdBy: c.userId }).returning();
  done();
  return { idea: toIdea(row) };
}

export async function updateIdea(id: string, input: IdeaInput): Promise<{ idea?: Idea; error?: string }> {
  const c = await ctx();
  const f = fields(input);
  if (!f.pain) return { error: 'Escreva a dor.' };
  const r = await resolve(c.brandId, input);
  if ('error' in r) return { error: r.error };
  const [row] = await db.update(contentIdeas).set({ ...r, ...f, updatedAt: new Date() }).where(and(eq(contentIdeas.id, id), eq(contentIdeas.brandId, c.brandId))).returning();
  if (!row) return { error: 'Ideia não encontrada.' };
  done();
  return { idea: toIdea(row) };
}

export async function setIdeaStatus(id: string, status: IdeaStatus): Promise<{ error?: string }> {
  const c = await ctx();
  if (!STATUSES.includes(status)) return { error: 'Status inválido.' };
  await db.update(contentIdeas).set({ status, updatedAt: new Date() }).where(and(eq(contentIdeas.id, id), eq(contentIdeas.brandId, c.brandId)));
  done();
  return {};
}

export async function deleteIdea(id: string): Promise<{ error?: string }> {
  const c = await ctx();
  const gone = await db.delete(contentIdeas).where(and(eq(contentIdeas.id, id), eq(contentIdeas.brandId, c.brandId))).returning({ id: contentIdeas.id });
  done();
  return gone.length ? {} : { error: 'Ideia não encontrada (talvez já tenha sido excluída).' };
}

/** Grava as ideias que o usuário aprovou na revisão da IA. */
export async function addSuggestedIdeas(personaId: string | null, territoryId: string | null, items: IdeaFields[]): Promise<{ added?: number; error?: string }> {
  const c = await ctx();
  const r = await resolve(c.brandId, { personaId, territoryId, territory: '' });
  if ('error' in r) return { error: r.error };
  const rows = items.map((x) => ({ brandId: c.brandId, ...r, ...fields(x), source: 'ai', createdBy: c.userId })).filter((x) => x.pain);
  if (!rows.length) return { error: 'Nenhuma ideia para adicionar.' };
  await db.insert(contentIdeas).values(rows.slice(0, 20));
  done();
  return { added: rows.length };
}

/** Transforma uma ideia em post: cria um lote de 1 item com a história da ideia e abre o acompanhamento. Marca a ideia como "usada". */
export async function createPostFromIdea(ideaId: string, templateId: string, slides: number, withImages: boolean): Promise<{ error?: string }> {
  const c = await ctx();
  const [row] = await db.select().from(contentIdeas).where(and(eq(contentIdeas.id, ideaId), eq(contentIdeas.brandId, c.brandId)));
  if (!row) return { error: 'Ideia não encontrada.' };
  let perfil = '';
  if (row.personaId) {
    const [p] = await db.select().from(personas).where(and(eq(personas.id, row.personaId), eq(personas.brandId, c.brandId)));
    if (p) perfil = ` | PERFIL DA PERSONA: ${personaBlock({ name: p.name, tagline: p.tagline, role: p.data.role, data: p.data }).replace(/\s*\n\s*/g, ' | ')}${p.data.quote ? ` | Frase típica: ${p.data.quote}` : ''}`;
  }
  const fd = new FormData();
  fd.set('mode', 'tema'); // a IA escreve o post; o texto vai numa linha só (no modo tema cada linha seria um post)
  fd.set('briefs', `${ideaBrief(row, row.personaName, row.territory).replace(/\s*\n\s*/g, ' | ')}${perfil}`.slice(0, 5800));
  fd.set('templateId', templateId); fd.set('slides', String(slides)); fd.set('instructions', IDEA_INSTRUCTIONS);
  if (withImages) fd.set('withImages', 'on');
  const prev = row.status;
  await db.update(contentIdeas).set({ status: 'used', updatedAt: new Date() }).where(and(eq(contentIdeas.id, ideaId), eq(contentIdeas.brandId, c.brandId)));
  try {
    const r = await createBatch(null, fd); // em caso de sucesso redireciona (lança NEXT_REDIRECT)
    if (r?.error) { await db.update(contentIdeas).set({ status: prev }).where(and(eq(contentIdeas.id, ideaId), eq(contentIdeas.brandId, c.brandId))); return { error: r.error }; }
    return {};
  } catch (e) {
    if (e instanceof Error && 'digest' in e && String((e as { digest?: string }).digest).startsWith('NEXT_REDIRECT')) { done(); throw e; }
    await db.update(contentIdeas).set({ status: prev }).where(and(eq(contentIdeas.id, ideaId), eq(contentIdeas.brandId, c.brandId)));
    return { error: 'Não foi possível criar o post.' };
  }
}
