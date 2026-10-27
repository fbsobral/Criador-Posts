import Anthropic from '@anthropic-ai/sdk';
import { AI_MODEL, AiError, brandBlock, type BrandProfile } from './generate';
import { emptyPersonaData, normName, type PersonaData } from '../persona';

export type ExistingPersona = { name: string; tagline: string; role: string; group: string; pains: string[] };
export type SuggestedPersona = { name: string; tagline: string; data: PersonaData };
export type SuggestedGroup = { name: string; description: string; personas: SuggestedPersona[] };

const STR = { type: 'string' } as const;
const LIST = { type: 'array', items: STR } as const;
const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['groups'],
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['name', 'description', 'personas'],
        properties: {
          name: STR, description: STR,
          personas: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false,
              required: ['name', 'tagline', 'age', 'role', 'location', 'bio', 'goals', 'pains', 'objections', 'triggers', 'channels', 'quote'],
              properties: { name: STR, tagline: STR, age: STR, role: STR, location: STR, bio: STR, goals: LIST, pains: LIST, objections: LIST, triggers: LIST, channels: LIST, quote: STR },
            },
          },
        },
      },
    },
  },
};

const clean = (s: unknown, max = 400) => (typeof s === 'string' ? s.trim().slice(0, max) : '');
const list = (v: unknown, n = 6) => (Array.isArray(v) ? v.map((x) => clean(x, 220)).filter(Boolean).slice(0, n) : []);

const SYSTEM = `Você é um estrategista de marketing e pesquisador de audiência sênior. A partir do ICP (perfil de cliente ideal) informado, você cria PERSONAS: arquétipos fictícios e realistas de clientes, em português do Brasil.

COMO CRIAR
- Cada persona é um arquétipo, não uma pessoa real. Dê um nome brasileiro realista (nome e uma característica marcante, ex.: "Marina, a gestora sobrecarregada").
- Organize em AGRUPAMENTOS (segmentos): pessoas que compartilham contexto, momento de vida/negócio, motivação ou comportamento de compra. Não agrupe só por idade ou gênero. Cada grupo tem um nome curto e uma descrição de uma frase.
- Cada persona deve ser claramente DIFERENTE das outras: situação, dores, objetivos e gatilhos distintos. Evite variações triviais (mesma pessoa com outro nome).
- LIGAÇÃO COM A ORGANIZAÇÃO: as personas são as pessoas que a organização quer alcançar. Veja "O que a organização faz" na identidade da marca e crie personas cujas dores, objetivos, objeções e gatilhos tenham relação com o que a organização oferece e sabe resolver (clientes atuais, potenciais e quem influencia a decisão). Evite perfis que não teriam motivo nenhum para se interessar por ela.
- Seja específico e acionável para quem produz conteúdo e campanhas: dores concretas, objeções reais ("já tentei e não funcionou", "não tenho tempo"), gatilhos de decisão e onde essa pessoa está (canais, comunidades, formatos).
- Não invente estatísticas, pesquisas ou dados de mercado. Tudo é hipótese plausível derivada do ICP.
- Evite estereótipos ofensivos e clichês genéricos. Escreva de forma simples e direta.

CAMPOS
- name, tagline (uma frase que resume quem é e o que quer), age (ex.: "34 anos"), role (profissão/cargo/papel), location (cidade/região/porte), bio (2 a 3 frases sobre o contexto), goals (3 a 4), pains (3 a 4), objections (2 a 3), triggers (2 a 3 gatilhos de compra/decisão), channels (2 a 4 onde consome informação), quote (uma frase que ela diria).`;

function existingBlock(ex: ExistingPersona[]): string {
  if (!ex.length) return 'PERSONAS JÁ EXISTENTES: nenhuma ainda.';
  const groups = [...new Set(ex.map((p) => p.group).filter(Boolean))];
  return `PERSONAS JÁ EXISTENTES (NÃO repita nem crie variações delas; cubra lacunas e perfis diferentes):\n${ex.map((p) => `- ${p.name}${p.role ? ` (${p.role})` : ''} [grupo: ${p.group || 'sem grupo'}]: ${p.tagline}${p.pains.length ? ` | dores: ${p.pains.slice(0, 2).join('; ')}` : ''}`).join('\n')}\n\nGRUPOS EXISTENTES: ${groups.length ? groups.join(', ') : 'nenhum'}.\nSe uma nova persona se encaixa em um grupo existente, use EXATAMENTE o mesmo nome do grupo. Só crie um grupo novo quando houver um segmento realmente diferente.`;
}

/** Sugere personas (já agrupadas) a partir de um ICP, evitando repetir as que existem. Não grava nada. */
export async function suggestPersonas(i: { icp: string; count: number; instructions: string; existing: ExistingPersona[]; brand: BrandProfile }): Promise<{ groups: SuggestedGroup[]; inputTokens: number; outputTokens: number }> {
  const n = Math.max(1, Math.round(i.count));
  if (process.env.AI_MOCK === '1') {
    await new Promise((r) => setTimeout(r, 900));
    const names = ['Marina', 'Carlos', 'Beatriz', 'Rafael', 'Camila', 'Diego', 'Luana', 'Paulo', 'Helena', 'Tiago', 'Aline', 'Bruno', 'Sofia', 'Marcos', 'Renata'];
    const gnames = ['Iniciantes', 'Em crescimento', 'Experientes'];
    const groups: SuggestedGroup[] = gnames.map((g, gi) => ({ name: g, description: `Segmento ${g.toLowerCase()} do ICP.`, personas: [] }));
    for (let k = 0; k < n; k++) {
      const nm = `${names[(k + i.existing.length) % names.length]} ${k + 1}`;
      groups[k % groups.length].personas.push({ name: nm, tagline: `Persona ${nm} derivada do ICP.`, data: { ...emptyPersonaData(), age: `${25 + k} anos`, role: 'Profissional', bio: 'Contexto de exemplo.', goals: ['Crescer'], pains: ['Falta de tempo'], objections: ['Preço'], triggers: ['Indicação'], channels: ['Instagram'], quote: '“Preciso de algo simples.”' } });
    }
    return { groups: groups.filter((g) => g.personas.length), inputTokens: 1800, outputTokens: 2500 };
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError('ANTHROPIC_API_KEY não configurada no servidor.');
  const user = [
    `ICP (perfil de cliente ideal):\n${i.icp.trim()}`,
    existingBlock(i.existing),
    `QUANTIDADE: crie exatamente ${n} persona(s) NOVA(S), distribuídas em grupos (de 2 a 5 personas por grupo, quando possível).`,
    i.instructions.trim() ? `INSTRUÇÕES EXTRAS DO USUÁRIO:\n${i.instructions.trim()}` : '',
  ].filter(Boolean).join('\n\n');
  try {
    const res = await new Anthropic().beta.messages.create({
      model: AI_MODEL, max_tokens: 16000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      system: [SYSTEM, brandBlock(i.brand)].filter(Boolean).join('\n\n'),
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: user }],
    });
    if (res.stop_reason === 'refusal') throw new AiError('A IA recusou gerar personas para este ICP.');
    if (res.stop_reason === 'max_tokens') throw new AiError('A resposta ficou grande demais. Peça menos personas por vez.', true);
    const raw = JSON.parse(res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '') as { groups?: any[] };
    const taken = new Set(i.existing.map((p) => normName(p.name)));
    let left = n;
    const groups: SuggestedGroup[] = [];
    for (const g of raw.groups ?? []) {
      const ps: SuggestedPersona[] = [];
      for (const p of g.personas ?? []) {
        const name = clean(p.name, 80);
        if (!name || taken.has(normName(name)) || left <= 0) continue;
        taken.add(normName(name)); left--;
        ps.push({ name, tagline: clean(p.tagline, 200), data: { age: clean(p.age, 30), role: clean(p.role, 100), location: clean(p.location, 100), bio: clean(p.bio, 700), goals: list(p.goals), pains: list(p.pains), objections: list(p.objections), triggers: list(p.triggers), channels: list(p.channels), quote: clean(p.quote, 240) } });
      }
      if (ps.length) groups.push({ name: clean(g.name, 60) || 'Sem nome', description: clean(g.description, 200), personas: ps });
    }
    if (!groups.length) throw new AiError('A IA não devolveu personas novas. Tente de novo ou ajuste o ICP.', true);
    const u = res.usage as { input_tokens?: number; output_tokens?: number } | undefined;
    return { groups, inputTokens: u?.input_tokens ?? 0, outputTokens: u?.output_tokens ?? 0 };
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof SyntaxError) throw new AiError('A IA devolveu uma resposta inválida. Tente de novo.', true);
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Limite de uso da IA atingido. Tente em instantes.', true);
    if (e instanceof Anthropic.AuthenticationError) throw new AiError('Chave da Anthropic inválida no servidor.');
    if (e instanceof Anthropic.APIError) throw new AiError(`Erro da IA (${e.status}).`, (e.status ?? 500) >= 500);
    throw new AiError('Não foi possível falar com a IA.', true);
  }
}

export type RefinedPersona = { name: string; tagline: string; data: PersonaData; note: string };

const REFINE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['name', 'tagline', 'age', 'role', 'location', 'bio', 'goals', 'pains', 'objections', 'triggers', 'channels', 'quote', 'note'],
  properties: { name: STR, tagline: STR, age: STR, role: STR, location: STR, bio: STR, goals: LIST, pains: LIST, objections: LIST, triggers: LIST, channels: LIST, quote: STR, note: STR },
};

const REFINE_SYSTEM = `Você é um estrategista de marketing e pesquisador de audiência sênior. O usuário quer REFINAR uma persona que já existe. Devolva a persona completa já ajustada, em JSON estrito, em português do Brasil.

REGRAS
- Aplique o feedback do usuário. Mude só o que o feedback pede (e o que for necessário para manter a persona coerente); preserve o resto como está, inclusive o tom e o nível de detalhe.
- Mantenha a persona realista, específica e acionável. Não invente estatísticas ou pesquisas.
- LIGAÇÃO COM A ORGANIZAÇÃO: a persona continua sendo alguém que a organização quer alcançar (veja "O que a organização faz" na identidade da marca); dores, objetivos, objeções e gatilhos devem ter relação com o que a organização oferece e resolve.
- Ela deve continuar claramente DIFERENTE das outras personas listadas (não vire uma variação delas).
- Se houver "SUGESTÃO ANTERIOR (não aprovada)", parta dela e aplique o novo pedido, sem desfazer o que já estava bom.
- Listas: de 2 a 4 itens curtos e concretos cada.
- "note": uma frase curta dizendo o que você mudou (ex.: "Tornei as dores mais ligadas a falta de tempo e troquei a profissão por uma mais realista").`;

/** Refina uma persona a partir de um feedback. Não grava nada: o usuário aprova na tela. */
export async function refinePersona(i: {
  current: { name: string; tagline: string; data: PersonaData };
  feedback: string;
  previous?: { name: string; tagline: string; data: PersonaData };
  others: { name: string; tagline: string }[];
  icp: string;
  brand: BrandProfile;
}): Promise<RefinedPersona & { inputTokens: number; outputTokens: number }> {
  const fmt = (p: { name: string; tagline: string; data: PersonaData }) =>
    `Nome: ${p.name}\nResumo: ${p.tagline}\nIdade: ${p.data.age}\nProfissão: ${p.data.role}\nLocal: ${p.data.location}\nContexto: ${p.data.bio}\nObjetivos: ${p.data.goals.join('; ')}\nDores: ${p.data.pains.join('; ')}\nObjeções: ${p.data.objections.join('; ')}\nGatilhos: ${p.data.triggers.join('; ')}\nOnde está: ${p.data.channels.join('; ')}\nFrase típica: ${p.data.quote}`;
  if (process.env.AI_MOCK === '1') {
    await new Promise((r) => setTimeout(r, 700));
    return { name: i.current.name, tagline: `${i.current.tagline} (refinada: ${i.feedback.slice(0, 40)})`, data: { ...i.current.data, bio: `${i.current.data.bio} Ajustada.` }, note: 'Versão simulada (AI_MOCK=1).', inputTokens: 0, outputTokens: 0 };
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError('ANTHROPIC_API_KEY não configurada no servidor.');
  const user = [
    i.icp.trim() ? `ICP:\n${i.icp.trim()}` : '',
    i.others.length ? `OUTRAS PERSONAS (a refinada deve continuar diferente delas):\n${i.others.slice(0, 40).map((p) => `- ${p.name}: ${p.tagline}`).join('\n')}` : '',
    `PERSONA ATUAL:\n${fmt(i.current)}`,
    i.previous ? `SUGESTÃO ANTERIOR (não aprovada):\n${fmt(i.previous)}` : '',
    `FEEDBACK DO USUÁRIO:\n${i.feedback.trim()}`,
  ].filter(Boolean).join('\n\n');
  try {
    const res = await new Anthropic().beta.messages.create({
      model: AI_MODEL, max_tokens: 4000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      system: [REFINE_SYSTEM, brandBlock(i.brand)].filter(Boolean).join('\n\n'),
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: REFINE_SCHEMA } },
      messages: [{ role: 'user', content: user }],
    });
    if (res.stop_reason === 'refusal') throw new AiError('A IA recusou refinar esta persona.');
    const p = JSON.parse(res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '') as Record<string, unknown>;
    const name = clean(p.name, 80);
    if (!name) throw new AiError('A IA não devolveu a persona. Tente de novo.', true);
    const u = res.usage as { input_tokens?: number; output_tokens?: number } | undefined;
    return {
      name, tagline: clean(p.tagline, 200), note: clean(p.note, 300),
      data: { age: clean(p.age, 30), role: clean(p.role, 100), location: clean(p.location, 100), bio: clean(p.bio, 700), goals: list(p.goals), pains: list(p.pains), objections: list(p.objections), triggers: list(p.triggers), channels: list(p.channels), quote: clean(p.quote, 240) },
      inputTokens: u?.input_tokens ?? 0, outputTokens: u?.output_tokens ?? 0,
    };
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof SyntaxError) throw new AiError('A IA devolveu uma resposta inválida. Tente de novo.', true);
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Limite de uso da IA atingido. Tente em instantes.', true);
    if (e instanceof Anthropic.APIError) throw new AiError(`Erro da IA (${e.status}).`, (e.status ?? 500) >= 500);
    throw new AiError('Não foi possível falar com a IA.', true);
  }
}
