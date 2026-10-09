import { and, count, eq, gte } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, brands, imageGenerations } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { cleanTags, deriveImagePrompt, type SlideContext } from '@/lib/ai/image-prompt';
import { ASSET_THUMB_URL, ASSET_URL, saveAsset } from '@/lib/assets';
import { ASPECT_RATIOS, IMAGE_MODEL, ImageError, MAX_PROMPT_CHARS, buildPrompt, combineBriefs, generateImage, imageEnabled, type AspectRatio } from '@/lib/ai/image';

export const maxDuration = 130;
const DAILY_LIMIT = Number(process.env.AI_IMAGE_DAILY_LIMIT) || 60;

/** Gera uma imagem com o Nano Banana para um slide. */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  if (!imageEnabled()) return Response.json({ error: 'Geração de imagens não configurada (GEMINI_API_KEY).' }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { prompt?: string; ratio?: string; context?: Partial<SlideContext>; improve?: boolean; postBrief?: string; mode?: string; hint?: string; previousPrompt?: string; feedback?: string; tags?: string[] } | null;
  let description = String(body?.prompt ?? '').trim();
  let ratio = (ASPECT_RATIOS as readonly string[]).includes(body?.ratio ?? '') ? (body!.ratio as AspectRatio) : '4:3';
  const ctxIn = body?.context;
  const promptOnly = body?.mode === 'prompt';
  if (!promptOnly && description.length < 3 && !(ctxIn && (String(ctxIn.slideText ?? '').trim() || String(ctxIn.title ?? '').trim()))) {
    return Response.json({ error: 'Descreva a imagem que você quer.' }, { status: 400 });
  }
  if (description.length > MAX_PROMPT_CHARS) return Response.json({ error: `A descrição pode ter até ${MAX_PROMPT_CHARS} caracteres.` }, { status: 400 });

  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const [{ n }] = await db.select({ n: count() }).from(imageGenerations).where(and(eq(imageGenerations.brandId, c.brandId), gte(imageGenerations.createdAt, startOfDay)));
  if (n >= DAILY_LIMIT) return Response.json({ error: `Limite diário de imagens da marca atingido (${DAILY_LIMIT}).` }, { status: 429 });

  const [settings] = await db
    .select({ style: brandSettings.aiImageStyle, niche: brandSettings.aiNiche, audience: brandSettings.aiAudience, name: brands.name })
    .from(brandSettings)
    .innerJoin(brands, eq(brands.id, brandSettings.brandId))
    .where(eq(brandSettings.brandId, c.brandId));
  const brief = combineBriefs(settings?.style ?? '', String(body?.postBrief ?? ''));
  const clip = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

  // Modo "prompt": só cria (ou ajusta, com feedback) a descrição, para o usuário revisar. Não gera imagem nem conta no limite.
  if (promptOnly) {
    if (!ctxIn) return Response.json({ error: 'Faltou o contexto do slide.' }, { status: 400 });
    try {
      const art = await deriveImagePrompt(
        {
          slideText: clip(ctxIn.slideText, 900), slideIndex: Number(ctxIn.slideIndex) || 1, total: Number(ctxIn.total) || 1,
          outline: (Array.isArray(ctxIn.outline) ? ctxIn.outline : []).slice(0, 14).map((l) => clip(l, 160)),
          title: clip(ctxIn.title, 120), topic: clip(ctxIn.topic, 80), format: clip(ctxIn.format, 40) || 'slide',
          hint: clip(body?.hint, 1500) || undefined, previous: clip(body?.previousPrompt, 1500) || undefined, feedback: clip(body?.feedback, 600) || undefined,
        },
        { brandName: settings?.name ?? '', niche: settings?.niche ?? '', audience: settings?.audience ?? '', imageStyle: brief },
      );
      return Response.json({ prompt: art.prompt, tags: art.tags, ratio: art.ratio });
    } catch (e) {
      const err = e instanceof ImageError ? e : new ImageError('Não foi possível criar a descrição.');
      return Response.json({ error: err.message }, { status: err.status });
    }
  }
  try {
    let derived = false;
    let tags: string[] = cleanTags(body?.tags);
    const improve = !!body?.improve && description.length >= 3 && !!ctxIn && !!process.env.ANTHROPIC_API_KEY;
    if ((description.length < 3 || improve) && ctxIn) {
      // modo automático: o Claude cria a descrição a partir do texto do slide e do contexto do post
      const clip = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
      const art = await deriveImagePrompt(
        {
          slideText: clip(ctxIn.slideText, 900), slideIndex: Number(ctxIn.slideIndex) || 1, total: Number(ctxIn.total) || 1,
          outline: (Array.isArray(ctxIn.outline) ? ctxIn.outline : []).slice(0, 14).map((l) => clip(l, 160)),
          title: clip(ctxIn.title, 120), topic: clip(ctxIn.topic, 80), format: clip(ctxIn.format, 40) || 'slide',
          hint: improve ? description : undefined,
        },
        { brandName: settings?.name ?? '', niche: settings?.niche ?? '', audience: settings?.audience ?? '', imageStyle: brief },
      );
      description = art.prompt;
      tags = art.tags;
      if (!body?.ratio && art.ratio && (ASPECT_RATIOS as readonly string[]).includes(art.ratio)) ratio = art.ratio as AspectRatio;
      derived = true;
    }
    const img = await generateImage(buildPrompt(description, brief), ratio);
    const saved = await saveAsset({ brandId: c.brandId, userId: c.userId, kind: 'ai', data: Buffer.from(img.data, 'base64'), description, tags });
    await db.insert(imageGenerations).values({ brandId: c.brandId, userId: c.userId, model: IMAGE_MODEL, prompt: description.slice(0, 1500), aspectRatio: ratio });
    return Response.json({ id: saved.id, url: ASSET_URL(saved.id), thumb: ASSET_THUMB_URL(saved.id), prompt: description, ratio, derived, reused: saved.reused, remaining: DAILY_LIMIT - n - 1 });
  } catch (e) {
    const err = e instanceof ImageError ? e : new ImageError('Erro inesperado ao gerar a imagem.');
    if (!(e instanceof ImageError)) console.error('[image]', e);
    return Response.json({ error: err.message }, { status: err.status });
  }
}
