import { getCtx } from '@/lib/ctx';
import { AiError } from '@/lib/ai/generate';
import { planArticle } from '@/lib/ai/substack';
import { loadBrandProfile } from '@/lib/video-server';
import { readRequest } from '@/lib/substack-server';
import { TOO_MANY, rateLimit } from '@/lib/rate-limit';

export const maxDuration = 120;

/** Esboço do artigo (títulos, subtítulo, abertura e seções) para aprovar antes de escrever. Não grava nada. */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  if (!rateLimit(`ai:${c.userId}`, 100, 10 * 60_000)) return Response.json(TOO_MANY, { status: 429 });
  const r = await readRequest(c.brandId, (await req.json().catch(() => null)) as Record<string, unknown> | null);
  if ('error' in r) return Response.json({ error: r.error }, { status: 400 });
  try {
    const plan = await planArticle({ source: r.source, angle: r.angle, length: r.length, instructions: r.instructions, brand: await loadBrandProfile(c.brandId) });
    return Response.json({ plan: { angle: plan.angle, titles: plan.titles, subtitle: plan.subtitle, hook: plan.hook, sections: plan.sections } });
  } catch (e) {
    return Response.json({ error: e instanceof AiError ? e.message : 'Não foi possível montar o esboço.', retryable: e instanceof AiError && e.retryable }, { status: e instanceof AiError && e.retryable ? 503 : 502 });
  }
}
