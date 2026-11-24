import Anthropic from '@anthropic-ai/sdk';
import { AI_LIGHT_MODEL, AI_MODEL, AiError, brandBlock, type BrandProfile } from './generate';
import { MAX_CONTENT_CHARS, MAX_PARTS, PLATFORMS, allocate, wordsFor, type Platform, type ScriptData } from '../video';

/**
 * Roteiros de vídeo curto. A IA escreve LIVRE, como num chat: recebe o material, a duração e o perfil da marca,
 * sem formato, partes fixas nem metodologia. Depois, uma chamada rápida só COPIA o texto para os campos do app
 * (blocos, texto na tela, imagem, legenda, notas), sem reescrever, para o editor, o teleprompter e o refino funcionarem.
 */

const PLATFORM_GUIDE: Record<Platform, string> = {
  reels: 'Reels (Instagram): legenda curta com gancho na 1ª linha; 3 a 5 hashtags.',
  tiktok: 'TikTok: tom mais direto e coloquial; legenda de 1 a 2 frases; 3 a 5 hashtags, com uma ampla e as demais de nicho.',
  shorts: 'YouTube Shorts: título forte e descritivo; legenda de 1 a 2 frases; 2 a 4 hashtags (inclua #shorts).',
  all: 'TODAS as plataformas (Reels, TikTok e Shorts): roteiro que funcione nas três, com linguagem direta. Legenda curta com gancho na 1ª linha; 4 a 6 hashtags amplas.',
};

const STR = { type: 'string' } as const;
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
  if (e instanceof SyntaxError) throw new AiError('A IA devolveu uma resposta inválida. Tente de novo.', true);
  if (e instanceof Anthropic.RateLimitError) throw new AiError('Limite de uso da IA atingido. Tente novamente em instantes.', true);
  if (e instanceof Anthropic.AuthenticationError) throw new AiError('Chave da Anthropic inválida no servidor.');
  if (e instanceof Anthropic.APIError) throw new AiError(`Erro da IA (${e.status}).`, (e.status ?? 500) >= 500);
  throw new AiError('Não foi possível falar com a IA.', true);
}
const textOf = (res: { content: { type: string; text?: string }[] }) => res.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n').trim();

/* ---------------- 1. a IA escreve livre ---------------- */

export type WriteScriptInput = {
  /** O material: dados, anotações, texto, tema ou a ideia de conteúdo. */
  content: string;
  seconds: number;
  /** Pedido extra do usuário (opcional). */
  instructions: string;
  brand: BrandProfile;
  /** Perfil da(s) persona(s) escolhidas (ou da ideia de conteúdo). */
  personaBrief?: string;
  /** Duas ou mais personas: o vídeo fala com o grupo. */
  multiPersona?: boolean;
};

/** O pedido, quase igual ao que se faria num chat: o material, a duração, o perfil da marca, o pedido do usuário e uma regra dura (não inventar). */
export function writerPrompt(i: WriteScriptInput) {
  const system = ['Você escreve roteiros de vídeos curtos (Reels, TikTok e Shorts) para a marca abaixo.', brandBlock(i.brand)].filter(Boolean).join('\n\n');
  const max = wordsFor(i.seconds), min = Math.round(max * 0.85);
  const user = [
    `Faça o roteiro de um vídeo de ${i.seconds} segundos (entre ${min} e ${max} palavras de fala: use o tempo todo, sem passar dele), com a legenda para publicar e as notas de produção (ritmo de cortes, legendas na tela, fontes dos números no rodapé e como fazer uma versão de 30 s), sobre isto:\n\n${i.content.trim().slice(0, MAX_CONTENT_CHARS)}`,
    // o gancho: sem esta pista, a IA abre com uma pergunta genérica ("E agora?") e deixa o dado para depois
    'O gancho decide se alguém para de rolar: abra com a informação mais forte do material (se houver um dado que impacta, ele), com uma virada ou uma pergunta que prende, e não com uma pergunta genérica como "E agora?".',
    // o pedido do usuário (público, foco, tom) vale para o vídeo inteiro, do gancho ao convite, não só para o final
    i.instructions.trim() ? `O PEDIDO PARA ESTE VÍDEO (vale do gancho ao convite: para quem é, o foco e o tom). Se ele muda para quem o vídeo fala (por exemplo, doadores em vez dos jovens do material), o vídeo inteiro fala com essa pessoa, e o material vira o argumento:\n${i.instructions.trim()}` : '',
    i.personaBrief ? (i.multiPersona
      ? `Para quem é o vídeo (várias personas: fale com o grupo pelo que elas têm em comum, usando os perfis como referência para cenas e palavras; os nomes dos perfis são internos, não os use no vídeo):\n${i.personaBrief}`
      : `Para quem é o vídeo (o nome do perfil é interno, não o use no vídeo):\n${i.personaBrief}`) : '',
    'Use só os fatos do material e do perfil da marca: não invente números, fontes, nomes nem citações. Se faltar no material algo que deixaria o vídeo mais forte (por exemplo, o que o apoio de um doador torna possível, ou o canal para contato), não invente: avise no fim, numa nota para quem vai gravar.',
  ].filter(Boolean).join('\n\n');
  return { system, user };
}

/* ---------------- 2. cópia para os campos do app (sem reescrever) ---------------- */

const EXTRACT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['title', 'parts', 'caption', 'hashtags', 'production', 'to_verify'],
  properties: {
    title: STR,
    parts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'seconds', 'speech', 'on_screen', 'visual'], properties: { name: STR, seconds: { type: 'integer' }, speech: STR, on_screen: STR, visual: STR } } },
    caption: STR, hashtags: { type: 'array', items: STR },
    production: { type: 'object', additionalProperties: false, required: ['rhythm', 'sources', 'short_version'], properties: { rhythm: STR, sources: { type: 'array', items: STR }, short_version: STR } },
    to_verify: { type: 'array', items: STR },
  },
};

const EXTRACT_SYSTEM = `Você recebe um roteiro de vídeo curto escrito em texto livre e o COPIA para campos estruturados. Não reescreva, não corrija, não resuma e não acrescente nada: copie as palavras exatamente como estão.
- "title": o título do roteiro (se não houver, um título curto tirado do próprio texto).
- "parts": um item por bloco/cena do roteiro, na ordem. "name": o rótulo do bloco como aparece (ex.: "Gancho", "Lista 1/4"); sem rótulo, um nome curto que diga o que o bloco faz. "seconds": a duração do bloco pela minutagem (ex.: 0:05–0:20 = 15). "speech": a fala/locução, sem as aspas de fora. "on_screen": o texto na tela. "visual": a imagem/o que mostrar. Campo que o bloco não tem fica "".
- "caption": a legenda sugerida, sem as hashtags. "hashtags": as hashtags, sem "#".
- "production": "rhythm" = as notas de ritmo, edição, legendas, música e locução que o roteiro trouxer, copiadas (pode juntar em parágrafos); se o roteiro não trouxer essas notas, deixe "" (não preencha com duração, foco nem outras informações); "sources" = cada fonte citada para os números; "short_version" = a versão curta, se houver (se for tabela, uma linha por bloco: "tempo · texto na tela · fala").
- "to_verify": cada número, fonte ou afirmação factual do roteiro que alguém deve conferir antes de publicar, mais o que o próprio roteiro avisa que falta no material, em frases curtas. Não liste o nome da marca nem informações triviais.`;

type Extracted = { title?: string; parts?: { name?: string; seconds?: number; speech?: string; on_screen?: string; visual?: string }[]; caption?: string; hashtags?: string[]; production?: { rhythm?: string; sources?: string[]; short_version?: string }; to_verify?: string[] };

function toData(x: Extracted, seconds: number, markdown: string): ScriptData {
  const list = (x.parts ?? []).filter((p) => clean(p.speech) || clean(p.on_screen) || clean(p.visual)).slice(0, MAX_PARTS);
  // os tempos do roteiro viram pesos e são ajustados para somar exatamente a duração pedida
  const secs = allocate(list.map((p) => ({ percent: Math.max(1, Number(p.seconds) || 1) })), seconds);
  return {
    parts: list.map((p, k) => ({ name: clean(p.name, 40) || `Bloco ${k + 1}`, seconds: secs[k], speech: clean(p.speech, 1200), onScreen: clean(p.on_screen, 200), visual: clean(p.visual, 500) })),
    caption: clean(x.caption, 1500),
    hashtags: (x.hashtags ?? []).map((h) => clean(h, 40).replace(/^#/, '').replace(/\s+/g, '')).filter(Boolean).slice(0, 12),
    notes: (x.to_verify ?? []).map((t) => clean(t, 300)).filter(Boolean).slice(0, 10).map((t) => `Conferir: ${t}`),
    production: { rhythm: clean(x.production?.rhythm, 1500), sources: (x.production?.sources ?? []).map((s) => clean(s, 200)).filter(Boolean).slice(0, 10), shortVersion: clean(x.production?.short_version, 1500) },
    markdown: markdown.slice(0, 20000),
  };
}

/** Escreve UM roteiro: a IA escreve livre e, em seguida, o texto é copiado para os campos do app. */
export async function writeVideoScript(i: WriteScriptInput): Promise<{ title: string; data: ScriptData; inputTokens: number; outputTokens: number }> {
  if (process.env.AI_MOCK === '1') {
    await new Promise((r) => setTimeout(r, 900));
    const md = '# Roteiro de exemplo\n\n**0:00–0:05 · GANCHO**\nFala: "Fala de exemplo."';
    return { title: 'Roteiro de exemplo', data: toData({ title: 'Roteiro de exemplo', parts: [{ name: 'Gancho', seconds: 5, speech: 'Fala de exemplo do gancho.', on_screen: 'GANCHO', visual: 'Close no rosto.' }, { name: 'Convite', seconds: 10, speech: 'Fala de exemplo do convite.', on_screen: 'CONVITE', visual: 'Logo no fim.' }], caption: 'Legenda de exemplo.', hashtags: ['exemplo'], production: { rhythm: 'Corte a cada 3 a 5 s.', sources: [], short_version: '' }, to_verify: [] }, i.seconds, md), inputTokens: 2000, outputTokens: 1200 };
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError('ANTHROPIC_API_KEY não configurada no servidor.');
  const client = new Anthropic();
  try {
    const { system, user } = writerPrompt(i);
    const w = await client.beta.messages.create({
      model: AI_MODEL, max_tokens: 16000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      system, output_config: { effort: 'medium' }, messages: [{ role: 'user', content: user }],
    });
    if (w.stop_reason === 'refusal') throw new AiError('A IA recusou escrever este roteiro.');
    if (w.stop_reason === 'max_tokens') throw new AiError('O roteiro ficou grande demais. Tente de novo.', true);
    const markdown = textOf(w);
    if (markdown.length < 80) throw new AiError('A IA devolveu um roteiro vazio. Tente de novo.', true);

    // cópia para os campos: modelo rápido, sem reescrever o texto
    const x = await client.beta.messages.create({
      model: AI_LIGHT_MODEL, max_tokens: 16000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      system: EXTRACT_SYSTEM, output_config: { effort: 'low', format: { type: 'json_schema', schema: EXTRACT_SCHEMA } },
      messages: [{ role: 'user', content: `ROTEIRO:\n\n${markdown}` }],
    });
    if (x.stop_reason === 'max_tokens') throw new AiError('Não foi possível organizar o roteiro. Tente de novo.', true);
    const raw = JSON.parse(textOf(x)) as Extracted;
    const data = toData(raw, i.seconds, markdown);
    if (!data.parts.length) throw new AiError('Não foi possível organizar o roteiro em blocos. Tente de novo.', true);
    // o modelo rápido custa menos: soma convertida para o preço do modelo principal (Sonnet ≈ metade do Opus)
    const a = usageOf(w.usage), b = usageOf(x.usage);
    return { title: clean(raw.title, 90) || 'Roteiro', data, inputTokens: a.inputTokens + Math.round(b.inputTokens / 2), outputTokens: a.outputTokens + Math.round(b.outputTokens / 2) };
  } catch (e) { return fail(e); }
}

const REFINE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['title', 'parts', 'caption', 'hashtags', 'note'],
  properties: {
    title: STR,
    parts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['speech', 'on_screen', 'visual'], properties: { speech: STR, on_screen: STR, visual: STR } } },
    caption: STR, hashtags: { type: 'array', items: STR }, note: STR,
  },
};

export type RefineScriptInput = {
  title: string; data: ScriptData; previous?: { title: string; data: ScriptData };
  /** Instruções de cada parte do formato (na ordem; vazio se o formato não existe mais). */
  instructions: string[]; formatName: string; seconds: number; platform: Platform; angle: string;
  feedback: string;
  /** Índice da parte a refinar (as outras ficam como estão); "caption" = só a legenda e as hashtags; nulo = o roteiro inteiro. */
  scope: number | 'caption' | null; brand: BrandProfile;
};

/** Refina um roteiro já gerado (a versão que está na tela) a partir de um feedback. Não grava: o usuário aprova antes. */
export async function refineVideoScript(i: RefineScriptInput): Promise<{ title: string; data: ScriptData; note: string }> {
  const n = i.data.parts.length;
  const build = (parts: { speech: string; on_screen: string; visual: string }[], title: string, caption: string, hashtags: string[]): ScriptData => ({
    parts: i.data.parts.map((p, k) => (i.scope !== null && i.scope !== k ? p : { ...p, speech: clean(parts[k]?.speech, 1200), onScreen: clean(parts[k]?.on_screen, 160), visual: clean(parts[k]?.visual, 400) })),
    caption: clean(caption, 1200) || i.data.caption, hashtags: hashtags.map((h) => clean(h, 40).replace(/^#/, '').replace(/\s+/g, '')).filter(Boolean).slice(0, 8), notes: i.data.notes, ...(i.data.production ? { production: i.data.production } : {}),
  });
  if (process.env.AI_MOCK === '1') {
    await new Promise((r) => setTimeout(r, 600));
    if (i.scope === 'caption') return { title: i.title, data: { ...i.data, caption: `${i.data.caption} (refinada: ${i.feedback.slice(0, 30)})` }, note: 'Versão simulada (AI_MOCK=1).' };
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
- "parts" deve ter EXATAMENTE ${n} itens, na mesma ordem. ${i.scope === 'caption' ? 'NÃO mude nenhuma parte: devolva todas as partes exatamente como estão. Só a "caption" (legenda) e as "hashtags" devem mudar.' : i.scope !== null ? `Só a PARTE ${i.scope + 1} deve mudar: devolva as outras partes exatamente como estão.` : 'Você pode ajustar qualquer parte que o pedido atingir, mantendo a sequência fluida.'}
- Respeite o limite de palavras de fala de cada parte (o vídeo tem de caber em ${i.seconds} s) e as instruções da parte, quando houver.
- Português do Brasil, linguagem FALADA: frases curtas, ritmo de conversa. NÃO invente fatos, números, datas, nomes ou fontes: use só o que já está no roteiro ou no pedido. Respeite o tom e as regras da marca; evite clichês de IA e de vídeo.
- Fala e tela se complementam: não peça para a pessoa "ler" o que a tela já diz. "on_screen": até 6 palavras, ou "" se não houver.
- Se houver "SUGESTÃO ANTERIOR (não aprovada)", parta dela e aplique o novo pedido, sem desfazer o que já estava bom.
- "title" (até 70 caracteres), "caption" e "hashtags" (sem "#"): mantenha como estão, a menos que o pedido os atinja.
- "note": uma frase curta dizendo o que você mudou.`,
  ].filter(Boolean).join('\n\n');
  const user = [`ROTEIRO ATUAL:\n${show(i.title, i.data)}`, i.previous ? `SUGESTÃO ANTERIOR (não aprovada):\n${show(i.previous.title, i.previous.data)}` : '', `PEDIDO DO USUÁRIO${i.scope === 'caption' ? ' (só sobre a legenda e as hashtags)' : i.scope !== null ? ` (só sobre a parte ${i.scope + 1})` : ''}:\n${i.feedback}`].filter(Boolean).join('\n\n');
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
    const out = build(raw.parts, clean(raw.title, 80), raw.caption ?? '', raw.hashtags ?? i.data.hashtags);
    // só a legenda e as hashtags: título e partes ficam exatamente como estavam (garantia no código)
    if (i.scope === 'caption') return { title: i.title, data: { ...i.data, caption: out.caption, hashtags: out.hashtags }, note: clean(raw.note, 300) };
    return { title: clean(raw.title, 80) || i.title, data: out, note: clean(raw.note, 300) };
  } catch (e) {
    if (e instanceof SyntaxError) throw new AiError('A IA devolveu uma resposta inválida.', true);
    return fail(e);
  }
}
