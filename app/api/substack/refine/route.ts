import { getCtx } from '@/lib/ctx';
import { AiError } from '@/lib/ai/generate';
import { refineArticle } from '@/lib/ai/substack';
import { loadBrandProfile } from '@/lib/video-server';
import { str } from '@/lib/substack-server';
import { MAX_BODY_CHARS } from '@/lib/substack';
import { TOO_MANY, rateLimit } from '@/lib/rate-limit';

export const maxDuration = 300;

/** Ajusta o artigo inteiro ou um trecho selecionado (a versão que está na tela). Não grava: o usuário aprova antes. */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  if (!rateLimit(`ai:${c.userId}`, 100, 10 * 60_000)) return Response.json(TOO_MANY, { status: 429 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const feedback = str(b?.feedback, 800);
  const body = str(b?.body, MAX_BODY_CHARS);
  if (feedback.length < 3) return Response.json({ error: 'Diga o que você quer mudar.' }, { status: 400 });
  if (body.length < 40) return Response.json({ error: 'O artigo está vazio.' }, { status: 400 });
  const selection = str(b?.selection, 6000);
  try {
    const r = await refineArticle({ title: str(b?.title, 160), subtitle: str(b?.subtitle, 240), body, selection: selection.length >= 3 && body.includes(selection) ? selection : undefined, feedback, brand: await loadBrandProfile(c.brandId) });
    return Response.json({ text: r.text, note: r.note });
  } catch (e) {
    return Response.json({ error: e instanceof AiError ? e.message : 'Não foi possível ajustar o texto.', retryable: e instanceof AiError && e.retryable }, { status: e instanceof AiError && e.retryable ? 503 : 502 });
  }
}
