import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { contentIdeas, videoScripts } from '@/db/schema';
import { loadPersonas, personaIdsFromBody } from '@/lib/idea-server';
import { personaBlock } from '@/lib/ai/idea';
import { getCtx } from '@/lib/ctx';
import { AiError } from '@/lib/ai/generate';
import { writeVideoScript } from '@/lib/ai/video';
import { MAX_CONTENT_CHARS } from '@/lib/video';
import { VIDEO_DAILY_LIMIT, cleanPlatform, cleanSeconds, loadBrandProfile, scriptsToday } from '@/lib/video-server';
import { TOO_MANY, rateLimit } from '@/lib/rate-limit';

export const maxDuration = 180;

/** Escreve UM roteiro a partir do material (ou de uma ideia de conteúdo). Sem formato: a IA escreve livre. */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  if (!rateLimit(`ai:${c.userId}`, 100, 10 * 60_000)) return Response.json(TOO_MANY, { status: 429 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const content = String(b?.content ?? '').trim();
  if (content.length < 20) return Response.json({ error: 'Escreva ou cole o material do vídeo.' }, { status: 400 });
  if ((await scriptsToday(c.brandId)) + 1 > VIDEO_DAILY_LIMIT) return Response.json({ error: `Limite diário da marca: ${VIDEO_DAILY_LIMIT} roteiros.` }, { status: 429 });
  const seconds = cleanSeconds(b?.seconds), platform = cleanPlatform(b?.platform);
  // roteiro nascido de uma ideia de conteúdo com persona: a IA recebe o perfil (ou os perfis, num público amplo)
  const persons = await loadPersonas(c.brandId, personaIdsFromBody(b));
  const profile = (p: (typeof persons)[number]) => `${personaBlock(p)}${p.data.quote ? `\nFrase típica: ${p.data.quote}` : ''}${p.data.channels.length ? `\nOnde está: ${p.data.channels.join('; ')}` : ''}`;
  const personaBrief = persons.map(profile).join('\n\n');
  try {
    const r = await writeVideoScript({
      content: content.slice(0, MAX_CONTENT_CHARS), seconds, instructions: String(b?.instructions ?? '').slice(0, 1500),
      brand: await loadBrandProfile(c.brandId), personaBrief: personaBrief || undefined,
    });
    const [row] = await db.insert(videoScripts).values({
      brandId: c.brandId, formatId: null, formatName: '', batchId: null, title: r.title, platform, seconds, angle: '',
      data: r.data, inputTokens: r.inputTokens, outputTokens: r.outputTokens, createdBy: c.userId,
    }).returning({ id: videoScripts.id });
    // roteiro nascido de uma ideia de conteúdo: a ideia passa a "usada"
    const ideaId = typeof b?.ideaId === 'string' ? b.ideaId : '';
    if (/^[0-9a-f-]{36}$/i.test(ideaId)) await db.update(contentIdeas).set({ status: 'used', updatedAt: new Date() }).where(and(eq(contentIdeas.id, ideaId), eq(contentIdeas.brandId, c.brandId)));
    return Response.json({ id: row.id, title: r.title });
  } catch (e) {
    return Response.json({ error: e instanceof AiError ? e.message : 'Não foi possível gerar o roteiro.', retryable: e instanceof AiError && e.retryable }, { status: e instanceof AiError && e.retryable ? 503 : 502 });
  }
}
