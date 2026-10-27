import Anthropic from '@anthropic-ai/sdk';
import { AI_MODEL, AiError, brandBlock, type BrandProfile } from './generate';
import { MAX_CONTENT_CHARS, PLATFORMS, allocate, wordsFor, type Platform, type ScriptData, type VideoIdea, type VideoPart } from '../video';

const PLATFORM_GUIDE: Record<Platform, string> = {
  reels: 'Reels (Instagram): legenda curta com gancho na 1ª linha; 3 a 5 hashtags.',
  tiktok: 'TikTok: tom mais direto e coloquial; legenda de 1 a 2 frases; 3 a 5 hashtags, com uma ampla e as demais de nicho.',
  shorts: 'YouTube Shorts: título forte e descritivo; legenda de 1 a 2 frases; 2 a 4 hashtags (inclua #shorts).',
  all: 'TODAS as plataformas (Reels, TikTok e Shorts): escreva um roteiro que funcione nas três, com linguagem direta e neutra (sem referências a recursos de uma rede específica). Legenda curta com gancho na 1ª linha, que sirva para qualquer uma; 4 a 6 hashtags amplas (nada exclusivo de uma plataforma).',
};

const STR = { type: 'string' } as const;
const IDEAS_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['ideas'],
  properties: {
    ideas: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['title', 'angle', 'points'], properties: { title: STR, angle: STR, points: { type: 'array', items: STR } } },
    },
  },
};
const SCRIPT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['title', 'parts', 'caption', 'hashtags', 'to_verify'],
  properties: {
    title: STR, caption: STR, hashtags: { type: 'array', items: STR }, to_verify: { type: 'array', items: STR },
    parts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['speech', 'on_screen', 'visual'], properties: { speech: STR, on_screen: STR, visual: STR } } },
  },
};

const clean = (s: unknown, max = 600) => (typeof s === 'string' ? s.replace(/\s+\n/g, '\n').trim().slice(0, max) : '');
const usageOf = (u: unknown) => {
  const x = u as { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null } | undefined;
  return {
    inputTokens: Math.round((x?.input_tokens ?? 0) + (x?.cache_creation_input_tokens ?? 0) * 1.25 + (x?.cache_read_input_tokens ?? 0) * 0.1),
    outputTokens: x?.output_tokens ?? 0,
  };
};

function fail(e: unknown): never {
  if (e instanceof AiError) throw e;
  if (e instanceof Anthropic.RateLimitError) throw new AiError('Limite de uso da IA atingido. Tente novamente em instantes.', true);
  if (e instanceof Anthropic.AuthenticationError) throw new AiError('Chave da Anthropic inválida no servidor.');
  if (e instanceof Anthropic.APIError) throw new AiError(`Erro da IA (${e.status}).`, (e.status ?? 500) >= 500);
  throw new AiError('Não foi possível falar com a IA.', true);
}
const textOf = (res: { content: { type: string; text?: string }[] }) => res.content.find((b) => b.type === 'text')?.text ?? '';

export type VideoFormatInput = { name: string; parts: VideoPart[] };
export type VideoCommon = { content: string; format: VideoFormatInput; seconds: number; platform: Platform; instructions: string; brand: BrandProfile };

/** Bloco comum às duas chamadas: identidade da marca + formato + conteúdo-fonte (o conteúdo vai em cache entre os roteiros do lote). */
function systemBlocks(i: VideoCommon, role: string, extra: string): Anthropic.Beta.BetaTextBlockParam[] {
  const secs = allocate(i.format.parts, i.seconds);
  const fmt = i.format.parts.map((p, k) =>
    `PARTE ${k + 1} — ${p.name} (${secs[k]} s, no máximo ~${wordsFor(secs[k])} palavras de fala)\nInstruções: ${p.instruction.trim() || 'Sem instruções específicas.'}`).join('\n\n');
  const plat = PLATFORMS.find((p) => p.id === i.platform)?.label ?? 'Reels';
  const head = [
    role, brandBlock(i.brand),
    `FORMATO: ${i.format.name}\nDuração total: ${i.seconds} segundos. Plataforma: ${plat}. ${PLATFORM_GUIDE[i.platform]}\n\n${fmt}`,
    i.instructions.trim() ? `INSTRUÇÕES EXTRAS DO USUÁRIO:\n${i.instructions.trim()}` : '',
    extra,
  ].filter(Boolean).join('\n\n');
  return [
    { type: 'text', text: head },
    { type: 'text', text: `CONTEÚDO-FONTE (use somente fatos daqui):\n\n${i.content.trim().slice(0, MAX_CONTENT_CHARS)}`, cache_control: { type: 'ephemeral' } },
  ];
}

const RULES = `REGRAS GERAIS
- Português do Brasil, linguagem FALADA: frases curtas, ritmo de conversa, sem jargão e sem "leitura de texto". Escreva como a pessoa fala olhando para a câmera.
- NÃO invente fatos, números, estatísticas, datas, nomes ou fontes. Use apenas o conteúdo-fonte. Liste em "to_verify" o que o revisor deve conferir antes de publicar (lista vazia se nada).
- Respeite o tom de voz e as regras da marca. Evite clichês de IA e de vídeo ("fica comigo até o final", "você não vai acreditar").
- Nunca peça para a pessoa "ler" algo que o texto na tela já diz: fala e tela se complementam.`;

/** Passo 1: sugere ideias (ângulos) independentes a partir do conteúdo longo, para o usuário aprovar. */
export async function planVideoIdeas(i: VideoCommon & { count: number; feedback?: string }): Promise<{ ideas: VideoIdea[]; inputTokens: number; outputTokens: number }> {
  const n = Math.max(1, Math.round(i.count));
  if (process.env.AI_MOCK === '1') {
    const first = i.content.trim().split(/\n+/)[0].slice(0, 50);
    return { ideas: Array.from({ length: n }, (_, k) => ({ title: `Ideia ${k + 1}: ${first}`, angle: `Ângulo ${k + 1} do conteúdo, no formato ${i.format.name}.`, points: ['Ponto principal A', 'Ponto principal B'] })), inputTokens: 1500, outputTokens: 600 };
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError('ANTHROPIC_API_KEY não configurada no servidor.');
  const role = 'Você é um estrategista de conteúdo para vídeos curtos (Reels, TikTok e Shorts). Sua tarefa é extrair do conteúdo-fonte as melhores IDEIAS de vídeo, cada uma com um ângulo próprio.';
  const extra = `${RULES}

TAREFA: PLANEJAR ${n} IDEIA(S)
- Devolva exatamente ${n} ideia(s), diferentes entre si: cada uma cobre um trecho, um argumento ou uma pergunta distinta do conteúdo (sem sobreposição).
- "title": título de trabalho curto (até 70 caracteres) que também funcione como gancho.
- "angle": 1 a 2 frases dizendo o ângulo do vídeo e o que o espectador ganha. Adequado ao formato e à duração (uma ideia só por vídeo de ${i.seconds} s).
- "points": 2 a 4 pontos do conteúdo-fonte que o vídeo deve usar (curtos, fiéis ao conteúdo).
- Ordene da ideia com maior potencial de retenção para a menor.`;
  try {
    const res = await new Anthropic().beta.messages.create({
      model: AI_MODEL, max_tokens: 6000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      system: systemBlocks(i, role, extra),
      output_config: { effort: 'low', format: { type: 'json_schema', schema: IDEAS_SCHEMA } },
      messages: [{ role: 'user', content: i.feedback?.trim() ? `Planeje as ideias. Ajuste pedido pelo usuário: ${i.feedback.trim()}` : 'Planeje as ideias.' }],
    });
    if (res.stop_reason === 'refusal') throw new AiError('A IA recusou planejar ideias para este conteúdo.');
    const raw = JSON.parse(textOf(res)) as { ideas?: { title?: string; angle?: string; points?: string[] }[] };
    const ideas = (raw.ideas ?? []).slice(0, n).map((x) => ({ title: clean(x.title, 120), angle: clean(x.angle, 400), points: (x.points ?? []).map((p) => clean(p, 200)).filter(Boolean).slice(0, 5) })).filter((x) => x.title);
    if (!ideas.length) throw new AiError('A IA não devolveu ideias. Tente de novo.', true);
    return { ideas, ...usageOf(res.usage) };
  } catch (e) { return fail(e); }
}

/** Passo 2: escreve o roteiro de UMA ideia, parte por parte, seguindo as instruções de cada parte do formato. */
export async function generateVideoScript(i: VideoCommon & { idea: VideoIdea; /** Perfil da persona (texto) quando o roteiro nasce de uma ideia de conteúdo. */ personaBrief?: string }): Promise<{ title: string; data: ScriptData; inputTokens: number; outputTokens: number }> {
  const secs = allocate(i.format.parts, i.seconds);
  const toData = (parts: { speech: string; on_screen: string; visual: string }[], caption: string, hashtags: string[], notes: string[]): ScriptData => ({
    parts: i.format.parts.map((fp, k) => ({ name: fp.name, seconds: secs[k], speech: clean(parts[k]?.speech, 1200), onScreen: clean(parts[k]?.on_screen, 160), visual: clean(parts[k]?.visual, 400) })),
    caption: clean(caption, 1200), hashtags: hashtags.map((h) => clean(h, 40).replace(/^#/, '').replace(/\s+/g, '')).filter(Boolean).slice(0, 8),
    notes: notes.map((n) => clean(n, 300)).filter(Boolean).slice(0, 10),
  });
  if (process.env.AI_MOCK === '1') {
    await new Promise((r) => setTimeout(r, 700 + Math.random() * 900));
    if (/erro/i.test(i.idea.title)) throw new AiError('Erro simulado (a ideia continha "erro").');
    const parts = i.format.parts.map((p, k) => ({ speech: `Fala de exemplo da parte ${p.name.toLowerCase()} sobre ${i.idea.title.slice(0, 40)}.`.repeat(1), on_screen: `${p.name.toUpperCase()}`, visual: `Plano ${k + 1}: close no rosto, fundo neutro.` }));
    return { title: i.idea.title.slice(0, 80), data: toData(parts, `Legenda de exemplo: ${i.idea.title}`, ['exemplo', 'conteudo'], ['Confira os dados citados antes de publicar.']), inputTokens: 2000, outputTokens: 900 };
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError('ANTHROPIC_API_KEY não configurada no servidor.');
  const role = 'Você é um roteirista sênior de vídeos curtos (Reels, TikTok e Shorts). Você escreve roteiros prontos para gravar, parte por parte, em JSON estrito.';
  const extra = `${RULES}

TAREFA: ESCREVER O ROTEIRO
- "parts" deve ter EXATAMENTE ${i.format.parts.length} itens, na mesma ordem das partes do formato. Cada parte segue as instruções dela.
- "speech": a fala daquela parte, dentro do limite de palavras indicado (não ultrapasse: o vídeo tem de caber em ${i.seconds} s). Se a parte for o gancho, a primeira frase precisa prender em até 3 segundos.
- "on_screen": texto curto na tela (até 6 palavras, em caixa normal), ou "" se não houver.
- "visual": o que aparece/acontece na tela naquele trecho (enquadramento, b-roll, gráfico, ação), concreto e fácil de gravar, em uma frase.
- "title": título interno do vídeo (até 70 caracteres). "caption": legenda para publicar. "hashtags": sem o "#".${i.personaBrief ? `

PERSONA QUE VAI ASSISTIR (fale com ela, no jeito dela):
${i.personaBrief}

COMO USAR A IDEIA DE CONTEÚDO (o conteúdo-fonte é uma ideia estruturada: dor, impacto, causa, guia, plano, ganho, desejo, CTA)
- Distribua a história pelas partes do formato, com começo, meio e fim claros. Ex.: abertura = a dor em cena; partes do meio = o impacto, a causa explicada passo a passo e o plano em passos concretos; parte final = ganho, desejo e CTA. Se o formato tem poucas partes, comprima, mas preserve esse arco.
- DIDÁTICO: explique como para um amigo que não entende do assunto. Cada frase leva à próxima (porque, por isso, aí, então). Termo difícil: explique na hora ou troque.
- CONCRETO: nada de abstrações soltas (transparência, repasse, sistema, equidade). Mostre ações e situações do dia a dia desta persona, com as palavras que ela usa.
- O GUIA é só bússola: não narre a metáfora do guia nem diga "valor" ou "enquadramento". Só use imagem que seja do universo da persona.
- NÃO invente números, valores nem datas: use só os que estão na ideia; sem dado, fale em termos qualitativos.` : ''}`;
  const ideaText = `IDEIA DESTE VÍDEO\nTítulo: ${i.idea.title}\nÂngulo: ${i.idea.angle}${i.idea.points.length ? `\nPontos a usar:\n${i.idea.points.map((p) => `- ${p}`).join('\n')}` : ''}`;
  try {
    const res = await new Anthropic().beta.messages.create({
      model: AI_MODEL, max_tokens: 8000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      system: systemBlocks(i, role, extra),
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCRIPT_SCHEMA } },
      messages: [{ role: 'user', content: ideaText }],
    });
    if (res.stop_reason === 'refusal') throw new AiError('A IA recusou escrever este roteiro.');
    if (res.stop_reason === 'max_tokens') throw new AiError('A resposta ficou grande demais. Tente de novo.', true);
    const raw = JSON.parse(textOf(res)) as { title?: string; parts?: { speech: string; on_screen: string; visual: string }[]; caption?: string; hashtags?: string[]; to_verify?: string[] };
    if (!Array.isArray(raw.parts) || raw.parts.length < 1) throw new AiError('A IA devolveu um roteiro vazio.', true);
    const notes = [...(raw.parts.length !== i.format.parts.length ? [`A IA devolveu ${raw.parts.length} partes e o formato tem ${i.format.parts.length}. Confira.`] : []), ...(raw.to_verify ?? []).map((t) => `Conferir: ${t}`)];
    return { title: clean(raw.title, 80) || i.idea.title.slice(0, 80), data: toData(raw.parts, raw.caption ?? '', raw.hashtags ?? [], notes), ...usageOf(res.usage) };
  } catch (e) {
    if (e instanceof SyntaxError) throw new AiError('A IA devolveu uma resposta inválida.', true);
    return fail(e);
  }
}

const REFINE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['title', 'parts', 'caption', 'hashtags', 'note'],
  properties: {
    title: STR, caption: STR, hashtags: { type: 'array', items: STR }, note: STR,
    parts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['speech', 'on_screen', 'visual'], properties: { speech: STR, on_screen: STR, visual: STR } } },
  },
};

export type RefineScriptInput = {
  title: string; data: ScriptData; previous?: { title: string; data: ScriptData };
  /** Instruções de cada parte do formato (na ordem; vazio se o formato não existe mais). */
  instructions: string[]; formatName: string; seconds: number; platform: Platform; angle: string;
  feedback: string;
  /** Índice da parte a refinar (as outras ficam como estão); nulo = o roteiro inteiro. */
  scope: number | null; brand: BrandProfile;
};

/** Refina um roteiro já gerado (a versão que está na tela) a partir de um feedback. Não grava: o usuário aprova antes. */
export async function refineVideoScript(i: RefineScriptInput): Promise<{ title: string; data: ScriptData; note: string }> {
  const n = i.data.parts.length;
  const build = (parts: { speech: string; on_screen: string; visual: string }[], title: string, caption: string, hashtags: string[]): ScriptData => ({
    parts: i.data.parts.map((p, k) => (i.scope !== null && i.scope !== k ? p : { ...p, speech: clean(parts[k]?.speech, 1200), onScreen: clean(parts[k]?.on_screen, 160), visual: clean(parts[k]?.visual, 400) })),
    caption: clean(caption, 1200) || i.data.caption, hashtags: hashtags.map((h) => clean(h, 40).replace(/^#/, '').replace(/\s+/g, '')).filter(Boolean).slice(0, 8), notes: i.data.notes,
  });
  if (process.env.AI_MOCK === '1') {
    await new Promise((r) => setTimeout(r, 600));
    return { title: i.title, data: { ...i.data, parts: i.data.parts.map((p, k) => (i.scope !== null && i.scope !== k ? p : { ...p, speech: `${p.speech} (refinado: ${i.feedback.slice(0, 30)})` })) }, note: 'Versão simulada (AI_MOCK=1).' };
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError('ANTHROPIC_API_KEY não configurada no servidor.');
  const show = (t: string, d: ScriptData) => `Título: ${t}\n${d.parts.map((p, k) => `PARTE ${k + 1} — ${p.name} (${p.seconds} s, no máximo ~${wordsFor(p.seconds)} palavras de fala)${i.instructions[k]?.trim() ? `\nInstruções da parte: ${i.instructions[k].trim()}` : ''}\nFala: ${p.speech}\nTexto na tela: ${p.onScreen || '(nenhum)'}\nVisual: ${p.visual}`).join('\n\n')}\nLegenda: ${d.caption}\nHashtags: ${d.hashtags.join(' ')}`;
  const plat = PLATFORMS.find((p) => p.id === i.platform)?.label ?? 'Reels';
  const system = [
    'Você é um roteirista sênior de vídeos curtos (Reels, TikTok e Shorts). O usuário pediu um AJUSTE num roteiro que já existe. Devolva o roteiro revisado, em JSON estrito.',
    brandBlock(i.brand),
    `FORMATO: ${i.formatName || 'Vídeo curto'}\nDuração total: ${i.seconds} segundos. Plataforma: ${plat}. ${PLATFORM_GUIDE[i.platform]}${i.angle ? `\nIdeia do vídeo: ${i.angle}` : ''}`,
    `REGRAS
- Aplique o pedido do usuário. Mude só o que o pedido exige e o que for necessário para manter a coerência; preserve o resto (ideia, fatos, estrutura, o que já estava bom).
- "parts" deve ter EXATAMENTE ${n} itens, na mesma ordem. ${i.scope !== null ? `Só a PARTE ${i.scope + 1} deve mudar: devolva as outras partes exatamente como estão.` : 'Você pode ajustar qualquer parte que o pedido atingir, mantendo a sequência fluida.'}
- Respeite o limite de palavras de fala de cada parte (o vídeo tem de caber em ${i.seconds} s) e as instruções da parte, quando houver.
- Português do Brasil, linguagem FALADA: frases curtas, ritmo de conversa. NÃO invente fatos, números, datas, nomes ou fontes: use só o que já está no roteiro ou no pedido. Respeite o tom e as regras da marca; evite clichês de IA e de vídeo.
- Fala e tela se complementam: não peça para a pessoa "ler" o que a tela já diz. "on_screen": até 6 palavras, ou "" se não houver.
- Se houver "SUGESTÃO ANTERIOR (não aprovada)", parta dela e aplique o novo pedido, sem desfazer o que já estava bom.
- "title" (até 70 caracteres), "caption" e "hashtags" (sem "#"): mantenha como estão, a menos que o pedido os atinja.
- "note": uma frase curta dizendo o que você mudou.`,
  ].filter(Boolean).join('\n\n');
  const user = [`ROTEIRO ATUAL:\n${show(i.title, i.data)}`, i.previous ? `SUGESTÃO ANTERIOR (não aprovada):\n${show(i.previous.title, i.previous.data)}` : '', `PEDIDO DO USUÁRIO${i.scope !== null ? ` (só sobre a parte ${i.scope + 1})` : ''}:\n${i.feedback}`].filter(Boolean).join('\n\n');
  try {
    const res = await new Anthropic().beta.messages.create({
      model: AI_MODEL, max_tokens: 8000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      system, output_config: { effort: 'medium', format: { type: 'json_schema', schema: REFINE_SCHEMA } },
      messages: [{ role: 'user', content: user }],
    });
    if (res.stop_reason === 'refusal') throw new AiError('A IA recusou refinar este roteiro.');
    if (res.stop_reason === 'max_tokens') throw new AiError('A resposta ficou grande demais. Tente de novo.', true);
    const raw = JSON.parse(textOf(res)) as { title?: string; parts?: { speech: string; on_screen: string; visual: string }[]; caption?: string; hashtags?: string[]; note?: string };
    if (!Array.isArray(raw.parts) || raw.parts.length !== n) throw new AiError('A IA devolveu o roteiro com um número diferente de partes. Tente de novo.', true);
    return { title: clean(raw.title, 80) || i.title, data: build(raw.parts, clean(raw.title, 80), raw.caption ?? '', raw.hashtags ?? i.data.hashtags), note: clean(raw.note, 300) };
  } catch (e) {
    if (e instanceof SyntaxError) throw new AiError('A IA devolveu uma resposta inválida.', true);
    return fail(e);
  }
}
