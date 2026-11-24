import Anthropic from '@anthropic-ai/sdk';
import { AI_MODEL, AiError, STYLE_TICS, brandBlock, type BrandProfile } from './generate';
import { MULTI_AUDIENCE } from './carousel';
import { MAX_CONTENT_CHARS, MAX_PARTS, PLATFORMS, allocate, countWords, wordsFor, type Platform, type ScriptData, type VideoIdea, type VideoPart } from '../video';

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
// estrutura livre: a IA escolhe a forma (structure vem primeiro), os blocos e os tempos; produção e legenda vêm depois do roteiro pronto
const FREE_SCRIPT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['structure', 'title', 'parts', 'production', 'caption', 'hashtags', 'to_verify'],
  properties: {
    structure: STR, title: STR,
    parts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'seconds', 'speech', 'on_screen', 'visual'], properties: { name: STR, seconds: { type: 'integer' }, speech: STR, on_screen: STR, visual: STR } } },
    production: { type: 'object', additionalProperties: false, required: ['rhythm', 'sources', 'short_version'], properties: { rhythm: STR, sources: { type: 'array', items: STR }, short_version: STR } },
    caption: STR, hashtags: { type: 'array', items: STR }, to_verify: { type: 'array', items: STR },
  },
};
const SCRIPT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['title', 'parts', 'caption', 'hashtags', 'to_verify'],
  properties: {
    // as partes vêm antes da legenda: ela é escrita depois do roteiro pronto e fecha com a mesma ação da fala
    title: STR,
    parts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['speech', 'on_screen', 'visual'], properties: { speech: STR, on_screen: STR, visual: STR } } },
    caption: STR, hashtags: { type: 'array', items: STR }, to_verify: { type: 'array', items: STR },
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
  const fmt = !i.format.parts.length ? freeStructure(i.seconds) : i.format.parts.map((p, k) =>
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

/** Estrutura livre: a IA escolhe a forma a partir do conteúdo, em vez de preencher partes fixas. */
function freeStructure(seconds: number) {
  return `ESTRUTURA: VOCÊ ESCOLHE (não há partes fixas)
Leia o conteúdo e escolha a forma que melhor o conta em ${seconds} s. Formas que funcionam (combine se fizer sentido):
- DADOS QUE IMPACTAM: gancho com o dado mais forte → o problema em números → o que está por trás → virada → convite. Para conteúdo com estatísticas.
- LISTA RÁPIDA: gancho → um item por bloco curto (3 a 6 s), com a palavra-chave do item na tela → fecho → convite. Para conteúdo que já é uma lista (barreiras, passos, erros, sinais, mitos).
- HISTÓRIA: uma cena do conteúdo (ou exemplo claramente hipotético) → conflito → virada → o que muda → convite. Só quando o conteúdo tem ou pede uma pessoa e uma cena; não invente personagem para conteúdo de dados ou de lista.
- MITO x VERDADE, ANTES x DEPOIS, PERGUNTA E RESPOSTA.
Regras da estrutura:
- De 4 a 8 blocos. Cada bloco tem um nome curto que diz o que ele faz (ex.: "Gancho", "O problema em números", "Barreira 1: direção", "Virada", "Convite"), os segundos e uma fala que caiba neles (~${WORDS_PER_SEC_TXT} palavras por segundo).
- A soma dos segundos é ${seconds}. O gancho tem de 3 a 6 s. Os blocos têm o tamanho do que precisam dizer (não divida o tempo por igual).
- "structure": antes dos blocos, em 1 ou 2 frases, a forma escolhida e por quê.
- "production": "rhythm" = ritmo de cortes e de legendas na tela (ex.: corte a cada 3 a 5 s; legendas sempre visíveis, porque a maioria assiste sem som); "sources" = a fonte de cada número citado, como aparece no conteúdo (para o rodapé da tela; lista vazia se não houver número); "short_version" = como fazer a versão de 30 s (o que fica e o que sai).`;
}
const WORDS_PER_SEC_TXT = '2,5';

const RULES = `REGRAS GERAIS
- Português do público (do Brasil, salvo IDIOMA DO PÚBLICO), linguagem FALADA: frases curtas, ritmo de conversa, sem jargão e sem "leitura de texto". Escreva como a pessoa fala olhando para a câmera.
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

/** Passo 2: escreve o roteiro de UMA ideia. Com estrutura livre (formato sem partes), a IA escolhe os blocos e os tempos; com formato fixo, segue as partes dele. */
export async function generateVideoScript(i: VideoCommon & { idea: VideoIdea; /** Perfil da persona (texto) quando o roteiro nasce de uma ideia de conteúdo. */ personaBrief?: string; /** A ideia é para várias personas (público amplo): personaBrief traz todos os perfis. */ multiPersona?: boolean }): Promise<{ title: string; data: ScriptData; inputTokens: number; outputTokens: number }> {
  const free = !i.format.parts.length;
  const secs = allocate(i.format.parts, i.seconds);
  type RawPart = { name?: string; seconds?: number; speech: string; on_screen: string; visual: string };
  const cleanTags = (h: string[]) => h.map((x) => clean(x, 40).replace(/^#/, '').replace(/\s+/g, '')).filter(Boolean).slice(0, 8);
  const toData = (parts: RawPart[], caption: string, hashtags: string[], notes: string[], production?: { rhythm?: string; sources?: string[]; short_version?: string }): ScriptData => {
    // estrutura livre: os tempos da IA viram pesos e são ajustados para somar exatamente a duração pedida
    const list = free ? parts.slice(0, MAX_PARTS) : i.format.parts.map((_, k) => parts[k] ?? { speech: '', on_screen: '', visual: '' });
    const s2 = free ? allocate(list.map((p) => ({ percent: Math.max(1, Number(p.seconds) || 1) })), i.seconds) : secs;
    return {
      parts: list.map((p, k) => ({ name: free ? clean(p.name, 40) || `Bloco ${k + 1}` : i.format.parts[k].name, seconds: s2[k], speech: clean(p.speech, 1200), onScreen: clean(p.on_screen, 160), visual: clean(p.visual, 400) })),
      caption: clean(caption, 1200), hashtags: cleanTags(hashtags),
      notes: notes.map((n) => clean(n, 300)).filter(Boolean).slice(0, 10),
      ...(production ? { production: { rhythm: clean(production.rhythm, 400), sources: (production.sources ?? []).map((x) => clean(x, 200)).filter(Boolean).slice(0, 8), shortVersion: clean(production.short_version, 500) } } : {}),
    };
  };
  if (process.env.AI_MOCK === '1') {
    await new Promise((r) => setTimeout(r, 700 + Math.random() * 900));
    if (/erro/i.test(i.idea.title)) throw new AiError('Erro simulado (a ideia continha "erro").');
    const names = free ? ['Gancho', 'O problema', 'O que está por trás', 'Virada', 'Convite'] : i.format.parts.map((p) => p.name);
    const parts = names.map((n, k) => ({ name: n, seconds: 10, speech: `Fala de exemplo do bloco ${n.toLowerCase()}.`, on_screen: n.toUpperCase(), visual: `Plano ${k + 1}: close no rosto, fundo neutro.` }));
    return { title: (i.idea.title || 'Roteiro de exemplo').slice(0, 80), data: toData(parts, 'Legenda de exemplo.', ['exemplo'], ['Confira os dados citados antes de publicar.'], free ? { rhythm: 'Corte a cada 3 a 5 s.', sources: [], short_version: 'Gancho e convite.' } : undefined), inputTokens: 2000, outputTokens: 900 };
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError('ANTHROPIC_API_KEY não configurada no servidor.');
  const role = free
    ? 'Você é um roteirista sênior de vídeos curtos (Reels, TikTok e Shorts). Você lê o conteúdo, escolhe a estrutura que melhor o conta e escreve um roteiro pronto para gravar, bloco por bloco, com orientações de produção, em JSON estrito.'
    : 'Você é um roteirista sênior de vídeos curtos (Reels, TikTok e Shorts). Você escreve roteiros prontos para gravar, parte por parte, em JSON estrito.';
  // conteúdo que nasce de uma ideia de conteúdo (com ou sem persona): a IA recebe o mapa dos campos da ideia
  const isIdea = !!i.personaBrief || /^IDEIA DE CONTE[ÚU]DO/i.test(i.content.trim());
  const extra = `${RULES}

TAREFA: ESCREVER O ROTEIRO
${free
    ? `- "parts": os blocos que você escolheu (veja ESTRUTURA), na ordem, cada um com "name", "seconds", "speech", "on_screen" e "visual". O vídeo tem de caber em ${i.seconds} s.`
    : `- "parts" deve ter EXATAMENTE ${i.format.parts.length} itens, na mesma ordem das partes do formato. Cada parte segue as instruções dela.`}
- "speech": a fala daquele trecho, dentro do limite de palavras (não ultrapasse: o vídeo tem de caber em ${i.seconds} s). A primeira frase do vídeo precisa prender em até 3 segundos.
- "on_screen": texto curto na tela (até 6 palavras, em caixa normal; numa lista rápida, a palavra-chave do item), ou "" se não houver.
- "visual": o que aparece/acontece na tela naquele trecho (enquadramento, b-roll, gráfico, número entrando, ação), concreto e fácil de gravar, em uma frase.
- "title": título interno do vídeo (até 70 caracteres). "caption": legenda para publicar, escrita DEPOIS das partes: complementa a fala (não a repete) e a ÚLTIMA frase é o convite da parte final, com a mesma ação e o mesmo destinatário (uma legenda que termina sem pedir nada está errada). "hashtags": sem o "#".
- FALA DE VERDADE: escreva como a pessoa fala olhando para a câmera, no português do dia a dia do público (no Brasil: "a gente", "pra", "tá"; se houver IDIOMA DO PÚBLICO, a forma de lá): frases de 4 a 12 palavras, uma ideia por frase, sem ponto e vírgula, sem parênteses e sem palavras de texto escrito ("ademais", "contudo", "visto que", "nesse sentido"). Leia em voz alta mentalmente: se travar, reescreva.
- GANCHO: a primeira frase já é o dado, a cena ou a contradição mais forte. Nada de "Deixa eu te contar", "Presta atenção", "E aí tudo muda" nem pergunta genérica (uma pergunta concreta depois do dado vale).
- DADOS: os números do conteúdo-fonte são bem-vindos; use os que dão força ao vídeo (vários, se o vídeo é sobre dados). Diga cada número uma vez, explicando o que ele mede, e não apresente o mesmo dado de dois jeitos como se fossem dois (ex.: "1 em cada 3" e "32%" são o mesmo). Nunca invente número, fonte ou ano.
- CTA: a parte final pede UMA ação só. Se o conteúdo traz uma CTA (ex.: a CTA da ideia ou um pedido do material, como "precisamos de mentores"), use essa ação e esse destinatário, em fala natural, de forma DIRETA; a CTA padrão da marca só entra quando o conteúdo não pede nada. Não troque por "me segue", "deixa o like" ou "comenta aí". A legenda fecha com a MESMA ação e o mesmo verbo.
- PÚBLICO COERENTE: o convite fala com quem o vídeo vinha falando. Se o convite for para outro público (ex.: o vídeo fala dos jovens e o convite é para mentores), prepare isso antes, na virada ("quem já trabalha sabe…").
- PROGRESSÃO: cada trecho traz informação nova. Nenhum trecho repete o anterior, e o texto na tela de um trecho não antecipa a fala do próximo.
- "on_screen" reforça a fala com outra informação curta (a palavra-chave, o número, o passo), não a mesma frase.
- CONTINUIDADE: quem aparece na história é apresentado antes de ser retomado. Quem assiste não tem o conteúdo-fonte.
- UMA ação só no fim (fala e legenda): não some "manda pra alguém" com "fala com a gente".

${STYLE_TICS}${isIdea ? `

COMO USAR A IDEIA DE CONTEÚDO (o conteúdo-fonte é uma ideia estruturada: dor, impacto, causa, guia, argumentos, ganho, desejo, CTA)
- ${free ? 'Escolha a estrutura que melhor conta esta ideia e distribua por ela' : 'Distribua a história pelas partes do formato'}, com começo, meio e fim claros: a dor (cena ou dado), o impacto, a causa explicada em linguagem simples, os argumentos, o ganho e o desejo, e o convite (CTA). Se há poucos blocos, comprima, mas preserve esse arco.
- DIDÁTICO: explique como para um amigo que não entende do assunto. Cada frase leva à próxima (porque, por isso, aí, então). Termo difícil: explique na hora ou troque.
- OS ARGUMENTOS: são razões que sustentam a solução da dor, não um passo a passo, e você não precisa usar todos. Ou desenvolva o mais forte como uma pequena cena (uma pessoa, um momento, o que ela faz e o que muda), ou, numa lista rápida, um argumento por bloco; em qualquer caso, cada um diz algo concreto (o que acontece de verdade), nunca só uma palavra abstrata ou um verbo vago (aproximar, acompanhar, fortalecer, conectar, engajar). Exemplo que não está na ideia é apresentado como exemplo ("imagina um jovem que…"), sem nomes reais, números nem datas.
- CONCRETO: nada de abstrações soltas (transparência, repasse, sistema, equidade). Mostre ações e situações do dia a dia de quem assiste, com as palavras que essa pessoa usa.
- QUEM ASSISTE: com persona, fale com ela em segunda pessoa do começo ao fim: a cena é a vida dela (o nome do perfil nunca aparece). Sem persona ("público geral"), fale com quem assiste ou conte a cena em terceira pessoa e, no fim, fale direto com quem a CTA da ideia convoca.
- O GUIA é só bússola: não narre a metáfora do guia nem diga "valor" ou "enquadramento". Só use imagem que seja do universo de quem assiste.
- NÃO invente números, valores nem datas: use só os que estão na ideia; sem dado, fale em termos qualitativos.` : ''}${i.personaBrief && i.multiPersona ? `

${MULTI_AUDIENCE}

PERFIS DAS PERSONAS QUE VÃO ASSISTIR (o público é o conjunto; use-os como referência, não fale com uma só):
${i.personaBrief}` : i.personaBrief ? `

PERSONA QUE VAI ASSISTIR (fale com ela, no jeito dela):
${i.personaBrief}` : ''}`;
  const ideaText = i.idea.title.trim()
    ? `IDEIA DESTE VÍDEO\nTítulo: ${i.idea.title}\nÂngulo: ${i.idea.angle}${i.idea.points.length ? `\nPontos a usar:\n${i.idea.points.map((p) => `- ${p}`).join('\n')}` : ''}`
    : 'IDEIA DESTE VÍDEO: não foi definida. Faça um vídeo só, com o recorte mais forte do conteúdo-fonte (o que mais faz quem assiste parar, entender e agir).';
  type Raw = { structure?: string; title?: string; parts?: RawPart[]; production?: { rhythm?: string; sources?: string[]; short_version?: string }; caption?: string; hashtags?: string[]; to_verify?: string[] };
  const call = async () => {
    const res = await new Anthropic().beta.messages.create({
      model: AI_MODEL, max_tokens: 10000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      system: systemBlocks(i, role, extra),
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: free ? FREE_SCRIPT_SCHEMA : SCRIPT_SCHEMA } },
      messages: [{ role: 'user', content: ideaText }],
    });
    if (res.stop_reason === 'refusal') throw new AiError('A IA recusou escrever este roteiro.');
    if (res.stop_reason === 'max_tokens') throw new AiError('A resposta ficou grande demais. Tente de novo.', true);
    return { raw: JSON.parse(textOf(res)) as Raw, usage: usageOf(res.usage) };
  };
  // às vezes a resposta volta com a legenda (ou a versão curta) em branco: tenta mais uma vez antes de entregar incompleto
  const incomplete = (r: Raw) => !Array.isArray(r.parts) || !r.parts.length || !String(r.caption ?? '').trim() || (free && !String(r.production?.short_version ?? '').trim());
  try {
    let { raw, usage } = await call();
    if (incomplete(raw)) {
      const again = await call();
      usage = { inputTokens: usage.inputTokens + again.usage.inputTokens, outputTokens: usage.outputTokens + again.usage.outputTokens };
      if (!incomplete(again.raw) || (Array.isArray(again.raw.parts) && again.raw.parts.length)) raw = again.raw;
    }
    if (!Array.isArray(raw.parts) || raw.parts.length < 1) throw new AiError('A IA devolveu um roteiro vazio.', true);
    const data = toData(raw.parts, raw.caption ?? '', raw.hashtags ?? [], [], free ? raw.production : undefined);
    // palavras demais para o tempo de um bloco: avisa (o editor mostra a contagem)
    const over = data.parts.filter((p) => countWords(p.speech) > wordsFor(p.seconds) + 2).map((p) => p.name);
    data.notes = [
      ...(free && clean(raw.structure, 300) ? [`Estrutura: ${clean(raw.structure, 300)}`] : []),
      ...(!free && raw.parts.length !== i.format.parts.length ? [`A IA devolveu ${raw.parts.length} partes e o formato tem ${i.format.parts.length}. Confira.`] : []),
      ...(over.length ? [`Fala acima do tempo em: ${over.join(', ')}. Encurte ou aumente a duração.`] : []),
      ...(raw.to_verify ?? []).map((t) => `Conferir: ${t}`),
    ].map((n) => clean(n, 320)).filter(Boolean).slice(0, 10);
    return { title: clean(raw.title, 80) || i.idea.title.slice(0, 80) || 'Roteiro', data, ...usage };
  } catch (e) {
    if (e instanceof SyntaxError) throw new AiError('A IA devolveu uma resposta inválida.', true);
    return fail(e);
  }
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
