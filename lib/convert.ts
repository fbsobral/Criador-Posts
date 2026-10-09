import { and, count, eq, gte, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, brands, generationBatches, generationItems, posts, templates } from '@/db/schema';
import { AiError, generatePost, supportsAi, type GenerateResult } from './ai/generate';
import { MAX_SLIDES } from './ai/constants';
import { scriptText } from './format';
import { initialPostData } from './posts';

export class ConvertError extends Error {}

type Slide = Record<string, unknown>;
type Editor = 'carrossel' | 'tweet';

/** Slides do post de origem em texto, como se fosse um roteiro (a IA reescreve para o novo formato). */
export function toScript(editor: Editor, slides: Slide[]): string {
  return slides
    .map((s, i) => {
      const head = `Slide ${i + 1}${editor === 'carrossel' && s.format === 'cover' ? ' (capa)' : ''}:`;
      const body = editor === 'carrossel' ? scriptText(String(s.html ?? '')) : String(s.text ?? '').trim();
      const extras = [
        editor === 'tweet' && s.showButton ? `[Botão: ${String(s.button ?? '')}]` : '',
        s.image ? '[Este slide tem imagem]' : '',
      ].filter(Boolean).join('\n');
      return [head, body, extras].filter(Boolean).join('\n');
    })
    .join('\n\n');
}

/** Espaços de imagem do novo post, na ordem em que aparecem. */
function imageSlots(editor: Editor, slides: Slide[]): number[] {
  return slides
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => (editor === 'carrossel' ? ['cover', 'text-image', 'image'].includes(String(s.format)) : !!s.showImage))
    .map(({ i }) => i);
}

const KEEP_FROM_SOURCE = ['name', 'handle', 'accounts', 'view', 'avatar', 'imageBrief', 'year'] as const;

/**
 * Converte um post de carrossel em Tweet Card (ou o contrário) com IA, criando um NOVO rascunho.
 * O original não é alterado. `slidesWanted` é a quantidade exata de slides/cards pedida pelo usuário.
 */
export async function convertPostFormat(a: { brandId: string; userId: string; sourceId: string; slidesWanted: number }) {
  const want = Math.min(MAX_SLIDES, Math.max(1, Math.round(a.slidesWanted) || 1));

  const [src] = await db
    .select({ post: posts, editor: templates.editor })
    .from(posts)
    .leftJoin(templates, eq(templates.id, posts.templateId))
    .where(and(eq(posts.id, a.sourceId), eq(posts.brandId, a.brandId)));
  if (!src) throw new ConvertError('Post não encontrado.');
  const from = (src.editor ?? 'carrossel') as string;
  if (!supportsAi(from)) throw new ConvertError('Este formato ainda não pode ser convertido.');
  const to: Editor = from === 'carrossel' ? 'tweet' : 'carrossel';

  const srcSlides = (Array.isArray(src.post.data.slides) ? src.post.data.slides : []) as Slide[];
  if (!srcSlides.length) throw new ConvertError('O post não tem slides para converter.');

  const [target] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.editor, to), or(isNull(templates.brandId), eq(templates.brandId, a.brandId))))
    .orderBy(templates.name)
    .limit(1);
  if (!target) throw new ConvertError('Não há um template do formato de destino.');

  // limite diário de posts gerados com IA (o mesmo do "Gerar com IA")
  const dailyLimit = Number(process.env.AI_DAILY_LIMIT) || 100;
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const [{ n: today }] = await db.select({ n: count() }).from(generationItems).where(and(eq(generationItems.brandId, a.brandId), gte(generationItems.createdAt, startOfDay)));
  if (today + 1 > dailyLimit) throw new ConvertError(`Limite diário da marca: ${dailyLimit} posts gerados com IA.`);

  const [[settings], [brand]] = await Promise.all([
    db.select().from(brandSettings).where(eq(brandSettings.brandId, a.brandId)),
    db.select().from(brands).where(eq(brands.id, a.brandId)),
  ]);

  const images = srcSlides.map((s) => s.image).filter((x): x is string => typeof x === 'string' && !!x);
  const label = { carrossel: 'carrossel', tweet: 'Tweet Card' } as const;
  const noun = to === 'tweet' ? 'cards' : 'slides';

  const instructions = (retry: number | null) => [
    `CONVERSÃO DE FORMATO: o roteiro abaixo é de um post já pronto em formato ${label[from as Editor]}. Reescreva-o como ${label[to]}, mantendo as ideias, a ordem, os dados e a chamada para ação, e adaptando o texto ao novo formato (não é para copiar literalmente).`,
    `O novo post deve ter EXATAMENTE ${want} ${noun}.${retry !== null ? ` (A tentativa anterior devolveu ${retry}; respeite o número pedido.)` : ''} Condense ou divida o conteúdo conforme necessário, sem perder a mensagem principal.`,
    images.length
      ? `O post original tem ${images.length} imagem(ns). O novo post deve ter exatamente ${Math.min(images.length, want)} slide(s) com espaço de imagem, em posições equivalentes às do original. Em "image_note" descreva em poucas palavras o que a imagem mostra, a partir do texto do slide.`
      : 'O post original não tem imagens: não crie slides com espaço de imagem' + (to === 'carrossel' ? ' (use "text"; a capa pode ficar como "cover").' : '.'),
    'Não invente fatos, números ou fontes.',
  ].join('\n');

  const run = (retry: number | null) => generatePost({
    editor: to, mode: 'roteiro', brief: toScript(from as Editor, srcSlides), slidesTarget: want, facts: '',
    instructions: instructions(retry), withImages: images.length > 0,
    brand: {
      brandName: settings?.displayName || brand?.name || '', niche: settings?.aiNiche ?? '', audience: settings?.aiAudience ?? '', voice: settings?.aiVoice ?? '',
      rules: settings?.aiRules ?? '', cta: settings?.aiCta ?? '', examples: settings?.aiExamples ?? '', captionRules: settings?.aiCaptionRules ?? '',
    },
  });

  let result: GenerateResult;
  let tokensIn = 0, tokensOut = 0;
  const warnings: string[] = [];
  try {
    result = await run(null);
    tokensIn += result.inputTokens; tokensOut += result.outputTokens;
    if (result.slides.length !== want) { // uma segunda tentativa, mais firme
      const second = await run(result.slides.length);
      tokensIn += second.inputTokens; tokensOut += second.outputTokens;
      if (Math.abs(second.slides.length - want) <= Math.abs(result.slides.length - want)) result = second;
    }
  } catch (e) {
    throw new ConvertError(e instanceof AiError ? e.message : 'Não foi possível converter agora. Tente de novo.');
  }
  if (result.slides.length !== want) warnings.push(`Você pediu ${want} ${noun}, e a IA entregou ${result.slides.length}. Ajuste no editor, se precisar.`);

  // as imagens do post original passam para os espaços de imagem do novo, na ordem
  const slots = imageSlots(to, result.slides);
  slots.slice(0, images.length).forEach((slotIdx, k) => {
    const sl = result.slides[slotIdx];
    sl.image = images[k];
    if (to === 'tweet') sl.showImage = true;
  });
  const g = { ...initialPostData(settings, null).g } as Record<string, unknown>;
  const srcG = src.post.data.g as Record<string, unknown>;
  for (const k of KEEP_FROM_SOURCE) if (srcG[k] !== undefined && srcG[k] !== null && srcG[k] !== '') g[k] = srcG[k];
  g.topic = to === 'carrossel' ? (result.topic || String(srcG.topic ?? '')) : String(srcG.topic ?? '');

  const data = { v: to === 'tweet' ? 1 : 2, g, slides: result.slides } as typeof src.post.data;
  const [created] = await db
    .insert(posts)
    .values({
      brandId: a.brandId, templateId: target.id, sourcePostId: src.post.id, status: 'draft',
      title: `${src.post.title} (${label[to]})`.slice(0, 120), caption: src.post.caption || result.caption, data, createdBy: a.userId, updatedBy: a.userId,
    })
    .returning({ id: posts.id });

  // registra como geração com IA (custo e limite diário aparecem em "Gerar com IA")
  const [batch] = await db.insert(generationBatches).values({
    brandId: a.brandId, templateId: target.id, mode: 'roteiro', slidesTarget: want, createdBy: a.userId,
    instructions: `Conversão de ${label[from as Editor]} para ${label[to]}`,
  }).returning({ id: generationBatches.id });
  await db.insert(generationItems).values({
    batchId: batch.id, brandId: a.brandId, brief: `Conversão: ${src.post.title}`.slice(0, 300), status: 'done', postId: created.id,
    notes: [...warnings, ...result.notes], inputTokens: tokensIn, outputTokens: tokensOut, attempts: 1,
  });

  return { postId: created.id, warnings, slides: result.slides.length };
}
