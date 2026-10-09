import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, brands, generationBatches, generationItems, posts, templates } from '@/db/schema';
import { initialPostData } from '../posts';
import { AiError, generatePost, supportsAi } from './generate';

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
      brand: {
        brandName: settings.displayName || row.brandName,
        niche: settings.aiNiche, audience: settings.aiAudience, voice: settings.aiVoice,
        rules: settings.aiRules, cta: settings.aiCta, examples: settings.aiExamples,
      },
    });

    const data = initialPostData(settings, result.slides);
    if (row.editor === 'carrossel' && result.topic) data.g.topic = result.topic;

    const [post] = await db
      .insert(posts)
      .values({
        brandId: item.brandId, templateId: row.templateId, status: 'draft',
        title: result.title || item.brief.slice(0, 60),
        data, createdBy: batch.createdBy, updatedBy: batch.createdBy,
      })
      .returning({ id: posts.id });

    await db.update(generationItems).set({
      status: 'done', postId: post.id, notes: result.notes, error: null,
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
