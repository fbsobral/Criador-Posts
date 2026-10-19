import { getCtx } from '@/lib/ctx';
import { AiError } from '@/lib/ai/generate';
import { planVideoIdeas } from '@/lib/ai/video';
import { MAX_CONTENT_CHARS, MAX_VIDEO_IDEAS } from '@/lib/video';
import { VIDEO_DAILY_LIMIT, cleanPlatform, cleanSeconds, loadBrandProfile, loadFormat, scriptsToday } from '@/lib/video-server';

export const maxDuration = 120;

/** Passo "ideias": a IA sugere os ângulos dos vídeos; nada é gravado e o usuário aprova antes de gerar os roteiros. */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const content = String(b?.content ?? '').trim();
  if (content.length < 40) return Response.json({ error: 'Cole um conteúdo maior (um texto, artigo ou transcrição).' }, { status: 400 });
  const count = Math.min(MAX_VIDEO_IDEAS, Math.max(1, Math.round(Number(b?.count)) || 1));
  const format = await loadFormat(c.brandId, String(b?.formatId ?? ''));
  if (!format) return Response.json({ error: 'Formato não encontrado.' }, { status: 400 });
  if ((await scriptsToday(c.brandId)) + count > VIDEO_DAILY_LIMIT) return Response.json({ error: `Limite diário da marca: ${VIDEO_DAILY_LIMIT} roteiros.` }, { status: 429 });
  try {
    const r = await planVideoIdeas({
      content: content.slice(0, MAX_CONTENT_CHARS), format: { name: format.name, parts: format.parts }, seconds: cleanSeconds(b?.seconds),
      platform: cleanPlatform(b?.platform), instructions: String(b?.instructions ?? '').slice(0, 1500), brand: await loadBrandProfile(c.brandId),
      count, feedback: String(b?.feedback ?? '').slice(0, 600),
    });
    return Response.json({ ideas: r.ideas, truncated: content.length > MAX_CONTENT_CHARS });
  } catch (e) {
    return Response.json({ error: e instanceof AiError ? e.message : 'Não foi possível sugerir ideias.' }, { status: e instanceof AiError && e.retryable ? 503 : 502 });
  }
}
