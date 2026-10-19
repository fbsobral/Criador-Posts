import { db } from '@/db';
import { videoScripts } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { AiError } from '@/lib/ai/generate';
import { generateVideoScript } from '@/lib/ai/video';
import { MAX_CONTENT_CHARS } from '@/lib/video';
import { VIDEO_DAILY_LIMIT, cleanPlatform, cleanSeconds, loadBrandProfile, loadFormat, scriptsToday } from '@/lib/video-server';

export const maxDuration = 120;

/** Gera UM roteiro (a tela chama uma vez por ideia aprovada, assim mostra o progresso de cada um). */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const content = String(b?.content ?? '').trim();
  const idea = b?.idea as { title?: string; angle?: string; points?: unknown[] } | undefined;
  if (content.length < 40 || !idea?.title?.trim()) return Response.json({ error: 'Faltou o conteúdo ou a ideia.' }, { status: 400 });
  const format = await loadFormat(c.brandId, String(b?.formatId ?? ''));
  if (!format) return Response.json({ error: 'Formato não encontrado.' }, { status: 400 });
  if ((await scriptsToday(c.brandId)) + 1 > VIDEO_DAILY_LIMIT) return Response.json({ error: `Limite diário da marca: ${VIDEO_DAILY_LIMIT} roteiros.` }, { status: 429 });
  const seconds = cleanSeconds(b?.seconds), platform = cleanPlatform(b?.platform);
  const ideaClean = { title: String(idea.title).trim().slice(0, 140), angle: String(idea.angle ?? '').trim().slice(0, 500), points: (Array.isArray(idea.points) ? idea.points : []).map((p) => String(p).trim().slice(0, 240)).filter(Boolean).slice(0, 6) };
  try {
    const r = await generateVideoScript({
      content: content.slice(0, MAX_CONTENT_CHARS), format: { name: format.name, parts: format.parts }, seconds, platform,
      instructions: String(b?.instructions ?? '').slice(0, 1500), brand: await loadBrandProfile(c.brandId), idea: ideaClean,
    });
    const batchId = /^[0-9a-f-]{36}$/i.test(String(b?.batchId ?? '')) ? String(b?.batchId) : null;
    const [row] = await db.insert(videoScripts).values({
      brandId: c.brandId, formatId: format.id, formatName: format.name, batchId, title: r.title, platform, seconds, angle: ideaClean.angle,
      data: r.data, inputTokens: r.inputTokens, outputTokens: r.outputTokens, createdBy: c.userId,
    }).returning({ id: videoScripts.id });
    return Response.json({ id: row.id, title: r.title });
  } catch (e) {
    return Response.json({ error: e instanceof AiError ? e.message : 'Não foi possível gerar o roteiro.', retryable: e instanceof AiError && e.retryable }, { status: e instanceof AiError && e.retryable ? 503 : 502 });
  }
}
