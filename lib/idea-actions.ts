'use server';

import { and, count, eq, gte, isNull, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { contentIdeas, generationBatches, generationItems, personas, templates } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { pathOf, PUBLICO_ID } from '@/lib/territory';
import { ensureLink, loadTerritoryNodes } from '@/lib/territory-server';
import { IDEA_INSTRUCTIONS, personaIdsOf, type Idea, type IdeaFields, type IdeaInput, type IdeaStatus } from '@/lib/idea';
import { MAX_SLIDES } from '@/lib/ai/constants';
import { ideaBlockFor } from '@/lib/ai/carousel';
import { isCarouselAngle } from '@/lib/ai/carousel-rules';
import { supportsAi } from '@/lib/ai/generate';
import { imageEnabled } from '@/lib/ai/image';
import { kickBatch } from '@/lib/ai/worker';
import { loadIdeaPersonas, loadPersonas } from '@/lib/idea-server';

async function ctx() {
  const c = await getCtx();
  if (!c) throw new Error('Não autorizado');
  return c;
}
const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const done = () => revalidatePath('/admin/ideias');
const STATUSES = ['idea', 'approved', 'used'];

/** Valida as personas/território do usuário (qualquer combinação) e devolve os nomes (guardados como texto na ideia). Duas ou mais personas = público amplo. */
async function resolve(brandId: string, i: { personaId: string | null; personaIds?: string[]; territoryId: string | null; territory: string }) {
  const wanted = (i.personaIds?.length ? i.personaIds : i.personaId ? [i.personaId] : []).filter((x) => x && x !== PUBLICO_ID);
  const found = await loadPersonas(brandId, wanted);
  if (found.length < new Set(wanted).size) return { error: 'Persona não encontrada.' as const };
  const personaIds = found.map((p) => p.id);
  const personaId = personaIds[0] ?? null;
  const personaName = found.length ? found.map((p) => p.name).join(', ') : 'Público geral';
  let territoryId: string | null = null, territory = str(i.territory, 200);
  if (i.territoryId) {
    const all = await loadTerritoryNodes(brandId);
    const me = all.find((n) => n.id === i.territoryId);
    if (!me) return { error: 'Território não encontrado.' as const };
    territoryId = me.id; territory = pathOf(all, me.id).join(' › ');
    // a dupla persona × território passou a existir: garante a ligação (aparece na matriz do mapa)
    if (personaIds.length) { for (const pid of personaIds) await ensureLink(brandId, all, me.id, pid); revalidatePath('/admin/territorios'); }
  }
  return { personaId, personaIds, personaName, territoryId, territory };
}
const fields = (i: IdeaFields) => ({ pain: str(i.pain, 400), impact: str(i.impact, 400), cause: str(i.cause, 400), guide: str(i.guide, 600), args: str(i.args, 700), gain: str(i.gain, 400), desire: str(i.desire, 400), cta: str(i.cta, 300) });

const toIdea = (r: typeof contentIdeas.$inferSelect): Idea => ({
  id: r.id, personaId: r.personaId, personaIds: personaIdsOf(r), personaName: r.personaName, territoryId: r.territoryId, territory: r.territory,
  pain: r.pain, impact: r.impact, cause: r.cause, guide: r.guide, args: r.args, gain: r.gain, desire: r.desire, cta: r.cta, status: r.status as IdeaStatus, source: r.source, createdAt: r.createdAt.toISOString(),
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
export async function addSuggestedIdeas(who: string | string[] | null, territoryId: string | null, items: IdeaFields[]): Promise<{ added?: number; error?: string }> {
  const c = await ctx();
  const personaIds = Array.isArray(who) ? who : who ? [who] : [];
  const r = await resolve(c.brandId, { personaId: personaIds[0] ?? null, personaIds, territoryId, territory: '' });
  if ('error' in r) return { error: r.error };
  const rows = items.map((x) => ({ brandId: c.brandId, ...r, ...fields(x), source: 'ai', createdBy: c.userId })).filter((x) => x.pain);
  if (!rows.length) return { error: 'Nenhuma ideia para adicionar.' };
  await db.insert(contentIdeas).values(rows.slice(0, 20));
  done();
  return { added: rows.length };
}

export type CarouselPlanInput = { angle?: string; promise?: string; slides: { role: string; message: string }[] };

/**
 * Transforma uma ideia em post (carrossel, Tweet Card ou Capa de Notícia): cria um lote de 1 item com a ideia ESTRUTURADA (cada campo no seu lugar),
 * o ângulo narrativo e, se o usuário aprovou, o roteiro dos slides. Marca a ideia como "usada" e abre o acompanhamento.
 */
export async function createPostFromIdea(ideaId: string, templateId: string, opts: { slides?: number; angle?: string; plan?: CarouselPlanInput | null; extra?: string; withImages?: boolean } = {}): Promise<{ error?: string }> {
  const c = await ctx();
  const [row] = await db.select().from(contentIdeas).where(and(eq(contentIdeas.id, ideaId), eq(contentIdeas.brandId, c.brandId)));
  if (!row) return { error: 'Ideia não encontrada.' };
  if (!process.env.ANTHROPIC_API_KEY) return { error: 'A chave da IA ainda não foi configurada no servidor (ANTHROPIC_API_KEY).' };
  const withImages = !!opts.withImages;
  if (withImages && !imageEnabled()) return { error: 'A geração de imagens ainda não foi configurada no servidor (GEMINI_API_KEY).' };
  const [tpl] = await db.select().from(templates).where(and(eq(templates.id, templateId), or(isNull(templates.brandId), eq(templates.brandId, c.brandId))));
  if (!tpl || !supportsAi(tpl.editor)) return { error: 'Escolha um formato que suporte geração com IA.' };

  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const [{ n: today }] = await db.select({ n: count() }).from(generationItems).where(and(eq(generationItems.brandId, c.brandId), gte(generationItems.createdAt, startOfDay)));
  const limit = Number(process.env.AI_DAILY_LIMIT) || 100;
  if (today + 1 > limit) return { error: `Limite diário da marca: ${limit} posts (já foram ${today} hoje).` };

  const persons = await loadIdeaPersonas(c.brandId, row);
  // o roteiro aprovado manda no número de slides; sem ele, o usuário escolhe ou a IA decide (0)
  const plan = opts.plan && Array.isArray(opts.plan.slides)
    ? { angle: str(opts.plan.angle, 30), promise: str(opts.plan.promise, 240), slides: opts.plan.slides.map((x) => ({ role: str(x.role, 40), message: str(x.message, 220) })).filter((x) => x.message).slice(0, 10) }
    : null;
  const okPlan = plan && plan.slides.length >= 3 ? plan : null;
  const slidesTarget = okPlan ? okPlan.slides.length : opts.slides && opts.slides > 0 ? Math.min(MAX_SLIDES, Math.max(3, Math.round(opts.slides))) : 0;
  const angle = isCarouselAngle(opts.angle) && opts.angle !== 'auto' ? opts.angle : (okPlan?.angle && isCarouselAngle(okPlan.angle) ? okPlan.angle : '');
  // o carrossel já traz as regras de craft e o mapa ideia → slides; os demais formatos usam as orientações gerais da ideia
  const instructions = [tpl.editor === 'carrossel' ? '' : IDEA_INSTRUCTIONS, str(opts.extra, 1200)].filter(Boolean).join('\n').slice(0, 2000);

  const [batch] = await db.insert(generationBatches).values({
    brandId: c.brandId, templateId: tpl.id, mode: 'ideia', slidesTarget, angle, ideaId, plan: okPlan, withImages, instructions, createdBy: c.userId,
  }).returning({ id: generationBatches.id });
  await db.insert(generationItems).values({ batchId: batch.id, brandId: c.brandId, brief: ideaBlockFor(row, persons, row.personaName, row.territory) });
  await db.update(contentIdeas).set({ status: 'used', updatedAt: new Date() }).where(and(eq(contentIdeas.id, ideaId), eq(contentIdeas.brandId, c.brandId)));
  kickBatch(batch.id);
  done(); revalidatePath('/admin/gerar');
  redirect(`/admin/gerar/${batch.id}`);
}
