import { and, count, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, brands, generationBatches, generationItems, imageGenerations, posts, templates } from '@/db/schema';
import { initialPostData } from '../posts';
import { AiError, generatePost, supportsAi } from './generate';
import { MAX_IMAGES_PER_POST } from './constants';
import { IMAGE_MODEL, ImageError, buildPrompt, combineBriefs, generateImage, imageEnabled, type AspectRatio } from './image';
import { deriveImagePrompt, deriveImagePromptsForPost } from './image-prompt';
import { plainText } from '../format';
import { ASSET_URL, saveAsset } from '../assets';

const CONCURRENCY = 3;
const MAX_ATTEMPTS = 3;
const STUCK_AFTER_MIN = 5;

// Em memória (processo do servidor): evita rodar o mesmo lote duas vezes.
const g = globalThis as unknown as { __aiRunning?: Set<string> };
const running = (g.__aiRunning ??= new Set<string>());

/** Começa (ou retoma) o processamento de um lote em segundo plano. */
export function kickBatch(batchId: string) {
  if (running.has(batchId)) return;
  running.add(batchId);
  runBatch(batchId)
    .catch((e) => console.error('[ai] lote falhou', batchId, e))
    .finally(() => running.delete(batchId));
}

async function runBatch(batchId: string) {
  // itens "gerando" há muito tempo (ex.: servidor reiniciou) voltam para a fila
  await db.execute(sql`update generation_items set status = 'queued', updated_at = now()
    where batch_id = ${batchId} and status = 'running' and updated_at < now() - make_interval(mins => ${STUCK_AFTER_MIN})`);

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (;;) {
        const id = await claimNext(batchId);
        if (!id) return;
        await processItem(id);
      }
    }),
  );
}

/** Pega o próximo item da fila de forma atômica (vários workers não pegam o mesmo). */
async function claimNext(batchId: string): Promise<string | null> {
  const rows = (await db.execute(sql`update generation_items
    set status = 'running', attempts = attempts + 1, updated_at = now()
    where id = (select id from generation_items where batch_id = ${batchId} and status = 'queued' order by created_at, id limit 1 for update skip locked)
    returning id`)) as unknown as { id: string }[];
  return rows[0]?.id ?? null;
}

async function processItem(itemId: string) {
  const [row] = await db
    .select({
      item: generationItems, batch: generationBatches,
      brandName: brands.name, settings: brandSettings, editor: templates.editor, templateId: templates.id,
    })
    .from(generationItems)
    .innerJoin(generationBatches, eq(generationBatches.id, generationItems.batchId))
    .innerJoin(brands, eq(brands.id, generationItems.brandId))
    .innerJoin(brandSettings, eq(brandSettings.brandId, generationItems.brandId))
    .leftJoin(templates, eq(templates.id, generationBatches.templateId))
    .where(eq(generationItems.id, itemId));

  if (!row) return;
  const { item, batch, settings } = row;
  const fail = (error: string) =>
    db.update(generationItems).set({ status: 'error', error, updatedAt: new Date() }).where(eq(generationItems.id, itemId));

  if (!row.editor || !supportsAi(row.editor)) return void (await fail('Este template ainda não suporta geração com IA.'));

  try {
    const result = await generatePost({
      editor: row.editor,
      mode: batch.mode === 'roteiro' ? 'roteiro' : 'tema',
      brief: item.brief,
      slidesTarget: batch.slidesTarget,
      facts: batch.facts,
      instructions: batch.instructions,
      withImages: batch.withImages,
      brand: {
        brandName: settings.displayName || row.brandName,
        niche: settings.aiNiche, audience: settings.aiAudience, voice: settings.aiVoice,
        rules: settings.aiRules, cta: settings.aiCta, examples: settings.aiExamples, captionRules: settings.aiCaptionRules,
      },
    });

    // imagens (Nano Banana) só para os espaços de imagem dos slides deste formato
    let imageCount = 0;
    const imageNotes: string[] = [];
    if (batch.withImages && imageEnabled()) {
      const r = await addImages(row.editor, result.slides, {
        brandId: item.brandId, userId: batch.createdBy, title: result.title || item.brief.slice(0, 60), topic: result.topic,
        brandName: settings.displayName || row.brandName, niche: settings.aiNiche, audience: settings.aiAudience, imageStyle: combineBriefs(settings.aiImageStyle, batch.imageBrief),
      }, () => db.update(generationItems).set({ updatedAt: new Date() }).where(eq(generationItems.id, itemId)));
      imageCount = r.count; imageNotes.push(...r.notes);
    }

    const data = initialPostData(settings, result.slides);
    if (batch.imageBrief.trim()) data.g.imageBrief = batch.imageBrief.trim();
    if (row.editor === 'carrossel' && result.topic) data.g.topic = result.topic;

    const [post] = await db
      .insert(posts)
      .values({
        brandId: item.brandId, templateId: row.templateId, status: 'draft',
        title: result.title || item.brief.slice(0, 60), caption: result.caption,
        data, createdBy: batch.createdBy, updatedBy: batch.createdBy,
      })
      .returning({ id: posts.id });

    await db.update(generationItems).set({
      status: 'done', postId: post.id, notes: [...result.notes.filter((n) => !(imageCount && /imagem:/.test(n))), ...imageNotes], imageCount, error: null,
      inputTokens: result.inputTokens, outputTokens: result.outputTokens, updatedAt: new Date(),
    }).where(eq(generationItems.id, itemId));
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError('Erro inesperado ao gerar o post.');
    console.error('[ai] item falhou', itemId, e);
    if (err.retryable && item.attempts < MAX_ATTEMPTS) {
      await db.update(generationItems).set({ status: 'queued', error: err.message, updatedAt: new Date() }).where(eq(generationItems.id, itemId));
      await new Promise((r) => setTimeout(r, 2000 * item.attempts));
    } else {
      await fail(err.message);
    }
  }
}


const RATIO_BY_FORMAT: Record<string, AspectRatio> = { cover: '16:9', 'text-image': '4:3', image: '4:5' };
const HAS_IMAGE_SLOT = new Set(['cover', 'text-image', 'image']);

type ImageCtx = { brandId: string; userId: string | null; title: string; topic: string; brandName: string; niche: string; audience: string; imageStyle: string };

/**
 * Gera as imagens dos slides que têm espaço de imagem (carrossel: capa, texto+imagem, imagem; Tweet Card: slides com imagem ligada).
 * A direção de arte cria/melhora a descrição de cada imagem a partir do slide e do post antes de ir para o Nano Banana.
 */
async function addImages(editor: 'carrossel' | 'tweet', slides: Record<string, unknown>[], ctx: ImageCtx, heartbeat: () => Promise<unknown>) {
  const targets = slides
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => (editor === 'carrossel' ? HAS_IMAGE_SLOT.has(String(s.format)) : !!s.showImage))
    .slice(0, MAX_IMAGES_PER_POST);

  const limit = Number(process.env.AI_IMAGE_DAILY_LIMIT) || 60;
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const [{ n: usedToday }] = await db.select({ n: count() }).from(imageGenerations).where(and(eq(imageGenerations.brandId, ctx.brandId), gte(imageGenerations.createdAt, startOfDay)));
  let used = usedToday;

  const text = (s: Record<string, unknown>) => plainText(String(s.html ?? s.text ?? '')).slice(0, 900);
  const outline = slides.map((s, i) => `${i + 1}. ${text(s).slice(0, 140)}`);
  const notes: string[] = [];
  let count_ = 0;

  // uma única chamada descreve todas as imagens do post, com direção de arte coesa
  const brandArt = { brandName: ctx.brandName, niche: ctx.niche, audience: ctx.audience, imageStyle: ctx.imageStyle };
  const planned = await deriveImagePromptsForPost(
    { title: ctx.title, topic: ctx.topic, outline, total: slides.length },
    targets.map(({ s, i }) => ({ slide: i + 1, text: text(s), format: editor === 'tweet' ? 'tweet-card' : String(s.format), hint: String(s.imagePrompt ?? '').trim() || undefined })),
    brandArt,
  );

  for (const { s, i } of targets) {
    const label = `Slide ${i + 1}`;
    if (used >= limit) { notes.push(`${label} · imagem não gerada: limite diário de imagens atingido.`); continue; }
    try {
      await heartbeat();
      const hint = String(s.imagePrompt ?? '').trim();
      const plan = planned.get(i + 1)
        ?? await deriveImagePrompt(
          { slideText: text(s), slideIndex: i + 1, total: slides.length, outline, title: ctx.title, topic: ctx.topic, format: editor === 'tweet' ? 'tweet-card' : String(s.format), hint: hint || undefined },
          brandArt,
        );
      const art = { prompt: plan.prompt, tags: plan.tags };
      const ratio = (editor === 'carrossel' ? RATIO_BY_FORMAT[String(s.format)] : '16:9') ?? '4:3';
      const img = await generateImage(buildPrompt(art.prompt, ctx.imageStyle), ratio);
      const saved = await saveAsset({ brandId: ctx.brandId, userId: ctx.userId, kind: 'ai', data: Buffer.from(img.data, 'base64'), description: art.prompt, tags: art.tags });
      s.image = ASSET_URL(saved.id);
      s.imagePrompt = art.prompt;
      s.aiRatio = ratio;
      if (editor === 'tweet') s.showImage = true;
      await db.insert(imageGenerations).values({ brandId: ctx.brandId, userId: ctx.userId, model: IMAGE_MODEL, prompt: art.prompt.slice(0, 1500), aspectRatio: ratio });
      used++; count_++;
    } catch (e) {
      const msg = e instanceof ImageError || e instanceof AiError ? e.message : 'erro inesperado';
      console.error('[ai] imagem falhou', label, e);
      notes.push(`${label} · imagem não gerada: ${msg}`);
    }
  }
  return { count: count_, notes };
}
