import Anthropic from '@anthropic-ai/sdk';
import { MAX_SLIDES } from './constants';
import { CAROUSEL_ANGLES, CAROUSEL_CRAFT, IDEA_TO_SLIDES, planBlock, reviewCarousel, slidesRule } from './carousel-rules';

/** Modelo escolhido para a geração (maior qualidade de copy). */
export const AI_MODEL = 'claude-opus-5-5';
/** Modelo das tarefas curtas (descrição de imagem, legenda sob demanda): bem mais barato, qualidade equivalente nelas. */
export const AI_LIGHT_MODEL = process.env.AI_LIGHT_MODEL || 'claude-sonnet-5-5';
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
  /** Regras das legendas (hashtags fixas, rodapé, tamanho…). */
  captionRules?: string;
  /** O que a organização faz: oferta, proposta de valor e temas em que quer ser autoridade. */
  about?: string;
};

export type GenerateInput = {
  editor: 'carrossel' | 'tweet' | 'noticia';
  mode: 'tema' | 'roteiro' | 'ideia';
  brief: string;
  slidesTarget: number;
  facts: string;
  instructions: string;
  /** O usuário vai gerar as imagens dos slides (Nano Banana). */
  withImages?: boolean;
  /** Ângulo narrativo do carrossel (id de CAROUSEL_ANGLES); vazio ou "auto" = a IA escolhe. */
  angle?: string;
  /** Roteiro dos slides aprovado pelo usuário (a escrita segue fielmente). */
  plan?: { angle?: string; promise?: string; slides: { role: string; message: string }[] } | null;
  brand: BrandProfile;
};

export type GenerateResult = {
  title: string;
  topic: string;
  /** Legenda pronta para publicar junto com o post. */
  caption: string;
  /** Alternativas de título de capa (carrossel). */
  coverOptions: string[];
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
    // o que sobrou de "<" é texto solto ou uma tag que não fechou: vira texto, para nunca "abrir" uma tag com o HTML que vem depois
    .replace(new RegExp(`<(?!/?(?:${[...ALLOWED_TAGS].join('|')})(?: class="[a-z]+")?>)`, 'gi'), '&lt;');
}

const clean = (s: unknown, max = 400) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

/* ---------- instruções ---------- */
export function brandBlock(b: BrandProfile): string {
  const lines = [
    ['Marca', b.brandName], ['O que a organização faz', b.about ?? ''], ['Nicho', b.niche], ['Público', b.audience], ['Tom de voz', b.voice],
    ['Regras (o que sempre/nunca fazer)', b.rules], ['Chamada para ação (CTA) padrão', b.cta], ['Regras das legendas', b.captionRules ?? ''],
  ].filter(([, v]) => v.trim());
  let out = lines.map(([k, v]) => `- ${k}: ${v.trim()}`).join('\n');
  if (b.examples.trim()) out += `\n\nEXEMPLOS DE POSTS DESTA MARCA (imite o estilo, não copie o conteúdo):\n${b.examples.trim()}`;
  return out ? `IDENTIDADE DA MARCA\n${out}` : '';
}

const CAPTION_BASE = `LEGENDA ("caption")
Escreva também a legenda para publicar junto com o post (padrão: Instagram):
- 1ª linha: um gancho curto que mostra o que a pessoa ganha ao ler.
- 2 a 4 parágrafos curtos que COMPLEMENTAM os slides (não os repita), terminando com a chamada para ação da marca, se houver.
- Hashtags no fim: siga as "Regras das legendas" da marca; se não houver, use 3 a 5 relevantes.
- No máximo ~900 caracteres. Não invente fatos, números ou fontes.`;

const CAPTION_CARROSSEL = `LEGENDA ("caption")
Escreva também a legenda para publicar junto com o carrossel (padrão: Instagram):
- Ela COMPLEMENTA os slides, não os repete. 1ª linha: um gancho DIFERENTE do título da capa (outro ângulo da mesma promessa) que, sozinho, já justifica abrir o "ver mais".
- 2 ou 3 parágrafos curtos (uma ou duas frases cada) com uma ideia nova ou um exemplo que não está nos slides.
- Fecho: UMA chamada à ação (uma ação só, sem somar "mande para alguém" com "fale com a gente"), a mesma do último slide (quando o post nasce de uma ideia, a CTA da ideia, com o mesmo destinatário), dita de outro jeito e só com o que a organização realmente oferece. "Salve" ou "mande para quem…" só se combinarem com essa ação; nada de "siga a página" se a ideia não pediu.
- Hashtags no fim: siga as "Regras das legendas" da marca; se não houver, use 3 a 5 relevantes.
- No máximo ~900 caracteres. Não invente fatos, números ou fontes.`;

/** Vícios de texto de IA que valem para carrossel, roteiro e artigo (vistos nos testes reais). */
export const STYLE_TICS = `VÍCIOS DE TEXTO DE IA (evite; o leitor percebe na hora)
- "Não é X, é Y" e variações ("O problema não é X, é Y", "Não é falta de X. É falta de Y", "não foi X, foi Y"): no máximo UMA vez na peça inteira (corpo e legenda juntos), no momento da virada. Nas outras vezes, afirme o Y direto.
- Frases feitas: "muda tudo", "mudou tudo", "faz toda a diferença", "a boa notícia é que", "ninguém nasce sabendo", "o empurrão que faltava", "encurtar o caminho/a estrada", "sair da zona de conforto", "e aqui está o nó", "no fim das contas", "mais do que nunca".
- Não fale sobre o próprio texto nem sobre a estrutura dele ("são três razões", "cada uma de pé sozinha", "este post vai mostrar", "neste carrossel"). Mostre.
- Isso inclui descrever as partes da solução como "peças", "frentes", "pilares" ou dizer que elas são independentes ou que "cada uma faz sentido sozinha".
- Não copie frases dos campos do briefing ao pé da letra ("ver o bastão passado", "orgulho de se firmar", "responsabilidade de uns com os outros"): diga a mesma coisa com as palavras de quem lê, numa cena ou num fato.
- Personagem: o mesmo do começo ao fim (mesmo gênero, mesma idade, mesma situação). Se abriu com "uma jovem", não vira "ele" depois.
- O QUE A ORGANIZAÇÃO FAZ: só afirme que a marca faz algo se isso estiver em "O que a organização faz" ou no material-fonte. Os argumentos de uma ideia são a PROPOSTA (o que funciona), não um relatório do que a organização já faz: mostre-os como o que acontece quando existe aquele apoio ("quando o jovem tem um mentor de fora, ele liga antes de desistir"), sem "Na [marca], o jovem faz X" com detalhes que não foram confirmados (série escolar, frequência, formato).
- Não use os nomes internos do briefing: o nome da persona é um perfil de planejamento, não uma pessoa real nem um personagem (nunca escreva "Shelton" ou o nome que vier no perfil; fale com "você" ou crie um personagem genérico). Também não escreva "dor", "ganho", "desejo", "argumento", "guia" ou "enquadramento" como rótulos.`;

const COMMON_RULES = `REGRAS GERAIS
- Escreva em português do Brasil, salvo se o briefing estiver em outro idioma.
- NÃO invente fatos, números, estatísticas, datas, nomes ou fontes. Use apenas o que estiver no briefing ou em "FATOS PERMITIDOS". Se um dado seria necessário e não foi fornecido, escreva sem ele.
- Qualquer afirmação factual que você incluir e que o revisor deva conferir antes de publicar deve ser listada em "to_verify" (frases curtas). Se não houver nenhuma, devolva lista vazia.
- Respeite as regras e o tom de voz da marca. Evite clichês de IA ("mergulhe", "desvende", "no mundo de hoje").
- "title" é um nome interno curto para o post (até 60 caracteres), não um slide.
- Máximo de ${MAX_SLIDES} slides.`;

function modeBlock(mode: 'tema' | 'roteiro' | 'ideia', slides: number, editor: 'carrossel' | 'tweet' | 'noticia', angle?: string): string {
  if (mode === 'roteiro') {
    return `MODO: ESTRUTURAR ROTEIRO
O briefing é um roteiro já escrito. Preserve o texto e o tom dele; apenas organize em slides. Só reescreva se o roteiro for um esboço em tópicos. Se ele separar os slides (ex.: "Slide 1", "---"), respeite a divisão; senão divida pela ordem natural das ideias.`;
  }
  if (mode === 'ideia') {
    const ang = CAROUSEL_ANGLES.find((a) => a.id === angle && a.id !== 'auto');
    const angleText = editor !== 'carrossel' ? '' : ang
      ? `\n\nÂNGULO NARRATIVO ESCOLHIDO (siga):\n${ang.guide}`
      : `\n\nÂNGULO NARRATIVO: escolha o que melhor serve a esta ideia e registre em "strategy.angle". Opções: ${CAROUSEL_ANGLES.filter((a) => a.id !== 'auto').map((a) => `${a.id} (${a.label})`).join(', ')}.`;
    return `MODO: CRIAR A PARTIR DE UMA IDEIA ESTRUTURADA
O briefing é uma ideia de conteúdo com campos (dor, impacto, causa, guia, argumentos, ganho, desejo e CTA). Crie o post inteiro a partir dela. ${slidesRule(slides)}

${IDEA_TO_SLIDES}${angleText}`;
  }
  return `MODO: ESCREVER A PARTIR DE UM TEMA
O briefing é um tema. Escreva o post inteiro. ${slidesRule(slides)}
- Slide 1: gancho forte (promessa, pergunta ou contradição). Curto.
- Slides do meio: uma ideia por slide, com progressão lógica (do problema à explicação e à solução).
- Último slide: fechamento com a chamada para ação da marca, se houver; senão, uma síntese.
- Prefira frases curtas e concretas. Nada de enchimento.`;
}

const CARROSSEL_FORMAT = `FORMATO: CARROSSEL DE INSTAGRAM
Cada slide tem um "format":
- "cover": capa (sempre o 1º): título forte + uma linha de apoio curta.
- "text": só texto.
- "text-image": texto curto + uma imagem (gráfico, foto, print).
- "image": só imagem, sem texto.
- "destaque": UMA frase de impacto em fonte grande, em <h2> (até 14 palavras), sem <p>. Para os momentos de virada.
- "pergunta": uma pergunta direta à persona, em <h2> (até 14 palavras), sem <p>. Para espelhar quem lê.

"html" aceita somente estas tags: <h2> título, <p> parágrafo, <ul class="check"> lista com ✔, <ul class="arrow"> lista com →, <ul class="dot"> lista com marcadores, <li>, <b>, <i>, <u>, <br>. Nenhum outro atributo. Em "image" use html vazio.
Tamanho: de 15 a 28 palavras por slide de texto (nunca mais de 35; ~20 quando for "text-image"). Use <h2> em quase todo slide de texto e listas só para enumerar 3 itens curtos.
"show_more": true em todos os slides, exceto no último (false).
Use "text-image"/"image" só quando um dado, gráfico ou foto ajudar de verdade, e descreva o que entra em "image_note". Caso contrário "image_note" é "".
"topic": o assunto curto do carrossel em caixa normal (ex.: "Dívida pública"), até 40 caracteres.
"strategy": ANTES de escrever os slides, defina: o ângulo; o leitor ("reader": com quem os slides falam e o que essa pessoa precisa sentir ou fazer); a promessa (o que a pessoa leva ao terminar); a tensão (a pergunta CONCRETA que mantém a pessoa virando os slides, não um tease); a ação final ("cta": a ação do último slide, tirada da CTA da ideia quando houver); e a estrutura (uma linha por slide: "formato · função · mensagem · leve|denso"; denso = parágrafo com mais de ~25 palavras; nunca dois "denso" seguidos). Os slides seguem essa estrutura.
Ordem de escrita: estratégia, slides, depois as capas alternativas e a legenda (que complementam os slides prontos).`;

const TWEET_FORMAT = `FORMATO: TWEET CARD
Cada slide é um card branco, estilo post de rede social, com o texto do post (como uma thread).
- "text": texto puro (sem HTML ou markdown). O card tem espaço limitado: no máximo ~38 palavras quando o slide é só texto, e no máximo ~22 palavras quando o slide também tem imagem ("image_note") ou botão. Emojis só se combinarem com a marca.
- "button": texto de um botão de chamada para ação (ex.: "Quero acessar"), ou "" se o slide não tem botão. Use botão apenas no último slide ou quando o roteiro pedir.
- "image_note": se uma imagem, gráfico ou print ajudar neste slide, descreva; senão "".
Não crie métricas de engajamento (curtidas, comentários).`;

const NOTICIA_FORMAT = `FORMATO: CAPA DE NOTÍCIA (posts de notícia em imagens 1080×1350)
Cada slide tem um "format":
- "capa": foto em tela cheia com degradê; etiqueta + título + texto de destaque. Sempre o 1º slide.
- "texto": fundo liso; etiqueta, título e um parágrafo de corpo de notícia (até ~55 palavras).
- "foto-texto": foto na metade de cima e texto embaixo; título curto + legenda (até ~30 palavras).
- "citacao": frase em destaque. "text" é a frase entre aspas (até ~28 palavras) e "title" é quem disse (nome · cargo). Use SOMENTE se o briefing trouxer a declaração literal.
- "numero": um dado em destaque. "title" é só o número (ex.: "81,9%") e "text" explica em uma frase. Use apenas números que estejam no briefing ou nos FATOS PERMITIDOS.
- "imagem": só foto, com legenda opcional em "text" (até ~15 palavras).
- "cta": chamada final (último slide). "title" é a chamada e "text" a frase de apoio; use o CTA da marca, se houver.

Campos de cada slide: "tag" (etiqueta curta em caixa alta, ex.: "ECONOMIA"; use a mesma editoria no post inteiro, ou "" se não fizer sentido), "title", "text" e "image_note".
Tom jornalístico: claro, objetivo e sem sensacionalismo; títulos informativos; sem opinião. A capa abre com o fato mais importante; os slides do meio desenvolvem (o que aconteceu, quem, por quê, impacto); "numero" e "citacao" só quando o briefing tiver o dado ou a declaração.
"image_note": nos slides "capa", "foto-texto" e "imagem" descreva em poucas palavras a foto ideal (obrigatório nesses três); nos demais, "".`;

const IMAGES_NOTICIA = `IMAGENS ATIVADAS
O usuário vai gerar as fotos dos slides com IA. "capa", "foto-texto" e "imagem" têm espaço de foto: em "image_note" descreva uma cena fotojornalística que reforce a notícia (sem texto, sem números, sem logotipos e sem pessoas reais identificáveis). Se o roteiro trouxe uma instrução de imagem, copie-a fielmente.`;

const IMAGES_CARROSSEL = `IMAGENS ATIVADAS
O usuário vai gerar as imagens dos slides com IA. A capa já tem espaço de imagem. Use "text-image" (ou "image") em até 3 slides do meio em que uma imagem de apoio realmente reforça a mensagem.
Em "image_note": se o roteiro trouxe uma instrução de imagem para o slide, copie-a fielmente (uma direção de arte vai melhorá-la depois); se não trouxe, escreva uma intenção curta baseada no conteúdo do slide. Nunca peça texto, números ou gráficos com dados dentro da imagem.`;

const IMAGES_TWEET = `IMAGENS ATIVADAS
O usuário vai gerar as imagens dos slides com IA. Preencha "image_note" no slide 1 e em até 2 outros slides em que uma imagem de apoio reforça a mensagem; nos demais, "".
Se o roteiro trouxe uma instrução de imagem para o slide, copie-a fielmente (uma direção de arte vai melhorá-la depois); se não trouxe, escreva uma intenção curta baseada no conteúdo do slide. Nunca peça texto, números ou gráficos com dados dentro da imagem.`;

function systemPrompt(i: GenerateInput): string {
  return [
    'Você é um redator sênior de conteúdo para redes sociais. Você produz posts prontos para um editor de slides, em JSON estrito.',
    brandBlock(i.brand),
    i.editor === 'carrossel' ? CARROSSEL_FORMAT : i.editor === 'noticia' ? NOTICIA_FORMAT : TWEET_FORMAT,
    i.editor === 'carrossel' ? CAROUSEL_CRAFT : '',
    modeBlock(i.mode, i.slidesTarget, i.editor, i.angle),
    i.withImages ? (i.editor === 'carrossel' ? IMAGES_CARROSSEL : i.editor === 'noticia' ? IMAGES_NOTICIA : IMAGES_TWEET) : '',
    i.editor === 'carrossel' ? CAPTION_CARROSSEL : CAPTION_BASE,
    COMMON_RULES,
    STYLE_TICS,
  ].filter(Boolean).join('\n\n');
}

function userPrompt(i: GenerateInput): string {
  const parts = [i.mode === 'roteiro' ? `ROTEIRO:\n${i.brief.trim()}` : i.mode === 'ideia' ? `IDEIA:\n${i.brief.trim()}` : `TEMA:\n${i.brief.trim()}`];
  if (i.plan?.slides?.length) parts.push(planBlock(i.plan));
  if (i.facts.trim()) parts.push(`FATOS PERMITIDOS (use somente estes dados):\n${i.facts.trim()}`);
  if (i.instructions.trim()) parts.push(`INSTRUÇÕES EXTRAS:\n${i.instructions.trim()}`);
  return parts.join('\n\n');
}

/* ---------- esquemas de saída (JSON estruturado) ---------- */
const STR = { type: 'string' } as const;
const CAROUSEL_FORMATS = ['cover', 'text', 'text-image', 'image', 'destaque', 'pergunta'] as const;
const CARROSSEL_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['strategy', 'title', 'topic', 'slides', 'cover_options', 'caption', 'to_verify'],
  properties: {
    // a estratégia vem primeiro: a IA planeja o fio do carrossel antes de escrever os slides
    strategy: {
      type: 'object', additionalProperties: false, required: ['angle', 'reader', 'promise', 'tension', 'cta', 'structure'],
      properties: { angle: STR, reader: STR, promise: STR, tension: STR, cta: STR, structure: { type: 'array', items: STR } },
    },
    title: STR, topic: STR,
    // os slides vêm antes das capas alternativas e da legenda: elas são escritas olhando os slides prontos
    slides: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['role', 'format', 'html', 'show_more', 'image_note'],
        properties: { role: STR, format: { type: 'string', enum: [...CAROUSEL_FORMATS] }, html: STR, show_more: { type: 'boolean' }, image_note: STR },
      },
    },
    cover_options: { type: 'array', items: STR }, caption: STR, to_verify: { type: 'array', items: STR },
  },
};
const TWEET_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['title', 'slides', 'to_verify', 'caption'],
  properties: {
    title: STR, caption: STR, to_verify: { type: 'array', items: STR },
    slides: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['text', 'button', 'image_note'], properties: { text: STR, button: STR, image_note: STR } },
    },
  },
};

const NOTICIA_FORMATS = ['capa', 'texto', 'foto-texto', 'citacao', 'numero', 'imagem', 'cta'] as const;
const NOTICIA_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['title', 'slides', 'to_verify', 'caption'],
  properties: {
    title: STR, caption: STR, to_verify: { type: 'array', items: STR },
    slides: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['format', 'tag', 'title', 'text', 'image_note'],
        properties: { format: { type: 'string', enum: [...NOTICIA_FORMATS] }, tag: STR, title: STR, text: STR, image_note: STR },
      },
    },
  },
};

/* ---------- mapeamento para o formato nativo de cada editor ---------- */
type Mapped = { title: string; topic: string; caption: string; slides: Record<string, unknown>[]; notes: string[]; coverOptions?: string[] };

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
  const formats = new Set<string>(CAROUSEL_FORMATS);
  const list = (Array.isArray(data?.slides) ? data.slides : []).slice(0, MAX_SLIDES);
  const slides = list.map((s: any) => {
    const format = formats.has(s?.format) ? s.format : 'text';
    return { format, html: format === 'image' ? '' : sanitizeHtml(String(s?.html ?? '')), image: null, imagePrompt: clean(s?.image_note), fit: 'cover', showProfile: true, showMore: s?.show_more !== false };
  });
  const notes = notesFor(list, data?.to_verify, (s, i) => (slides[i].format.includes('image') ? 'insira a imagem deste slide' : ''));
  const st = data?.strategy;
  if (clean(st?.angle, 60)) notes.unshift(`Ângulo: ${clean(st.angle, 60)}${clean(st?.promise, 200) ? ` · promessa: ${clean(st.promise, 200)}` : ''}`);
  // checagem de craft: avisa o que passou do ponto (o editor mostra a revisão completa)
  const warn = reviewCarousel(slides.map((s: any) => ({ format: s.format, html: s.html }))).filter((r) => !r.ok && r.slides.length);
  warn.forEach((r) => notes.push(`Revisão: ${r.label.toLowerCase()} (${r.detail.toLowerCase()})`));
  return {
    title: clean(data?.title, 80), topic: clean(data?.topic, 60), caption: clean(data?.caption, 2200), slides, notes,
    coverOptions: (Array.isArray(data?.cover_options) ? data.cover_options : []).map((c: unknown) => clean(c, 120)).filter(Boolean).slice(0, 3),
  };
}

function mapTweet(data: any): Mapped {
  const list = (Array.isArray(data?.slides) ? data.slides : []).slice(0, MAX_SLIDES);
  const slides = list.map((s: any) => {
    const button = clean(s?.button, 60);
    return {
      text: clean(s?.text, 1200), showButton: !!button, button: button || 'Quero acessar',
      showImage: !!clean(s?.image_note), image: null, imagePrompt: clean(s?.image_note),
      showMetrics: false, // sem números de engajamento inventados
    };
  });
  return { title: clean(data?.title, 80), topic: '', caption: clean(data?.caption, 2200), slides, notes: notesFor(list, data?.to_verify, () => '') };
}

const NOTICIA_FADE: Record<string, number> = { capa: 60, texto: 0, 'foto-texto': 0, citacao: 80, numero: 80, imagem: 35, cta: 85 };
const NOTICIA_PHOTO = new Set(['capa', 'foto-texto', 'imagem']);

function mapNoticia(data: any): Mapped {
  const list = (Array.isArray(data?.slides) ? data.slides : []).slice(0, MAX_SLIDES);
  const slides = list.map((s: any, i: number) => {
    const format = (NOTICIA_FORMATS as readonly string[]).includes(s?.format) ? String(s.format) : i === 0 ? 'capa' : 'texto';
    const tag = clean(s?.tag, 40).toUpperCase();
    return {
      format, tag, showTag: !!tag, title: clean(s?.title, 160), text: clean(s?.text, format === 'texto' ? 700 : 450),
      size: '62', fade: NOTICIA_FADE[format] ?? 60, showBadge: true, badgeSize: 160, showImage: true, image: null, fit: 'cover', ratio: '4/5', imagePrompt: clean(s?.image_note),
    };
  });
  return {
    title: clean(data?.title, 80), topic: '', caption: clean(data?.caption, 2200), slides,
    notes: notesFor(list, data?.to_verify, (_s, i) => (NOTICIA_PHOTO.has(String(slides[i].format)) ? 'insira a foto deste slide' : '')),
  };
}

const EDITORS = {
  carrossel: { schema: CARROSSEL_SCHEMA, map: mapCarrossel },
  noticia: { schema: NOTICIA_SCHEMA, map: mapNoticia },
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
      // o prompt de sistema se repete em todos os posts de um lote: cache de prompt (leitura custa ~10%)
      system: [{ type: 'text', text: systemPrompt(input), cache_control: { type: 'ephemeral' } }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: cfg.schema } },
      messages: [{ role: 'user', content: userPrompt(input) }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Limite de uso da IA atingido. Tente novamente em instantes.', true);
    if (e instanceof Anthropic.AuthenticationError) throw new AiError('Chave da Anthropic inválida no servidor.');
    if (e instanceof Anthropic.APIError) throw new AiError(`Erro da IA (${e.status}).`, (e.status ?? 500) >= 500);
    throw new AiError('Não foi possível falar com a IA.', true);
  }

  const u = response.usage as { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null } | undefined;
  // tokens de entrada "equivalentes" ao preço normal: escrita no cache custa 1,25x e leitura 0,1x
  const usage = {
    inputTokens: Math.round((u?.input_tokens ?? 0) + (u?.cache_creation_input_tokens ?? 0) * 1.25 + (u?.cache_read_input_tokens ?? 0) * 0.1),
    outputTokens: u?.output_tokens ?? 0,
  };
  if (response.stop_reason === 'refusal') throw new AiError('A IA recusou gerar este conteúdo.');
  if (response.stop_reason === 'max_tokens') throw new AiError('A resposta ficou grande demais. Reduza o número de slides.');

  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '';
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new AiError('A IA devolveu uma resposta inválida.', true); }

  const mapped = cfg.map(data);
  if (!mapped.slides.length) throw new AiError('A IA não devolveu nenhum slide.', true);
  return { ...mapped, coverOptions: mapped.coverOptions ?? [], ...usage };
}


/** Resposta simulada (AI_MOCK=1), no mesmo formato da real. */
async function mockPost(i: GenerateInput): Promise<GenerateResult> {
  await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
  if (/erro/i.test(i.brief)) throw new AiError('Erro simulado (o tema continha "erro").');
  const n = Math.min(i.slidesTarget, 5);
  const topic = i.brief.split('\n')[0].slice(0, 40);
  const raw = {
    title: i.brief.slice(0, 50), topic, caption: `Legenda de exemplo sobre ${topic}.\n\nSiga para mais. #exemplo`, to_verify: ['Confira os dados citados antes de publicar.'],
    strategy: { angle: i.angle && i.angle !== 'auto' ? i.angle : 'crenca', promise: 'Promessa de exemplo', tension: 'Tensão de exemplo', structure: [] },
    cover_options: ['Capa alternativa em tensão', 'Capa alternativa em pergunta?', 'Capa alternativa em promessa'],
    slides: Array.from({ length: n }, (_, k) =>
      i.editor === 'noticia'
        ? { format: k === 0 ? 'capa' : k === n - 1 ? 'cta' : k === 2 ? 'foto-texto' : 'texto', tag: 'ECONOMIA', title: k === 0 ? topic.toUpperCase() : `Ponto ${k}`, text: `Texto de exemplo do slide ${k + 1}.`, image_note: k === 0 || k === 2 ? 'foto de apoio' : '' }
        : i.editor === 'carrossel'
        ? { format: k === 0 ? 'cover' : k === 2 ? 'text-image' : k === 1 ? 'destaque' : 'text', html: `<h2>${k === 0 ? topic : `Ponto ${k}`}</h2><p>Texto de exemplo do slide ${k + 1}.</p><script>x</script>`, show_more: k < n - 1, image_note: k === 2 ? 'gráfico comparando os dois cenários' : '' }
        : { text: `Slide ${k + 1} sobre ${topic}.`, button: k === n - 1 ? 'Quero saber mais' : '', image_note: '' }),
  };
  const mapped = EDITORS[i.editor].map(raw);
  return { ...mapped, coverOptions: mapped.coverOptions ?? [], inputTokens: 1800, outputTokens: 2400 };
}
