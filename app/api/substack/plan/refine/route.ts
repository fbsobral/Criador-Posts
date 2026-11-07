import { getCtx } from '@/lib/ctx';
import { AiError } from '@/lib/ai/generate';
import { refineOutline, type OutlineScope } from '@/lib/ai/substack';
import { loadBrandProfile } from '@/lib/video-server';
import { readRequest, str } from '@/lib/substack-server';
import { TOO_MANY, rateLimit } from '@/lib/rate-limit';

export const maxDuration = 90;

/** Melhora o esboço que está na tela: inteiro, só o bloco de cima (título, subtítulo e abertura) ou uma seção. Não grava nada. */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  if (!rateLimit(`ai:${c.userId}`, 100, 10 * 60_000)) return Response.json(TOO_MANY, { status: 429 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const r = await readRequest(c.brandId, b);
  if ('error' in r) return Response.json({ error: r.error }, { status: 400 });
  const o = (b?.outline ?? {}) as Record<string, unknown>;
  const sections = (Array.isArray(o.sections) ? o.sections : []).slice(0, 8).map((x) => ({ heading: str((x as Record<string, unknown>)?.heading, 120), point: str((x as Record<string, unknown>)?.point, 240) }));
  if (sections.length < 1) return Response.json({ error: 'O esboço está vazio.' }, { status: 400 });
  const current = { title: str(o.title, 120), titles: (Array.isArray(o.titles) ? o.titles : []).map((t) => str(t, 120)).filter(Boolean).slice(0, 3), subtitle: str(o.subtitle, 200), hook: str(o.hook, 300), sections };
  const sc = b?.scope;
  const scope: OutlineScope = sc === 'top' ? 'top' : typeof sc === 'number' && Number.isInteger(sc) && sc >= 0 && sc < sections.length ? sc : 'all';
  try {
    const out = await refineOutline({ source: r.source, angle: r.angle, length: r.length, instructions: r.instructions, brand: await loadBrandProfile(c.brandId), current, feedback: str(b?.feedback, 600), scope });
    return Response.json({ outline: { title: out.title, titles: out.titles, subtitle: out.subtitle, hook: out.hook, sections: out.sections }, note: out.note });
  } catch (e) {
    return Response.json({ error: e instanceof AiError ? e.message : 'Não foi possível melhorar o esboço.', retryable: e instanceof AiError && e.retryable }, { status: e instanceof AiError && e.retryable ? 503 : 502 });
  }
}
