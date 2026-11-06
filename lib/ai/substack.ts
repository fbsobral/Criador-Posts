import Anthropic from '@anthropic-ai/sdk';
import { AI_MODEL, AiError, STYLE_TICS, brandBlock, type BrandProfile } from './generate';
import { ARTICLE_ANGLES, MAX_BODY_CHARS, countWords, lengthOf, type ArticleAngleId, type ArticleMeta, type ArticlePlan, type OutlineSection } from '../substack';

/** Artigos de newsletter para o Substack: esboço, escrita e refino. Nada é gravado aqui. */

const STR = { type: 'string' } as const;
const STRS = { type: 'array', items: STR } as const;
const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/[ \t]+\n/g, '\n').trim().slice(0, max) : '');
const cleanList = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v.map((x) => clean(x, max)).filter(Boolean).slice(0, n) : []);

const PLAN_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['angle', 'titles', 'subtitle', 'hook', 'sections'],
  properties: {
    angle: { type: 'string', enum: ARTICLE_ANGLES.filter((a) => a.id !== 'auto').map((a) => a.id) },
    titles: STRS, subtitle: STR, hook: STR,
    sections: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['heading', 'point'], properties: { heading: STR, point: STR } } },
  },
};
// "strategy" vem primeiro: a IA decide a tese e o leitor antes de escrever
const ARTICLE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['strategy', 'title', 'subtitle', 'body', 'email_subject', 'preview_text', 'seo_description', 'tags', 'notes', 'to_verify'],
  properties: { strategy: STR, title: STR, subtitle: STR, body: STR, email_subject: STR, preview_text: STR, seo_description: STR, tags: STRS, notes: STRS, to_verify: STRS },
};
const REFINE_SCHEMA = { type: 'object', additionalProperties: false, required: ['text', 'note'], properties: { text: STR, note: STR } };

const CRAFT = `OFÍCIO DE NEWSLETTER (siga à risca)
- Escreva para UMA pessoa (a persona) e UMA tese. Um artigo, uma ideia central. Tudo que não serve à tese sai.
- ABERTURA: nas duas primeiras frases, uma cena, uma pergunta ou uma afirmação que prende. Nada de "Neste artigo vamos falar sobre". A promessa do texto aparece até o terceiro parágrafo.
- Parágrafos curtos (1 a 3 frases, no máximo 4 linhas). Frases variadas: uma longa, uma curta. Leitura em tela e no celular.
- Intertítulos (##) fortes e específicos a cada ~300 a 400 palavras; devem fazer sentido sozinhos e despertar vontade de continuar. Evite "Introdução" e "Conclusão".
- Concretude: exemplos, cenas, comparações do dia a dia. Zero abstração vazia. NÃO invente números, estudos, datas, nomes de pessoas reais nem citações; quando precisar de um retrato, deixe claro que é ilustrativo. Liste em "to_verify" o que o revisor deve conferir.
- Voz da marca e da persona; calor humano; sem sermão. Português do Brasil. Evite clichês de IA ("no mundo de hoje", "mergulhar", "jornada", "em suma", "vale ressaltar", "é importante destacar").
- Pode usar **negrito** com parcimônia, uma citação (>) forte, listas curtas e um divisor (---). Sem emojis no corpo. Sem título H1 no corpo: o título vai no campo próprio.
- FECHAMENTO: retome a abertura, entregue a ideia que a pessoa leva e faça UM convite só, natural. Se a fonte traz uma CTA (a CTA da ideia ou um pedido do material), o convite é ESSA ação, para ESSE destinatário; só sem ela use responder ao e-mail, compartilhar com alguém ou assinar.
- PERSONA: escreva PARA ela (o leitor que tem essa vida, essas dúvidas e objeções), nunca SOBRE ela. Para uma cena, use um personagem genérico ("um jovem que…") ou "você", sem o nome do perfil.

${STYLE_TICS}`;

const FIELDS = `CAMPOS
- "strategy": 2 a 3 frases (não aparece para o leitor): para quem é, a tese central, a emoção da abertura e o convite final.
- "title": até 70 caracteres contando espaços (passou disso, corte palavras), específico, que gere curiosidade sem isca barata nem letras maiúsculas.
- "subtitle": 80 a 150 caracteres; completa o título com a promessa ou o ângulo.
- "body": o artigo em Markdown (apenas ##, ###, **, *, >, listas e ---).
- "email_subject": assunto do e-mail (até 60 caracteres), diferente do título.
- "preview_text": a linha de prévia do e-mail (até 110 caracteres), que complementa o assunto.
- "seo_description": até 155 caracteres para busca e compartilhamento.
- "tags": 3 a 5 palavras-chave curtas, sem #.
- "notes": 3 Notes do Substack (cada um até 280 caracteres) para divulgar o artigo: um que abre com a tensão, um com uma frase forte do texto, um com uma pergunta para a conversa. Sem link e sem hashtags.
- "to_verify": o que conferir antes de publicar (lista vazia se nada).`;

function fail(e: unknown): never {
  if (e instanceof AiError) throw e;
  if (e instanceof SyntaxError) throw new AiError('A IA devolveu uma resposta inválida. Tente de novo.', true);
  if (e instanceof Anthropic.RateLimitError) throw new AiError('Limite de uso da IA atingido. Tente em instantes.', true);
  if (e instanceof Anthropic.AuthenticationError) throw new AiError('Chave da Anthropic inválida no servidor.');
  if (e instanceof Anthropic.APIError) throw new AiError(`Erro da IA (${e.status}).`, (e.status ?? 500) >= 500);
  throw new AiError('Não foi possível falar com a IA.', true);
}
const textOf = (res: { content: { type: string; text?: string }[] }) => res.content.find((b) => b.type === 'text')?.text ?? '';
const usageOf = (u: unknown) => { const x = u as { input_tokens?: number; output_tokens?: number } | undefined; return { inputTokens: x?.input_tokens ?? 0, outputTokens: x?.output_tokens ?? 0 }; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type ArticleSource = { text: string; label: string };
type Common = { source: ArticleSource; angle: ArticleAngleId; length: string; instructions: string; brand: BrandProfile };

function userBlock(i: Common, extra = ''): string {
  const angle = ARTICLE_ANGLES.find((a) => a.id === i.angle);
  const len = lengthOf(i.length);
  return [
    `${i.source.label}:\n${i.source.text.trim().slice(0, 20000)}`,
    angle?.guide ? `FORMATO ESCOLHIDO PELO USUÁRIO:\n${angle.guide}` : 'FORMATO: escolha o que melhor serve a esta ideia entre os ids permitidos.',
    `TAMANHO: cerca de ${len.words} palavras (${len.hint.toLowerCase()}).`,
    i.instructions.trim() ? `INSTRUÇÕES EXTRAS DO USUÁRIO:\n${i.instructions.trim()}` : '',
    extra,
  ].filter(Boolean).join('\n\n');
}

/** Passo 1: o esboço (títulos, subtítulo, abertura e seções) para o usuário aprovar. */
export async function planArticle(i: Common): Promise<ArticlePlan & { inputTokens: number; outputTokens: number }> {
  if (process.env.AI_MOCK === '1') {
    await sleep(900);
    return {
      angle: i.angle === 'auto' ? 'ensaio' : i.angle, titles: ['Ninguém te contou o que a vaga realmente pede', 'O primeiro emprego não é falta de currículo', 'Experiência exigida, oportunidade negada'],
      subtitle: 'Por que quem está começando fica de fora, e o que muda quando alguém abre a porta.', hook: 'Abre com a cena de quem manda o vigésimo currículo e recebe o mesmo silêncio.',
      sections: [{ heading: 'A porta que pede a chave de dentro', point: 'A contradição de pedir experiência a quem nunca teve chance.' }, { heading: 'Quem perde com isso', point: 'O custo para o jovem, a família e a própria empresa.' }, { heading: 'O que muda quando alguém abre espaço', point: 'Treino, mentoria e conhecimento prévio mudam o jogo.' }, { heading: 'O próximo passo é pequeno', point: 'Um convite simples e possível.' }],
      inputTokens: 1200, outputTokens: 500,
    };
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError('ANTHROPIC_API_KEY não configurada no servidor.');
  const system = [
    'Você é um editor sênior de newsletters. Você planeja o ESBOÇO de um artigo para o Substack (ainda sem escrever o texto), em JSON estrito, em português do Brasil.',
    '- "angle": o formato escolhido (id permitido).\n- "titles": 3 títulos com abordagens diferentes (tensão/contradição, promessa, pergunta ou cena), até 70 caracteres cada.\n- "subtitle": 80 a 150 caracteres.\n- "hook": como o artigo abre, em uma frase (a cena, a pergunta ou a afirmação).\n- "sections": de 3 a 7 seções na ordem do texto; "heading" é o intertítulo final (específico, não "Introdução"), "point" é o que a seção prova ou conta, em uma frase. A última seção leva ao convite final.\n- Sem inventar números, estudos, datas ou nomes.',
    CRAFT, brandBlock(i.brand),
  ].join('\n\n');
  try {
    const res = await new Anthropic().beta.messages.create({
      model: AI_MODEL, max_tokens: 3000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', system,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: PLAN_SCHEMA } }, messages: [{ role: 'user', content: userBlock(i) }],
    });
    if (res.stop_reason === 'refusal') throw new AiError('A IA recusou planejar este artigo.');
    if (res.stop_reason === 'max_tokens') throw new AiError('A resposta ficou grande demais. Tente de novo.', true);
    const raw = JSON.parse(textOf(res as never)) as { angle?: string; titles?: string[]; subtitle?: string; hook?: string; sections?: { heading?: string; point?: string }[] };
    const sections: OutlineSection[] = (raw.sections ?? []).map((s) => ({ heading: clean(s.heading, 120), point: clean(s.point, 240) })).filter((s) => s.heading).slice(0, 8);
    const titles = cleanList(raw.titles, 3, 120);
    if (sections.length < 2 || !titles.length) throw new AiError('A IA não devolveu um esboço válido. Tente de novo.', true);
    return { angle: clean(raw.angle, 20), titles, subtitle: clean(raw.subtitle, 200), hook: clean(raw.hook, 300), sections, ...usageOf(res.usage) };
  } catch (e) { return fail(e); }
}

export type WrittenArticle = { title: string; subtitle: string; body: string; angle: string; meta: ArticleMeta; strategy: string };

/** Passo 2: escreve o artigo inteiro (com o esboço aprovado, quando houver). */
export async function writeArticle(i: Common & { plan?: { title: string; subtitle: string; hook: string; sections: OutlineSection[] } | null }): Promise<WrittenArticle & { inputTokens: number; outputTokens: number }> {
  const len = lengthOf(i.length);
  if (process.env.AI_MOCK === '1') {
    await sleep(1800);
    const heads = i.plan?.sections.map((s) => s.heading) ?? ['A porta que pede a chave de dentro', 'Quem perde com isso', 'O que muda quando alguém abre espaço'];
    const para = (n: number) => `Este é um parágrafo de exemplo número ${n}, escrito em modo simulado para você ver como o artigo fica na tela, com ritmo, respiro e uma ideia por vez.`;
    const body = [para(0), para(1), ...heads.flatMap((h, k) => [`## ${h}`, para(k * 2 + 2), `${para(k * 2 + 3)} **Uma frase em destaque** no meio do texto.`]), '> Uma citação forte para dar ritmo ao texto.', '## O próximo passo é pequeno', 'Responda este e-mail contando como foi o seu primeiro emprego, e compartilhe com quem está começando agora.'].join('\n\n');
    return {
      title: i.plan?.title || 'Experiência exigida, oportunidade negada', subtitle: i.plan?.subtitle || 'Por que quem está começando fica de fora, e o que muda quando alguém abre a porta.', body, angle: i.angle === 'auto' ? 'ensaio' : i.angle,
      strategy: 'Para quem procura o primeiro emprego; tese: o problema é coletivo; abre com a cena do currículo sem resposta; convida a responder.',
      meta: { emailSubject: 'A vaga que pede o que ninguém teve chance de ter', previewText: 'Sobre o primeiro emprego e a porta que se abre por dentro.', seoDescription: 'Por que quem está começando fica de fora das vagas e o que muda quando alguém abre espaço.', tags: ['primeiro emprego', 'juventude', 'oportunidade'], notes: ['Todo mundo pede experiência. Quem dá a primeira?', '"A porta se abre por dentro." Escrevi sobre o primeiro emprego e quem pode abri-la.', 'Qual foi a primeira pessoa que apostou em você?'], toVerify: ['Confira os dados citados antes de publicar.'] },
      inputTokens: 2600, outputTokens: 2400,
    };
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError('ANTHROPIC_API_KEY não configurada no servidor.');
  const plan = i.plan
    ? `ESBOÇO APROVADO (siga a ordem e a intenção; pode ajustar a redação):\nTítulo: ${i.plan.title}\nSubtítulo: ${i.plan.subtitle}\nAbertura: ${i.plan.hook}\n${i.plan.sections.map((s, k) => `${k + 1}. ## ${s.heading} — ${s.point}`).join('\n')}`
    : 'Planeje a estrutura sozinho (em "strategy") antes de escrever.';
  const system = ['Você é um editor e escritor sênior de newsletters. Você escreve ARTIGOS PRONTOS PARA O SUBSTACK, em JSON estrito, em português do Brasil.', CRAFT, FIELDS, brandBlock(i.brand)].join('\n\n');
  try {
    const res = await new Anthropic().beta.messages.create({
      model: AI_MODEL, max_tokens: Math.max(16000, Math.round(len.words * 6) + 4000), betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', system,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: ARTICLE_SCHEMA } }, messages: [{ role: 'user', content: userBlock(i, plan) }],
    });
    if (res.stop_reason === 'refusal') throw new AiError('A IA recusou escrever este artigo.');
    if (res.stop_reason === 'max_tokens') throw new AiError('O artigo ficou grande demais para uma resposta. Tente um tamanho menor.', true);
    const r = JSON.parse(textOf(res as never)) as Record<string, unknown>;
    const body = clean(r.body, MAX_BODY_CHARS);
    if (countWords(body) < 120) throw new AiError('A IA devolveu um texto curto demais. Tente de novo.', true);
    return {
      title: clean(r.title, 120) || i.plan?.title || 'Sem título', subtitle: clean(r.subtitle, 220), body, angle: i.angle === 'auto' ? '' : i.angle, strategy: clean(r.strategy, 500),
      meta: { emailSubject: clean(r.email_subject, 100), previewText: clean(r.preview_text, 160), seoDescription: clean(r.seo_description, 200), tags: cleanList(r.tags, 6, 40).map((t) => t.replace(/^#/, '')), notes: cleanList(r.notes, 4, 300), toVerify: cleanList(r.to_verify, 8, 300) },
      ...usageOf(res.usage),
    };
  } catch (e) { return fail(e); }
}

/** Refina o artigo todo ou só um trecho selecionado, seguindo o pedido do usuário. Não grava. */
export async function refineArticle(i: { title: string; subtitle: string; body: string; selection?: string; feedback: string; brand: BrandProfile }): Promise<{ text: string; note: string; inputTokens: number; outputTokens: number }> {
  const whole = !i.selection;
  if (process.env.AI_MOCK === '1') {
    await sleep(700);
    return { text: whole ? `${i.body}\n\nParágrafo ajustado (simulado): ${i.feedback}.` : `${i.selection} (ajustado: ${i.feedback})`, note: 'Ajuste simulado.', inputTokens: 900, outputTokens: 500 };
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError('ANTHROPIC_API_KEY não configurada no servidor.');
  const system = ['Você é um editor sênior de newsletters. Você ajusta um artigo do Substack seguindo o pedido do usuário, em JSON estrito, em português do Brasil.', whole ? 'Devolva em "text" o ARTIGO INTEIRO (só o corpo em Markdown), com as mudanças pedidas e o resto preservado.' : 'Devolva em "text" APENAS o trecho reescrito, para substituir o trecho selecionado (mesmo formato Markdown, sem comentários), mantendo a voz do restante.', 'Em "note", diga em uma frase o que mudou. Não invente fatos, números ou nomes.', CRAFT, brandBlock(i.brand)].join('\n\n');
  const user = `TÍTULO: ${i.title}\nSUBTÍTULO: ${i.subtitle}\n\nARTIGO ATUAL:\n${i.body.slice(0, MAX_BODY_CHARS)}\n\n${whole ? '' : `TRECHO SELECIONADO (reescreva só isto):\n${i.selection}\n\n`}PEDIDO DO USUÁRIO: ${i.feedback}`;
  try {
    const res = await new Anthropic().beta.messages.create({
      model: AI_MODEL, max_tokens: whole ? 16000 : 4000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', system,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: REFINE_SCHEMA } }, messages: [{ role: 'user', content: user }],
    });
    if (res.stop_reason === 'refusal') throw new AiError('A IA recusou este ajuste.');
    if (res.stop_reason === 'max_tokens') throw new AiError('A resposta ficou grande demais. Tente ajustar um trecho menor.', true);
    const r = JSON.parse(textOf(res as never)) as { text?: string; note?: string };
    const text = clean(r.text, MAX_BODY_CHARS);
    if (!text) throw new AiError('A IA não devolveu texto. Tente de novo.', true);
    return { text, note: clean(r.note, 240), ...usageOf(res.usage) };
  } catch (e) { return fail(e); }
}
