import { and, count, eq, gte } from 'drizzle-orm';
import { db } from '@/db';
import { contentIdeas, substackPosts } from '@/db/schema';
import { loadIdeaPersonas } from '@/lib/idea-server';
import { ideaBlockFor } from '@/lib/ai/carousel';
import type { ArticleSource } from '@/lib/ai/substack';
import { ARTICLE_LENGTHS, MAX_SOURCE_CHARS, isArticleAngle, type ArticleAngleId } from '@/lib/substack';

export const SUBSTACK_DAILY_LIMIT = Number(process.env.AI_SUBSTACK_DAILY_LIMIT) || 30;
export const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
export const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

export async function articlesToday(brandId: string): Promise<number> {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [{ n }] = await db.select({ n: count() }).from(substackPosts).where(and(eq(substackPosts.brandId, brandId), gte(substackPosts.createdAt, start)));
  return n;
}

export type CleanReq = { source: ArticleSource; ideaId: string | null; angle: ArticleAngleId; length: string; instructions: string };

/** Valida o corpo da requisição e monta a fonte: ideia (estruturada, com a persona), tema livre ou material colado. */
export async function readRequest(brandId: string, b: Record<string, unknown> | null): Promise<CleanReq | { error: string }> {
  const kind = b?.kind;
  let source: ArticleSource | null = null, ideaId: string | null = null;
  if (kind === 'idea') {
    if (!isUuid(b?.ideaId)) return { error: 'Escolha uma ideia de conteúdo.' };
    const [row] = await db.select().from(contentIdeas).where(and(eq(contentIdeas.id, b.ideaId), eq(contentIdeas.brandId, brandId)));
    if (!row) return { error: 'Ideia não encontrada.' };
    const persons = await loadIdeaPersonas(brandId, row);
    ideaId = row.id;
    source = { label: 'IDEIA DE CONTEÚDO (a base do artigo: transforme esta história em um texto de newsletter, não repita os campos como lista)', text: ideaBlockFor(row, persons, row.personaName, row.territory) };
  } else if (kind === 'tema') {
    const t = str(b?.text, 1500);
    if (t.length < 8) return { error: 'Conte o tema do artigo em uma ou duas frases.' };
    source = { label: 'TEMA DO ARTIGO', text: t };
  } else if (kind === 'material') {
    const t = str(b?.text, MAX_SOURCE_CHARS);
    if (t.length < 80) return { error: 'Cole um material com um pouco mais de texto (anotações, transcrição, artigo).' };
    source = { label: 'MATERIAL-FONTE (use somente fatos daqui; reescreva com a voz da marca, sem copiar trechos)', text: t };
  }
  if (!source) return { error: 'Escolha de onde o artigo vai partir.' };
  return {
    source, ideaId, angle: isArticleAngle(b?.angle) ? b.angle : 'auto',
    length: ARTICLE_LENGTHS.some((l) => l.id === b?.length) ? String(b?.length) : 'medio', instructions: str(b?.instructions, 1200),
  };
}
