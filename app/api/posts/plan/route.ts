import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { contentIdeas } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { AiError } from '@/lib/ai/generate';
import { loadIdeaPersonas } from '@/lib/idea-server';
import { ideaBlockFor, planCarousel } from '@/lib/ai/carousel';
import { isCarouselAngle } from '@/lib/ai/carousel-rules';
import { loadBrandProfile } from '@/lib/video-server';
import { TOO_MANY, rateLimit } from '@/lib/rate-limit';

export const maxDuration = 90;

/** Planeja o roteiro dos slides de um carrossel a partir de uma ideia, para o usuário aprovar antes da escrita. Não grava nada. */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  if (!rateLimit(`ai:${c.userId}`, 100, 10 * 60_000)) return Response.json(TOO_MANY, { status: 429 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const ideaId = String(b?.ideaId ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(ideaId)) return Response.json({ error: 'Ideia inválida.' }, { status: 400 });
  const [row] = await db.select().from(contentIdeas).where(and(eq(contentIdeas.id, ideaId), eq(contentIdeas.brandId, c.brandId)));
  if (!row) return Response.json({ error: 'Ideia não encontrada.' }, { status: 404 });
  const persons = await loadIdeaPersonas(c.brandId, row);
  const slides = Math.round(Number(b?.slides));
  try {
    const r = await planCarousel({
      idea: ideaBlockFor(row, persons, row.personaName, row.territory),
      angle: isCarouselAngle(b?.angle) ? b.angle : 'auto',
      slides: Number.isFinite(slides) && slides > 0 ? Math.min(10, Math.max(3, slides)) : 0,
      instructions: String(b?.instructions ?? '').slice(0, 1200),
      brand: persons.length ? { ...(await loadBrandProfile(c.brandId)), audience: '' } : await loadBrandProfile(c.brandId),
    });
    return Response.json({ plan: { angle: r.angle, promise: r.promise, slides: r.slides, covers: r.covers } });
  } catch (e) {
    return Response.json({ error: e instanceof AiError ? e.message : 'Não foi possível planejar o carrossel.' }, { status: e instanceof AiError && e.retryable ? 503 : 502 });
  }
}
