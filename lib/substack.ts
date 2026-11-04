/** Artigos para o Substack: tipos, ângulos, Markdown seguro e revisão do especialista (servidor e navegador). */

export type ArticleStatus = 'draft' | 'reviewed' | 'published';
export const ARTICLE_STATUS: { id: ArticleStatus; label: string; color: string }[] = [
  { id: 'draft', label: 'Rascunho', color: '#8A857A' },
  { id: 'reviewed', label: 'Revisado', color: '#1D9BF0' },
  { id: 'published', label: 'Publicado', color: '#1F9D63' },
];
export const normStatus = (s: string): ArticleStatus => (ARTICLE_STATUS.some((x) => x.id === s) ? (s as ArticleStatus) : 'draft');

/** Dados de publicação que acompanham o texto. */
export type ArticleMeta = { emailSubject: string; previewText: string; seoDescription: string; tags: string[]; notes: string[]; toVerify: string[] };
export const EMPTY_META: ArticleMeta = { emailSubject: '', previewText: '', seoDescription: '', tags: [], notes: [], toVerify: [] };

export const ARTICLE_ANGLES = [
  { id: 'auto', label: 'A IA escolhe', hint: 'O melhor formato para esta ideia.', guide: '' },
  { id: 'ensaio', label: 'Ensaio', hint: 'Uma tese defendida com calma.', guide: 'ENSAIO: abra com uma observação ou cena que provoque; defenda UMA tese ao longo do texto, com exemplos concretos; reconheça a objeção mais forte e responda a ela; feche retomando a abertura.' },
  { id: 'historia', label: 'História', hint: 'Uma cena que carrega a ideia.', guide: 'HISTÓRIA: conte uma situação de uma pessoa com o perfil da persona (use "uma mulher", "um rapaz" sem inventar nome real nem fatos verificáveis; deixe claro que é um retrato) e só depois abra o assunto. A ideia aparece pelo que acontece, não por explicação.' },
  { id: 'guia', label: 'Guia prático', hint: 'Passos que a pessoa aplica.', guide: 'GUIA PRÁTICO: prometa um resultado claro no começo; organize em passos ou blocos numerados com um título forte cada; cada bloco traz o que fazer e um exemplo; termine com o próximo passo mais simples.' },
  { id: 'opiniao', label: 'Opinião', hint: 'Um ponto de vista com coragem.', guide: 'OPINIÃO: abra com a posição em uma frase; explique por que o senso comum falha; dê 2 ou 3 razões, cada uma com um exemplo; assuma o custo da posição; termine convidando à conversa.' },
  { id: 'carta', label: 'Carta', hint: 'Íntimo, direto a uma pessoa.', guide: 'CARTA: escreva diretamente para a persona, em segunda pessoa ("você"), com tom de quem conversa à mesa; um assunto só; frases curtas e calor humano; assine com a voz da marca.' },
] as const;
export type ArticleAngleId = (typeof ARTICLE_ANGLES)[number]['id'];
export const isArticleAngle = (v: unknown): v is ArticleAngleId => ARTICLE_ANGLES.some((a) => a.id === v);

export const ARTICLE_LENGTHS = [
  { id: 'curto', label: 'Curto', words: 650, minutes: 3, hint: 'Cerca de 3 min de leitura' },
  { id: 'medio', label: 'Médio', words: 1200, minutes: 6, hint: 'Cerca de 6 min de leitura' },
  { id: 'longo', label: 'Longo', words: 2000, minutes: 10, hint: 'Cerca de 10 min de leitura' },
] as const;
export type ArticleLengthId = (typeof ARTICLE_LENGTHS)[number]['id'];
export const lengthOf = (id: unknown) => ARTICLE_LENGTHS.find((l) => l.id === id) ?? ARTICLE_LENGTHS[1];

export const ESTIMATED_COST_ARTICLE = 0.12;
export const ESTIMATED_COST_OUTLINE = 0.03;
export const MAX_SOURCE_CHARS = 20000;
export const MAX_BODY_CHARS = 40000;

export type OutlineSection = { heading: string; point: string };
export type ArticlePlan = { angle: string; titles: string[]; subtitle: string; hook: string; sections: OutlineSection[] };

/* ---------------- métricas ---------------- */
export const countWords = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
export const readMinutes = (words: number) => Math.max(1, Math.round(words / 220));

/* ---------------- Markdown → HTML (escapa tudo antes) ---------------- */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const safeUrl = (u: string) => (/^(https?:\/\/|mailto:)/i.test(u.trim()) ? u.trim() : '');

function inline(raw: string): string {
  let s = esc(raw);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t: string, u: string) => { const url = safeUrl(u.replace(/&amp;/g, '&')); return url ? `<a href="${esc(url)}">${t}</a>` : t; });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s;
}

/** Markdown simples (títulos, citação, listas, divisor, negrito, itálico, links) para HTML seguro. */
export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r/g, '').split('\n');
  const out: string[] = [];
  let para: string[] = [], list: { tag: 'ul' | 'ol'; items: string[] } | null = null, quote: string[] = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; } };
  const flushQuote = () => { if (quote.length) { out.push(`<blockquote>${quote.map((q) => `<p>${inline(q)}</p>`).join('')}</blockquote>`); quote = []; } };
  const flush = () => { flushPara(); flushList(); flushQuote(); };
  for (const line of lines) {
    const t = line.trim();
    let m: RegExpMatchArray | null;
    if (!t) { flush(); continue; }
    if ((m = t.match(/^(#{1,3})\s+(.+)$/))) { flush(); const lv = Math.max(2, m[1].length); out.push(`<h${lv}>${inline(m[2])}</h${lv}>`); continue; }
    if (/^(-{3,}|\*{3,})$/.test(t)) { flush(); out.push('<hr>'); continue; }
    if ((m = t.match(/^>\s?(.*)$/))) { flushPara(); flushList(); quote.push(m[1]); continue; }
    if ((m = t.match(/^[-*•]\s+(.+)$/))) { flushPara(); flushQuote(); if (!list || list.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] }; } list.items.push(m[1]); continue; }
    if ((m = t.match(/^\d+[.)]\s+(.+)$/))) { flushPara(); flushQuote(); if (!list || list.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] }; } list.items.push(m[1]); continue; }
    flushList(); flushQuote(); para.push(t);
  }
  flush();
  return out.join('\n');
}

/** Texto puro (sem marcações) para contar palavras e conferir trechos. */
export function plainText(md: string): string {
  return md.replace(/^#{1,3}\s+/gm, '').replace(/^>\s?/gm, '').replace(/^[-*•]\s+/gm, '').replace(/^\d+[.)]\s+/gm, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').replace(/^(-{3,}|\*{3,})$/gm, '');
}

/* ---------------- revisão do especialista ---------------- */
export type ReviewItem = { ok: boolean; label: string; detail: string };
const ACTION = /\b(assin\w+|compartilh\w+|respond\w+|respondam|mand\w+|envi\w+|coment\w+|conte|conta|escrev\w+|encaminh\w+|salv\w+|apoi\w+|particip\w+|conhe[cç]\w+|volte|fale|procur\w+|comece\w*|experiment\w+|tent\w+)\b/i;

export function reviewArticle(a: { title: string; subtitle: string; body: string }): ReviewItem[] {
  const words = countWords(plainText(a.body));
  const paras = a.body.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p && !/^#{1,3}\s/.test(p) && !/^(-{3,}|\*{3,})$/.test(p));
  const first = paras[0] ? countWords(plainText(paras[0])) : 0;
  const heads = (a.body.match(/^#{2,3}\s+/gm) ?? []).length;
  const longest = paras.reduce((m, p) => Math.max(m, countWords(plainText(p))), 0);
  const last = paras[paras.length - 1] ?? '';
  const tl = a.title.trim().length;
  const items: ReviewItem[] = [
    { ok: tl >= 15 && tl <= 70, label: 'Título que cabe na caixa de entrada', detail: tl ? `${tl} caracteres (ideal: de 15 a 70)` : 'Escreva um título' },
    { ok: a.subtitle.trim().length >= 20 && a.subtitle.trim().length <= 160, label: 'Subtítulo que completa o título', detail: a.subtitle.trim() ? `${a.subtitle.trim().length} caracteres (ideal: de 20 a 160)` : 'Sem subtítulo' },
    { ok: first > 0 && first <= 55, label: 'Abertura curta', detail: first ? `${first} palavras no primeiro parágrafo (ideal: até 55)` : 'Sem texto ainda' },
    { ok: words < 450 || heads >= Math.floor(words / 450), label: 'Intertítulos que guiam a leitura', detail: words < 450 ? 'Texto curto, sem necessidade' : `${heads} intertítulo(s) em ${words} palavras (ideal: um a cada ~400)` },
    { ok: longest > 0 && longest <= 110, label: 'Parágrafos que respiram', detail: longest ? `O maior tem ${longest} palavras (ideal: até 110)` : 'Sem texto ainda' },
    { ok: words >= 300, label: 'Profundidade suficiente', detail: `${words} palavras · ${readMinutes(words)} min de leitura` },
    { ok: !!last && ACTION.test(plainText(last)), label: 'Fechamento com um convite', detail: last && ACTION.test(plainText(last)) ? 'O fim pede uma ação' : 'O último parágrafo não parece convidar a uma ação' },
  ];
  return items;
}

/** Texto do artigo para copiar/baixar como Markdown. */
export const articleToMarkdown = (a: { title: string; subtitle: string; body: string }) => `# ${a.title}\n\n${a.subtitle ? `*${a.subtitle}*\n\n` : ''}${a.body}\n`;
