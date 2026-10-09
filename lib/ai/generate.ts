import Anthropic from '@anthropic-ai/sdk';
import { MAX_SLIDES } from './constants';

/** Modelo escolhido para a geração (maior qualidade de copy). */
export const AI_MODEL = 'claude-opus-5-5';
export { costUsd } from './constants';

export class AiError extends Error {
  constructor(message: string, public retryable = false) {
    super(message);
  }
}

export type BrandProfile = {
  brandName: string;
  niche: string;
  audience: string;
  voice: string;
  rules: string;
  cta: string;
  examples: string;
};

export type GenerateInput = {
  editor: 'carrossel' | 'tweet';
  mode: 'tema' | 'roteiro';
  brief: string;
  slidesTarget: number;
  facts: string;
  instructions: string;
  brand: BrandProfile;
};

export type GenerateResult = {
  title: string;
  topic: string;
  slides: Record<string, unknown>[];
  /** Linhas para o revisor: sugestões de imagem e dados a conferir. */
  notes: string[];
  inputTokens: number;
  outputTokens: number;
};

/* ---------- limpeza do HTML gerado (vai para innerHTML no editor) ---------- */
const ALLOWED_TAGS = new Set(['h2', 'p', 'ul', 'li', 'b', 'strong', 'i', 'em', 'u', 'br']);
const UL_CLASSES = new Set(['check', 'arrow', 'dot']);

export function sanitizeHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi, (m, tag: string, attrs: string) => {
      const t = tag.toLowerCase();
      if (!ALLOWED_TAGS.has(t)) return '';
      if (m.startsWith('</')) return `</${t}>`;
      if (t === 'ul') {
        const cls = /class\s*=\s*["']?([a-z]+)/i.exec(attrs)?.[1]?.toLowerCase();
        return cls && UL_CLASSES.has(cls) ? `<ul class="${cls}">` : '<ul class="dot">';
      }
      return t === 'br' ? '<br>' : `<${t}>`;
    })
    .replace(/<(?![a-z/])/gi, '&lt;');
}

const clean = (s: unknown, max = 400) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

/* ---------- instruções ---------- */
function brandBlock(b: BrandProfile): string {
  const lines = [
    ['Marca', b.brandName], ['Nicho', b.niche], ['Público', b.audience], ['Tom de voz', b.voice],
    ['Regras (o que sempre/nunca fazer)', b.rules], ['Chamada para ação (CTA) padrão', b.cta],
  ].filter(([, v]) => v.trim());
  let out = lines.map(([k, v]) => `- ${k}: ${v.trim()}`).join('\n');
  if (b.examples.trim()) out += `\n\nEXEMPLOS DE POSTS DESTA MARCA (imite o estilo, não copie o conteúdo):\n${b.examples.trim()}`;
  return out ? `IDENTIDADE DA MARCA\n${out}` : '';
}

const COMMON_RULES = `REGRAS GERAIS
- Escreva em português do Brasil, salvo se o briefing estiver em outro idioma.
- NÃO invente fatos, números, estatísticas, datas, nomes ou fontes. Use apenas o que estiver no briefing ou em "FATOS PERMITIDOS". Se um dado seria necessário e não foi fornecido, escreva sem ele.
- Qualquer afirmação factual que você incluir e que o revisor deva conferir antes de publicar deve ser listada em "to_verify" (frases curtas). Se não houver nenhuma, devolva lista vazia.
- Respeite as regras e o tom de voz da marca. Evite clichês de IA ("mergulhe", "desvende", "no mundo de hoje").
- "title" é um nome interno curto para o post (até 60 caracteres), não um slide.
- Máximo de ${MAX_SLIDES} slides.`;

function modeBlock(mode: 'tema' | 'roteiro', slides: number): string {
  if (mode === 'roteiro') {
    return `MODO: ESTRUTURAR ROTEIRO
O briefing é um roteiro já escrito. Preserve o texto e o tom dele; apenas organize em slides. Só reescreva se o roteiro for um esboço em tópicos. Se ele separar os slides (ex.: "Slide 1", "---"), respeite a divisão; senão divida pela ordem natural das ideias.`;
  }
  return `MODO: ESCREVER A PARTIR DE UM TEMA
O briefing é um tema. Escreva o post inteiro com ${slides} slides (pode variar em 1).
- Slide 1: gancho forte (promessa, pergunta ou contradição). Curto.
- Slides do meio: uma ideia por slide, com progressão lógica (do problema à explicação e à solução).
- Último slide: fechamento com a chamada para ação da marca, se houver; senão, uma síntese.
- Prefira frases curtas e concretas. Nada de enchimento.`;
}

const CARROSSEL_FORMAT = `FORMATO: CARROSSEL DE INSTAGRAM
Cada slide tem um "format":
- "cover": capa (sempre o 1º): título forte + gancho curto.
- "text": só texto.
- "text-image": texto curto + uma imagem (gráfico, foto, print).
- "image": só imagem, sem texto.

"html" aceita somente estas tags: <h2> título, <p> parágrafo, <ul class="check"> lista com ✔, <ul class="arrow"> lista com →, <ul class="dot"> lista com marcadores, <li>, <b>, <i>, <u>, <br>. Nenhum outro atributo. Em "image" use html vazio.
Cada slide deve caber na tela: no máximo ~55 palavras. Use <h2> em quase todo slide de texto e listas quando enumerar itens.
"show_more": true em todos os slides, exceto no último (false).
Use "text-image"/"image" só quando um dado, gráfico ou foto ajudar de verdade, e descreva o que entra em "image_note". Caso contrário "image_note" é "".
"topic": o assunto curto do carrossel em caixa normal (ex.: "Dívida pública"), até 40 caracteres.`;

const TWEET_FORMAT = `FORMATO: TWEET CARD
Cada slide é um card branco, estilo post de rede social, com o texto do post (como uma thread).
- "text": texto puro (sem HTML ou markdown), no máximo ~45 palavras. Emojis só se combinarem com a marca.
- "button": texto de um botão de chamada para ação (ex.: "Quero acessar"), ou "" se o slide não tem botão. Use botão apenas no último slide ou quando o roteiro pedir.
- "image_note": se uma imagem, gráfico ou print ajudar neste slide, descreva; senão "".
Não crie métricas de engajamento (curtidas, comentários).`;

function systemPrompt(i: GenerateInput): string {
  return [
    'Você é um redator sênior de conteúdo para redes sociais. Você produz posts prontos para um editor de slides, em JSON estrito.',
    brandBlock(i.brand),
    i.editor === 'carrossel' ? CARROSSEL_FORMAT : TWEET_FORMAT,
    modeBlock(i.mode, i.slidesTarget),
    COMMON_RULES,
  ].filter(Boolean).join('\n\n');
}

function userPrompt(i: GenerateInput): string {
  const parts = [i.mode === 'roteiro' ? `ROTEIRO:\n${i.brief.trim()}` : `TEMA:\n${i.brief.trim()}`];
  if (i.facts.trim()) parts.push(`FATOS PERMITIDOS (use somente estes dados):\n${i.facts.trim()}`);
  if (i.instructions.trim()) parts.push(`INSTRUÇÕES EXTRAS:\n${i.instructions.trim()}`);
  return parts.join('\n\n');
}

/* ---------- esquemas de saída (JSON estruturado) ---------- */
const STR = { type: 'string' } as const;
const CARROSSEL_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['title', 'topic', 'slides', 'to_verify'],
  properties: {
    title: STR, topic: STR, to_verify: { type: 'array', items: STR },
    slides: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['format', 'html', 'show_more', 'image_note'],
        properties: { format: { type: 'string', enum: ['cover', 'text', 'text-image', 'image'] }, html: STR, show_more: { type: 'boolean' }, image_note: STR },
      },
    },
  },
};
const TWEET_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['title', 'slides', 'to_verify'],
  properties: {
    title: STR, to_verify: { type: 'array', items: STR },
    slides: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['text', 'button', 'image_note'], properties: { text: STR, button: STR, image_note: STR } },
    },
  },
};

/* ---------- mapeamento para o formato nativo de cada editor ---------- */
type Mapped = { title: string; topic: string; slides: Record<string, unknown>[]; notes: string[] };

function notesFor(list: any[], toVerify: unknown, imageSlide: (s: any, i: number) => string): string[] {
  const notes: string[] = [];
  list.forEach((s, i) => {
    const n = clean(s?.image_note) || imageSlide(s, i);
    if (n) notes.push(`Slide ${i + 1} · imagem: ${n}`);
  });
  (Array.isArray(toVerify) ? toVerify : []).slice(0, 12).forEach((t) => { if (clean(t, 300)) notes.push(`Conferir: ${clean(t, 300)}`); });
  return notes;
}

function mapCarrossel(data: any): Mapped {
  const formats = new Set(['cover', 'text', 'text-image', 'image']);
  const list = (Array.isArray(data?.slides) ? data.slides : []).slice(0, MAX_SLIDES);
  const slides = list.map((s: any) => {
    const format = formats.has(s?.format) ? s.format : 'text';
    return { format, html: format === 'image' ? '' : sanitizeHtml(String(s?.html ?? '')), image: null, fit: 'cover', showProfile: true, showMore: s?.show_more !== false };
  });
  return {
    title: clean(data?.title, 80), topic: clean(data?.topic, 60), slides,
    notes: notesFor(list, data?.to_verify, (s, i) => (slides[i].format.includes('image') ? 'insira a imagem deste slide' : '')),
  };
}

function mapTweet(data: any): Mapped {
  const list = (Array.isArray(data?.slides) ? data.slides : []).slice(0, MAX_SLIDES);
  const slides = list.map((s: any) => {
    const button = clean(s?.button, 60);
    return {
      text: clean(s?.text, 1200), showButton: !!button, button: button || 'Quero acessar',
      showImage: !!clean(s?.image_note), image: null,
      showMetrics: false, // sem números de engajamento inventados
    };
  });
  return { title: clean(data?.title, 80), topic: '', slides, notes: notesFor(list, data?.to_verify, () => '') };
}

const EDITORS = {
  carrossel: { schema: CARROSSEL_SCHEMA, map: mapCarrossel },
  tweet: { schema: TWEET_SCHEMA, map: mapTweet },
} as const;

export const supportsAi = (editor: string): editor is keyof typeof EDITORS => editor in EDITORS;

/** Gera um post: chama o Claude e devolve os slides no formato do editor. */
export async function generatePost(input: GenerateInput): Promise<GenerateResult> {
  if (process.env.AI_MOCK === '1') return mockPost(input); // só para desenvolver sem gastar com a API
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError('ANTHROPIC_API_KEY não configurada no servidor.');
  const cfg = EDITORS[input.editor];
  const client = new Anthropic();

  let response;
  try {
    response = await client.beta.messages.create({
      model: AI_MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: systemPrompt(input),
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: cfg.schema } },
      messages: [{ role: 'user', content: userPrompt(input) }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Limite de uso da IA atingido. Tente novamente em instantes.', true);
    if (e instanceof Anthropic.AuthenticationError) throw new AiError('Chave da Anthropic inválida no servidor.');
    if (e instanceof Anthropic.APIError) throw new AiError(`Erro da IA (${e.status}).`, (e.status ?? 500) >= 500);
    throw new AiError('Não foi possível falar com a IA.', true);
  }

  const usage = { inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 };
  if (response.stop_reason === 'refusal') throw new AiError('A IA recusou gerar este conteúdo.');
  if (response.stop_reason === 'max_tokens') throw new AiError('A resposta ficou grande demais. Reduza o número de slides.');

  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '';
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new AiError('A IA devolveu uma resposta inválida.', true); }

  const mapped = cfg.map(data);
  if (!mapped.slides.length) throw new AiError('A IA não devolveu nenhum slide.', true);
  return { ...mapped, ...usage };
}


/** Resposta simulada (AI_MOCK=1), no mesmo formato da real. */
async function mockPost(i: GenerateInput): Promise<GenerateResult> {
  await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
  if (/erro/i.test(i.brief)) throw new AiError('Erro simulado (o tema continha "erro").');
  const n = Math.min(i.slidesTarget, 5);
  const topic = i.brief.split('\n')[0].slice(0, 40);
  const raw = {
    title: i.brief.slice(0, 50), topic, to_verify: ['Confira os dados citados antes de publicar.'],
    slides: Array.from({ length: n }, (_, k) =>
      i.editor === 'carrossel'
        ? { format: k === 0 ? 'cover' : k === 2 ? 'text-image' : 'text', html: `<h2>${k === 0 ? topic : `Ponto ${k}`}</h2><p>Texto de exemplo do slide ${k + 1}.</p><script>x</script>`, show_more: k < n - 1, image_note: k === 2 ? 'gráfico comparando os dois cenários' : '' }
        : { text: `Slide ${k + 1} sobre ${topic}.`, button: k === n - 1 ? 'Quero saber mais' : '', image_note: '' }),
  };
  const mapped = EDITORS[i.editor].map(raw);
  return { ...mapped, inputTokens: 1800, outputTokens: 2400 };
}
