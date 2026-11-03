import Anthropic from '@anthropic-ai/sdk';
import { AI_MODEL, AiError, brandBlock, type BrandProfile } from './generate';
import type { PersonaData } from '../persona';
import { IDEA_OBJECTIVES, MAX_IDEAS_PER_RUN, type IdeaFields } from '../idea';

export type SuggestedIdea = IdeaFields;
const KEYS = ['pain', 'impact', 'cause', 'guide', 'args', 'gain', 'desire', 'cta'] as const;

const STR = { type: 'string' } as const;
const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['ideas'],
  properties: {
    ideas: { type: 'array', items: { type: 'object', additionalProperties: false, required: [...KEYS], properties: Object.fromEntries(KEYS.map((k) => [k, STR])) } },
  },
};

const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '');
const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

const SYSTEM = `Você é um estrategista de comunicação sênior, formado em enquadramento (framing) cognitivo à maneira de George Lakoff. Você cria IDEIAS DE CONTEÚDO em português do Brasil, a partir de um TERRITÓRIO (um tema do mapa de conteúdo, às vezes um debate coletivo e macro) e de uma PERSONA. Quando houver a TRADUÇÃO do tema para a persona, ela é a ponte: parta dela para que a dor seja a forma como ESSA persona vive o tema, sem perder a causa coletiva.

ESTRUTURA DE CADA IDEIA (todos os campos são obrigatórios; juntos contam uma história: da dor ao convite)
1. "pain" — a DOR, em LINGUAGEM DE RUA: como a própria pessoa diria, em 1 ou 2 frases, de boca, no ônibus, no zap, na fila. Concreta, cotidiana, sem jargão, sem "marketês" e sem termo técnico. Pode ter gíria leve e o jeito de falar da persona, sem caricatura nem deboche. Nada de "a persona sente que…": é a fala dela.
2. "impact" — o IMPACTO: o que essa dor faz na vida dela, em 1 ou 2 frases concretas (contas, saúde, família, tempo, auto-estima). Mostre a consequência sentida, sem números inventados.
3. "cause" — a CAUSA: por que isso acontece, em 1 ou 2 frases. Aponte a raiz coletiva ou estrutural (como o sistema, o mercado, a falta de informação ou de apoio funcionam), nunca a culpa da pessoa. Só afirme o que você pode afirmar com segurança.
4. "guide" — o GUIA: o ENQUADRAMENTO progressista que conduz a conversa. Em 1 a 3 frases, diga (a) o valor moral que organiza a ideia (cuidado e proteção, empatia, responsabilidade de uns com os outros, equidade, dignidade, liberdade com condições reais, bem comum, cooperação) e (b) a imagem, metáfora ou cena que torna esse valor visível (ex.: "a comunidade como uma casa que todos ajudam a manter"). Regras do enquadramento:
   - Fale a partir do SEU enquadramento. NÃO repita o enquadramento do outro lado, nem para negá-lo ("não é que…"): quem nega um frame o reforça (não pense num elefante).
   - Comece pelos valores compartilhados e pela experiência vivida da pessoa, não por estatísticas nem por jargão de política pública.
   - Mostre quem cuida de quem, quem protege e quem é responsável, em vez de culpar a pessoa. A dor é compartilhada e tem causa coletiva.
   - Prefira verbos e imagens concretas a abstrações.
5. "args" — os ARGUMENTOS: de 2 a 4 itens (um por linha, separados por quebra de linha, sem numeração nem marcadores) que SUSTENTAM A SOLUÇÃO da dor, isto é, as razões pelas quais sair dela é possível e o caminho proposto funciona. NÃO é passo a passo nem sequência de ações: cada argumento é uma razão independente, uma frase afirmativa e concreta que pode virar uma fala, um slide ou um ponto do roteiro (por que isso funciona, o que muda na prática, o que se evita, por que dá para confiar). Os argumentos devem ser DIFERENTES entre si (por exemplo, um prático, um de confiança ou prova, um de custo-benefício, um de proteção), coerentes com a causa e com o guia, e ligados, de forma natural, ao que a ORGANIZAÇÃO faz ou ensina. Sem inventar leis, números, prazos ou programas: se precisar de um dado que não tem certeza, escreva "[checar dado]".
6. "gain" — o GANHO: o resultado RACIONAL de a dor ser resolvida, em 1 ou 2 frases. É o que dá para medir ou ver no mundo real (dinheiro, tempo, segurança, direito garantido, contas que fecham) e normalmente é o OPOSTO do impacto: se o impacto era "sobra pouco no fim do mês", o ganho é "sobra dinheiro no fim do mês". Concreto, sem promessa milagrosa e sem número inventado.
7. "desire" — o DESEJO: o resultado EMOCIONAL de a dor estar resolvida, em 1 frase: como a pessoa se sente quando o problema acaba (tranquila, respeitada, orgulhosa, segura, livre, em paz com a família). É o sentimento, não o resultado prático: o ganho é a razão, o desejo é a emoção.
8. "cta" — a CTA: o convite final, em 1 frase, que pede UMA ação concreta e é o PRIMEIRO DEGRAU do caminho que a ideia propõe (coerente com os argumentos e com o OBJETIVO indicado). Estratégia da CTA:
   - Escolha a ação pelo momento da pessoa: quem acabou de perceber o problema ainda não está pronto para doar ou se inscrever; peça um passo proporcional (guardar, compartilhar, conversar, conhecer) e só peça um compromisso maior (doar, se inscrever, ser voluntário) quando a ideia e o objetivo já levarem até lá.
   - Comece com um verbo no imperativo e diga a ação e o porquê em poucas palavras (ex.: "Mande para quem está procurando a primeira vaga: ele pode não saber que a mentoria existe.").
   - Só convide para o que a ORGANIZAÇÃO realmente faz ou oferece (veja a identidade da marca); não invente programas, links, prazos nem benefícios.
   - A CTA não depende do canal (nada de "link na bio" ou "comente QUERO"): a mecânica do canal é decidida depois, quando virar post ou roteiro.
   - Evite convites genéricos e vazios ("curta e compartilhe", "saiba mais") e tom de venda agressivo ("compre já", "clique agora").

CLAREZA E DIDÁTICA (vale para todos os campos)
- Escreva para quem NÃO entende do assunto: explique como se fosse para um amigo na mesa do bar. Nada de abstração solta: troque palavras como "transparência", "equidade", "repasse", "sistema", "estrutura" por situações, ações e coisas que dá para ver.
- Toda palavra técnica ou difícil precisa vir com uma explicação simples na mesma frase, ou ser trocada.
- Os campos formam um fio com começo, meio e fim: a DOR mostra a cena; o IMPACTO mostra o que ela custa; a CAUSA explica COMO a coisa funciona, passo a passo, de causa a efeito ("primeiro..., aí..., por isso..."); os ARGUMENTOS mostram por que a solução funciona (cada um, uma razão concreta e diferente das outras); o GANHO mostra o resultado prático (o oposto do impacto) e o DESEJO, o sentimento de ter a dor resolvida; a CTA fecha. Cada campo deve se apoiar no anterior, sem salto.
- Use exemplos do dia a dia da persona (o trabalho dela, o lugar, as contas dela), não exemplos genéricos.
- NÃO invente números, valores, percentuais, datas nem fontes (nem na dor, nem no impacto). Sem dado real no perfil ou no pedido, fale em termos qualitativos ("uma parte grande da corrida", "quase tudo que sobra").
- O GUIA é a bússola da ideia: orienta o valor e as palavras, e a imagem dele deve vir do universo da própria persona (o volante, a corrida, a feira dela), nunca de um mundo que ela não vive.

REGRAS GERAIS
- Cada ideia ataca UM ângulo diferente do território e uma dor diferente. Nada de ideias parecidas entre si nem repetidas das já existentes (você recebe a lista, da mesma persona e do mesmo território): não repita dor, ângulo, cena, imagem do guia nem CTA, e prefira ocupar lacunas que ainda não foram cobertas.
- Fique no território indicado e na persona indicada. Ligue ao que a ORGANIZAÇÃO faz (veja a identidade da marca) de forma natural.
- Respeite o tom de voz e as regras da marca. Evite clichês de IA ("mergulhe", "desvende", "no mundo de hoje").
- Não ataque pessoas nem grupos; o foco é a dor real e o caminho de cuidado e solução.`;

/** Objetivo das ideias: fixo (o escolhido) ou a IA decide por ideia. */
function objectiveBlock(id: string | undefined, hasPersona: boolean, n: number): string {
  const o = IDEA_OBJECTIVES.find((x) => x.id === id && x.id !== 'auto');
  if (o) return `OBJETIVO ${n > 1 ? 'DAS IDEIAS' : 'DA IDEIA'} (a CTA e os argumentos devem servir a ele):\n${o.guide}`;
  return `OBJETIVO: escolha o melhor para ${n > 1 ? 'cada ideia' : 'a ideia'}, entre conscientizar, engajar, aproximar (captar contato), apoiar (doar/patrocinar) e participar (voluntariar-se/inscrever-se), pelo momento da ${hasPersona ? 'persona' : 'pessoa em geral'}, pelo território e pelos argumentos.${n > 1 ? ' Varie o objetivo entre as ideias quando fizer sentido.' : ''}${hasPersona ? '' : ' Sem persona definida, prefira objetivos de conscientizar e engajar.'} Deixe a CTA coerente com o objetivo escolhido.`;
}

/** Quando a ideia nasce de um território sem persona, não há alguém falando: a dor é um fato, não uma fala. */
const NO_PERSONA_RULES = `

IDEIA SEM PERSONA (esta regra SUBSTITUI a da "dor em linguagem de rua" e qualquer fala em primeira pessoa)
- Não existe uma pessoa específica falando. Por isso, a "pain" NÃO é fala em primeira pessoa, não usa "eu", "meu", "a gente" nem aspas de depoimento. A "pain" é uma AFIRMAÇÃO (statement) clara e concreta sobre a situação: um fato do mercado, da sociedade ou do território em si, em terceira pessoa ou de forma impessoal. Ex.: "Quase tudo que um jovem ganha no primeiro emprego vai para o aluguel e o transporte." Em 1 ou 2 frases, linguagem simples, sem jargão, sem número inventado (se precisar de um dado, escreva "[checar dado]").
- "impact", "cause", "gain" e "desire" também ficam impessoais ou falam de "quem...", "as famílias...", "os jovens..." (nunca "eu" ou "minha"). O "desire" é o sentimento de quem passa por isso quando o problema acaba, descrito de fora.
- "guide" e "args" seguem as regras normais. A "cta" convida o público em geral (ex.: "Compartilhe com quem precisa saber disso", "Conheça o caminho"), sem supor uma persona.`;

export function personaBlock(p: { name: string; tagline: string; role: string; data: PersonaData }) {
  const L = (t: string, a: string[]) => (a.length ? `\n- ${t}: ${a.join('; ')}` : '');
  return `PERSONA: ${p.name}${p.role ? ` (${p.role})` : ''}\nResumo: ${p.tagline}\nContexto: ${p.data.bio}${L('Objetivos', p.data.goals)}${L('Dores', p.data.pains)}${L('Objeções', p.data.objections)}${L('Gatilhos', p.data.triggers)}`;
}

/** Ideia já criada, mostrada à IA para ela não repetir e complementar. */
export type ExistingIdea = { pain: string; guide: string; cta: string; persona: string; territory: string; /** same = mesma persona e território; persona = só a persona; territory = só o território */ scope: 'same' | 'persona' | 'territory' };

const clip = (t: string, n: number) => { const x = t.replace(/\s+/g, ' ').trim(); return x.length > n ? `${x.slice(0, n)}…` : x; };

/** Lista das ideias que já existem (da mesma persona e/ou do mesmo território), agrupadas por proximidade. */
export function existingBlock(list: ExistingIdea[], hasPersona: boolean, hasTerritory: boolean): string {
  if (!list.length) return '';
  const groups: [ExistingIdea['scope'], string][] = [
    ['same', hasPersona && hasTerritory ? 'MESMA PERSONA E MESMO TERRITÓRIO' : hasPersona ? 'MESMA PERSONA' : hasTerritory ? 'MESMO TERRITÓRIO, SEM PERSONA' : 'SEM PERSONA'],
    ['persona', 'MESMA PERSONA, OUTROS TERRITÓRIOS'],
    ['territory', 'MESMO TERRITÓRIO, OUTRAS PERSONAS'],
  ];
  const parts = groups.map(([k, title]) => {
    const rows = list.filter((x) => x.scope === k);
    if (!rows.length) return '';
    return `[${title}]\n${rows.map((x) => `- Dor: ${clip(x.pain, 170)}${x.guide ? ` | Guia: ${clip(x.guide, 130)}` : ''}${x.cta ? ` | CTA: ${clip(x.cta, 110)}` : ''}${k !== 'same' ? ` | (${[k === 'territory' ? x.persona : '', k === 'persona' ? x.territory : ''].filter(Boolean).join(' · ') || '—'})` : ''}`).join('\n')}`;
  }).filter(Boolean);
  return `IDEIAS JÁ CRIADAS${hasPersona ? ' PARA ESTA PERSONA' : ''}${hasPersona && hasTerritory ? ' E' : ''}${hasTerritory ? ' PARA ESTE TERRITÓRIO' : ''}. Leia tudo antes de escrever e crie ideias NOVAS que COMPLEMENTEM o conjunto:\n- não repita a mesma dor, o mesmo ângulo, a mesma cena nem a mesma imagem/metáfora do guia;\n- varie também a CTA (outra ação, outro convite) em relação às já usadas;\n- procure o que ainda NÃO foi coberto (outro momento, outra consequência, outra causa, outro argumento);\n- as do mesmo território com outras personas mostram o que já foi dito sobre o tema: traga o que é específico desta persona.\n\n${parts.join('\n\n')}`;
}

export type SuggestIdeasArgs = {
  /** Nulo = público geral (sem persona). */
  persona: { name: string; tagline: string; role: string; data: PersonaData } | null;
  icp: string;
  brand: BrandProfile;
  /** Território de origem: caminho até ele e o que há dentro dele. */
  territory: { path: string[]; description: string; children: string[]; /** Como o tema aparece na vida desta persona (se já foi traduzido). */ translation?: string } | null;
  /** Dores das ideias que já existem para este território/persona. */
  existingPains: string[];
  /** Ideias já criadas da mesma persona e/ou território (contexto para não repetir e complementar). */
  existing?: ExistingIdea[];
  count: number;
  instructions: string;
  /** Objetivo da ideia (id de IDEA_OBJECTIVES); vazio ou "auto" = a IA escolhe, ideia por ideia. */
  objective?: string;
};

/** Sugere ideias de conteúdo. Não grava nada: o usuário aprova antes. */
export async function suggestIdeas(a: SuggestIdeasArgs): Promise<{ ideas: SuggestedIdea[]; inputTokens: number; outputTokens: number }> {
  const n = Math.min(MAX_IDEAS_PER_RUN, Math.max(1, Math.round(a.count)));
  if (process.env.AI_MOCK === '1') {
    await new Promise((r) => setTimeout(r, 700));
    return { ideas: Array.from({ length: n }, (_, i) => ({ pain: `"Dor de exemplo ${i + 1}, falada do jeito da rua."`, impact: 'Impacto de exemplo.', cause: 'Causa coletiva de exemplo.', guide: 'Cuidado como valor: uma comunidade que se protege.', args: 'Argumento 1\nArgumento 2\nArgumento 3', gain: 'Ganho de exemplo.', desire: 'Desejo de exemplo.', cta: 'Compartilhe com quem passa por isso.' })), inputTokens: 1200, outputTokens: 900 };
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError('ANTHROPIC_API_KEY não configurada no servidor.');

  const user = [
    a.persona ? personaBlock(a.persona) : `PÚBLICO GERAL (sem persona específica).\nICP DA MARCA:\n${a.icp.trim() || '(não informado)'}`,
    a.territory
      ? `TERRITÓRIO: ${a.territory.path.join(' › ')}${a.territory.description ? `\nO que entra aqui: ${a.territory.description}` : ''}${a.territory.children.length ? `\nSubtemas (use como ângulos, sem esgotar): ${a.territory.children.join('; ')}` : ''}${a.territory.translation ? `\nTRADUÇÃO DO TEMA PARA ESTA PERSONA (como ele aparece no dia a dia dela; use como ponte entre o debate coletivo e a dor em linguagem de rua):\n${a.territory.translation}` : ''}`
      : 'TERRITÓRIO: nenhum específico. Escolha ângulos relevantes para esta persona e para o que a organização faz.',
    a.existing?.length ? existingBlock(a.existing, !!a.persona, !!a.territory) : a.existingPains.length ? `IDEIAS QUE JÁ EXISTEM (não repita as dores nem os ângulos):\n${a.existingPains.map((p) => `- ${p}`).join('\n')}` : '',
    !a.persona ? 'ATENÇÃO: sem persona. A "pain" é uma afirmação sobre o fato ou o território (nunca uma fala em primeira pessoa).' : '',
    objectiveBlock(a.objective, !!a.persona, n),
    `TAREFA: crie ${n} ideia(s) de conteúdo com os 8 campos (pain, impact, cause, guide, args, gain, desire, cta).`,
    a.instructions.trim() ? `INSTRUÇÕES EXTRAS DO USUÁRIO:\n${a.instructions.trim()}` : '',
  ].filter(Boolean).join('\n\n');

  try {
    const res = await new Anthropic().beta.messages.create({
      model: AI_MODEL, max_tokens: 12000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      system: [SYSTEM + (a.persona ? '' : NO_PERSONA_RULES), brandBlock(a.brand)].filter(Boolean).join('\n\n'),
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: user }],
    });
    if (res.stop_reason === 'refusal') throw new AiError('A IA recusou gerar ideias.');
    if (res.stop_reason === 'max_tokens') throw new AiError('A resposta ficou grande demais. Peça menos ideias.', true);
    const raw = JSON.parse(res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '') as { ideas?: Partial<Record<(typeof KEYS)[number], string>>[] };
    const seen = new Set(a.existingPains.map(norm));
    const ideas: SuggestedIdea[] = [];
    for (const x of raw.ideas ?? []) {
      const idea = Object.fromEntries(KEYS.map((k) => [k, clean(x[k], k === 'args' ? 700 : k === 'guide' ? 600 : k === 'cta' ? 300 : 400)])) as SuggestedIdea;
      const k = norm(idea.pain);
      if (!idea.pain || seen.has(k)) continue;
      seen.add(k); ideas.push(idea);
    }
    if (!ideas.length) throw new AiError('A IA não trouxe nada novo. Tente outra instrução.', true);
    const u = res.usage as { input_tokens?: number; output_tokens?: number } | undefined;
    return { ideas: ideas.slice(0, n), inputTokens: u?.input_tokens ?? 0, outputTokens: u?.output_tokens ?? 0 };
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof SyntaxError) throw new AiError('A IA devolveu uma resposta inválida. Tente de novo.', true);
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Limite de uso da IA atingido. Tente em instantes.', true);
    if (e instanceof Anthropic.AuthenticationError) throw new AiError('Chave da Anthropic inválida no servidor.');
    if (e instanceof Anthropic.APIError) throw new AiError(`Erro da IA (${e.status}).`, (e.status ?? 500) >= 500);
    throw new AiError('Não foi possível falar com a IA.', true);
  }
}

const REFINE_RULES = `

TAREFA: REFINAR UMA IDEIA EXISTENTE
- Você recebe a ideia ATUAL (a versão que está na tela, mesmo que ainda não salva) e um PEDIDO do usuário. Devolva a ideia inteira, com os mesmos 8 campos, aplicando o pedido.
- Mude só o que o pedido exige e o que for necessário para manter a coerência da história (dor → impacto → causa → guia → argumentos → ganho → desejo → CTA). Preserve o resto, as palavras que já estavam boas e a persona.
- Respeite todas as regras de cada campo acima (linguagem de rua na dor, causa coletiva, guia sem repetir o discurso do outro lado, sem inventar dados).
- Se houver "SUGESTÃO ANTERIOR (não aprovada)", parta dela e aplique o novo pedido, sem desfazer o que já estava bom.
- "note": uma frase curta dizendo o que você mudou.`;

const REFINE_SCHEMA = {
  type: 'object', additionalProperties: false, required: [...KEYS, 'note'],
  properties: { ...Object.fromEntries(KEYS.map((k) => [k, STR])), note: STR },
};

/** Refina uma ideia (a versão da tela) a partir de um feedback. Não grava: o usuário aprova antes. */
export async function refineIdea(a: {
  current: IdeaFields; previous?: IdeaFields; feedback: string; persona: { name: string; tagline: string; role: string; data: PersonaData } | null;
  territory: string; icp: string; brand: BrandProfile;
  /** Refinar só este campo: os outros voltam exatamente como estavam. */
  field?: (typeof KEYS)[number];
}): Promise<{ fields: IdeaFields; note: string }> {
  const show = (f: IdeaFields) => KEYS.map((k) => `${k}: ${f[k] || '(vazio)'}`).join('\n');
  if (process.env.AI_MOCK === '1') {
    await new Promise((r) => setTimeout(r, 500));
    const k = a.field ?? 'pain';
    return { fields: { ...a.current, [k]: `${a.current[k]} (refinado: ${a.feedback.slice(0, 40)})` }, note: 'Versão simulada (AI_MOCK=1).' };
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError('ANTHROPIC_API_KEY não configurada no servidor.');
  const user = [
    a.persona ? personaBlock(a.persona) : `PÚBLICO GERAL (sem persona específica).${a.icp.trim() ? `\nICP:\n${a.icp.trim()}` : ''}`,
    a.territory ? `TERRITÓRIO: ${a.territory}` : '',
    `IDEIA ATUAL:\n${show(a.current)}`,
    a.previous ? `SUGESTÃO ANTERIOR (não aprovada):\n${show(a.previous)}` : '',
    a.field ? `ESCOPO: refine SOMENTE o campo "${a.field}". Devolva todos os outros campos EXATAMENTE como estão em IDEIA ATUAL (copie sem mudar uma palavra) e aplique o pedido apenas neste campo, mantendo a coerência com os demais.` : '',
    `PEDIDO DO USUÁRIO:\n${a.feedback}`,
  ].filter(Boolean).join('\n\n');
  try {
    const res = await new Anthropic().beta.messages.create({
      model: AI_MODEL, max_tokens: 6000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      system: [SYSTEM + (a.persona ? '' : NO_PERSONA_RULES) + REFINE_RULES, brandBlock(a.brand)].filter(Boolean).join('\n\n'),
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: REFINE_SCHEMA } },
      messages: [{ role: 'user', content: user }],
    });
    if (res.stop_reason === 'refusal') throw new AiError('A IA recusou refinar esta ideia.');
    if (res.stop_reason === 'max_tokens') throw new AiError('A resposta ficou grande demais. Tente de novo.', true);
    const raw = JSON.parse(res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '') as Partial<Record<(typeof KEYS)[number] | 'note', string>>;
    const fields = Object.fromEntries(KEYS.map((k) => [k, clean(raw[k], k === 'args' ? 700 : k === 'guide' ? 600 : k === 'cta' ? 300 : 400)])) as IdeaFields;
    if (!fields.pain) throw new AiError('A IA devolveu uma ideia vazia. Tente de novo.', true);
    if (a.field) { const only = fields[a.field]; Object.assign(fields, a.current, { [a.field]: only }); } // garantia no código: só o campo pedido muda
    return { fields, note: clean(raw.note, 300) };
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof SyntaxError) throw new AiError('A IA devolveu uma resposta inválida. Tente de novo.', true);
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Limite de uso da IA atingido. Tente em instantes.', true);
    if (e instanceof Anthropic.APIError) throw new AiError(`Erro da IA (${e.status}).`, (e.status ?? 500) >= 500);
    throw new AiError('Não foi possível falar com a IA.', true);
  }
}
