import Anthropic from '@anthropic-ai/sdk';
import { AI_MODEL } from './generate';
import { ImageError } from './image';

export type SlideContext = {
  slideText: string;
  slideIndex: number;
  total: number;
  outline: string[];
  title: string;
  topic: string;
  format: string;
  /** Instrução de imagem escrita pelo usuário/roteiro (pode estar vaga ou fraca). */
  hint?: string;
};

export type ArtBrand = { brandName: string; niche: string; audience: string; imageStyle: string };

const SYSTEM = `Você é um diretor de arte de redes sociais. Sua tarefa: escrever a descrição de UMA imagem para um slide de carrossel, que será gerada por um modelo de imagem (Nano Banana).

A imagem deve ser ESTRATÉGICA: reforçar a mensagem deste slide e ajudar o leitor a entender ou sentir a ideia, não decorar. Considere o papel do slide dentro do post (abertura, explicação, prova, fechamento).

REGRAS
- Descreva cena, sujeito, composição, enquadramento, luz, paleta e clima, em 2 a 4 frases objetivas, em português do Brasil.
- Prefira imagens que funcionem como apoio: metáfora visual clara, ambiente real ou objeto simbólico. Evite cenas genéricas de banco de imagens.
- NÃO coloque texto, letras, números, logotipos, interfaces nem gráficos com dados na imagem (o texto do post fica no slide, e modelos de imagem erram números).
- NÃO retrate pessoas reais ou figuras públicas identificáveis. Pessoas genéricas são aceitáveis só se ajudarem a mensagem.
- Deixe a composição limpa, com área de respiro, pois o slide terá texto ao lado ou acima.
- Respeite o estilo visual da marca, se houver.

QUANDO HOUVER "INSTRUÇÃO DO USUÁRIO"
- Se estiver clara e boa, preserve a intenção e apenas enriqueça (composição, luz, paleta, enquadramento).
- Se estiver vaga, confusa, genérica ou fraca para o objetivo do slide, reescreva por completo de forma estratégica, mantendo só o que for útil.
- Se pedir texto, números, gráficos com dados ou pessoas reais, adapte para uma alternativa visual que funcione (o texto fica no slide).`;

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['prompt', 'ratio'],
  properties: {
    prompt: { type: 'string' },
    ratio: { type: 'string', enum: ['16:9', '4:3', '1:1', '4:5', '3:4'] },
  },
};

/** Cria a descrição da imagem a partir do texto do slide e do contexto do post. */
export async function deriveImagePrompt(ctx: SlideContext, brand: ArtBrand): Promise<{ prompt: string; ratio: string | null }> {
  if (process.env.AI_MOCK === '1') return { prompt: `${ctx.hint ? 'Versão melhorada de "' + ctx.hint.slice(0, 40) + '": ' : ''}imagem de apoio simbólica para: ${ctx.slideText.slice(0, 80)}`, ratio: null };
  if (!process.env.ANTHROPIC_API_KEY) throw new ImageError('Para criar a descrição automática é preciso a ANTHROPIC_API_KEY. Ou escreva a descrição você mesmo.', 503);

  const brandLines = [
    brand.brandName && `Marca: ${brand.brandName}`, brand.niche && `Nicho: ${brand.niche}`,
    brand.audience && `Público: ${brand.audience}`, brand.imageStyle && `Estilo visual das imagens da marca: ${brand.imageStyle}`,
  ].filter(Boolean).join('\n');

  const user = [
    brandLines,
    `POST: ${ctx.title || '(sem título)'}${ctx.topic ? ` · tema: ${ctx.topic}` : ''}`,
    `FORMATO DO SLIDE: ${ctx.format}`,
    `ESTE É O SLIDE ${ctx.slideIndex} DE ${ctx.total}.`,
    ctx.outline.length ? `ROTEIRO COMPLETO (resumo de cada slide):\n${ctx.outline.map((l) => `- ${l}`).join('\n')}` : '',
    `TEXTO DESTE SLIDE:\n${ctx.slideText || '(slide sem texto: use o título e o roteiro do post)'}`,
    ctx.hint?.trim() ? `INSTRUÇÃO DO USUÁRIO PARA A IMAGEM:\n${ctx.hint.trim()}` : '',
  ].filter(Boolean).join('\n\n');

  try {
    const client = new Anthropic();
    const res = await client.beta.messages.create({
      model: AI_MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: user }],
    });
    if (res.stop_reason === 'refusal') throw new ImageError('A IA recusou criar uma descrição para este slide. Escreva a descrição você mesmo.', 422);
    const text = res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '';
    const out = JSON.parse(text) as { prompt?: string; ratio?: string };
    const prompt = String(out.prompt ?? '').trim().slice(0, 1200);
    if (prompt.length < 10) throw new ImageError('Não consegui criar a descrição da imagem. Tente de novo.', 502);
    return { prompt, ratio: typeof out.ratio === 'string' ? out.ratio : null };
  } catch (e) {
    if (e instanceof ImageError) throw e;
    if (e instanceof Anthropic.RateLimitError) throw new ImageError('Limite de uso da IA atingido. Tente em instantes.', 429);
    if (e instanceof Anthropic.APIError) throw new ImageError(`Erro da IA ao criar a descrição (${e.status}).`, 502);
    throw new ImageError('Não foi possível criar a descrição da imagem.', 502);
  }
}


export type PostImageTarget = { slide: number; text: string; format: string; hint?: string };

const SCHEMA_POST = {
  type: 'object', additionalProperties: false, required: ['style', 'items'],
  properties: {
    style: { type: 'string' },
    items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['slide', 'prompt'], properties: { slide: { type: 'integer' }, prompt: { type: 'string' } } } },
  },
};

const SYSTEM_POST = SYSTEM.replace('escrever a descrição de UMA imagem para um slide de carrossel', 'escrever a descrição das imagens de VÁRIOS slides de um mesmo post') + `

VÁRIAS IMAGENS NO MESMO POST
- Defina primeiro uma direção de arte única para o post ("style": paleta, luz, tipo de imagem, clima) e aplique-a a TODAS as imagens, para o post parecer coeso.
- Cada imagem deve ter uma cena diferente e específica do seu slide, sem repetir objetos nem composições.
- Devolva exatamente um item por slide solicitado, com o número do slide em "slide".`;

/**
 * Cria as descrições de todas as imagens de um post de uma vez (uma única chamada):
 * mais barato e com direção de arte coesa. Devolve slide → descrição.
 */
export async function deriveImagePromptsForPost(
  post: { title: string; topic: string; outline: string[]; total: number },
  targets: PostImageTarget[],
  brand: ArtBrand,
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (!targets.length) return out;
  if (process.env.AI_MOCK === '1') {
    targets.forEach((t) => out.set(t.slide, `${t.hint ? `Versão melhorada de "${t.hint.slice(0, 40)}": ` : ''}imagem para: ${t.text.slice(0, 80)}`));
    return out;
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new ImageError('ANTHROPIC_API_KEY não configurada.', 503);

  const brandLines = [
    brand.brandName && `Marca: ${brand.brandName}`, brand.niche && `Nicho: ${brand.niche}`,
    brand.audience && `Público: ${brand.audience}`, brand.imageStyle && `Estilo visual das imagens da marca: ${brand.imageStyle}`,
  ].filter(Boolean).join('\n');
  const user = [
    brandLines,
    `POST: ${post.title || '(sem título)'}${post.topic ? ` · tema: ${post.topic}` : ''} (${post.total} slides)`,
    `ROTEIRO COMPLETO (resumo de cada slide):\n${post.outline.map((l) => `- ${l}`).join('\n')}`,
    `SLIDES QUE PRECISAM DE IMAGEM:\n${targets.map((t) => `Slide ${t.slide} (${t.format})\nTexto: ${t.text || '(sem texto)'}${t.hint ? `\nINSTRUÇÃO DO USUÁRIO PARA A IMAGEM: ${t.hint}` : ''}`).join('\n\n')}`,
  ].filter(Boolean).join('\n\n');

  try {
    const client = new Anthropic();
    const res = await client.beta.messages.create({
      model: AI_MODEL, max_tokens: 6000,
      betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      system: SYSTEM_POST,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA_POST } },
      messages: [{ role: 'user', content: user }],
    });
    if (res.stop_reason === 'refusal') return out;
    const text = res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '';
    const parsed = JSON.parse(text) as { items?: { slide?: number; prompt?: string }[] };
    for (const it of parsed.items ?? []) {
      const prompt = String(it.prompt ?? '').trim().slice(0, 1200);
      if (Number.isInteger(it.slide) && prompt.length >= 10) out.set(it.slide!, prompt);
    }
  } catch (e) {
    console.error('[ai] direção de arte do post falhou (usarei slide a slide):', e instanceof Error ? e.message : e);
  }
  return out;
}
