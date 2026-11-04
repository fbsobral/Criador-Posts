import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { contentIdeas, substackPosts } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { AiError } from '@/lib/ai/generate';
import { writeArticle } from '@/lib/ai/substack';
import { loadBrandProfile } from '@/lib/video-server';
import { SUBSTACK_DAILY_LIMIT, articlesToday, readRequest, str } from '@/lib/substack-server';
import { TOO_MANY, rateLimit } from '@/lib/rate-limit';

export const maxDuration = 300;

/** Escreve o artigo (com o esboço aprovado, se houver), grava e devolve o id. A ideia de origem passa a "usada". */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  if (!rateLimit(`ai:${c.userId}`, 100, 10 * 60_000)) return Response.json(TOO_MANY, { status: 429 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const r = await readRequest(c.brandId, body);
  if ('error' in r) return Response.json({ error: r.error }, { status: 400 });
  if ((await articlesToday(c.brandId)) + 1 > SUBSTACK_DAILY_LIMIT) return Response.json({ error: `Limite diário da marca: ${SUBSTACK_DAILY_LIMIT} artigos.` }, { status: 429 });
  const p = body?.plan as { title?: unknown; subtitle?: unknown; hook?: unknown; sections?: { heading?: unknown; point?: unknown }[] } | undefined;
  const sections = Array.isArray(p?.sections) ? p.sections.map((s) => ({ heading: str(s.heading, 120), point: str(s.point, 240) })).filter((s) => s.heading).slice(0, 8) : [];
  const plan = p && sections.length >= 2 ? { title: str(p.title, 120), subtitle: str(p.subtitle, 200), hook: str(p.hook, 300), sections } : null;
  try {
    const a = await writeArticle({ source: r.source, angle: r.angle, length: r.length, instructions: r.instructions, brand: await loadBrandProfile(c.brandId), plan });
    const [row] = await db.insert(substackPosts).values({
      brandId: c.brandId, ideaId: r.ideaId, title: a.title, subtitle: a.subtitle, body: a.body, angle: a.angle, meta: a.meta,
      inputTokens: a.inputTokens, outputTokens: a.outputTokens, createdBy: c.userId,
    }).returning({ id: substackPosts.id });
    if (r.ideaId) await db.update(contentIdeas).set({ status: 'used', updatedAt: new Date() }).where(and(eq(contentIdeas.id, r.ideaId), eq(contentIdeas.brandId, c.brandId)));
    return Response.json({ id: row.id, title: a.title });
  } catch (e) {
    return Response.json({ error: e instanceof AiError ? e.message : 'Não foi possível escrever o artigo.', retryable: e instanceof AiError && e.retryable }, { status: e instanceof AiError && e.retryable ? 503 : 502 });
  }
}
