import Anthropic from '@anthropic-ai/sdk';
import { AI_MODEL, AiError, brandBlock, type BrandProfile } from './generate';
import type { PersonaData } from '../persona';
import { MAX_TERRITORY_NODES_PER_RUN } from '../territory';

export type SuggestedNode = { ref: string; parentRef: string; name: string; description: string };
export type TerritoryMode = 'first' | 'expand' | 'full';

const STR = { type: 'string' } as const;
const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['nodes'],
  properties: {
    nodes: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['ref', 'parent_ref', 'name', 'description'], properties: { ref: STR, parent_ref: STR, name: STR, description: STR } },
    },
  },
};

const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '');
const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

const SYSTEM = `Você é um estrategista de conteúdo sênior. Você cria TERRITÓRIOS: o mapa de temas de conteúdo que uma PERSONA quer consumir, organizado em níveis (como um mapa mental), em português do Brasil.

O QUE É UM TERRITÓRIO
- Nível 1: grandes áreas de interesse da persona (pilares de conteúdo). Nível 2: subtemas. Nível 3: tópicos específicos. Nível 4 em diante: ângulos concretos que viram um post ou vídeo.
- Cada território nasce das DORES, OBJETIVOS, OBJEÇÕES e GATILHOS da persona e do ICP/marca: pense no que essa pessoa procura, teme ou precisa decidir.
- Nomes curtos (2 a 6 palavras), claros e específicos. Nada de rótulos vagos ("Dicas", "Geral", "Outros"). A descrição tem uma frase dizendo o que entra ali e por que importa para a persona.
- Irmãos (mesmo pai) cobrem assuntos DIFERENTES, sem sobreposição. Filhos aprofundam o pai, não o repetem.

REGRA DE OURO: NÃO REPITA o que já existe no mapa dessa persona (você recebe a árvore atual). Não crie o mesmo tema com outro nome nem variações triviais; complemente lacunas. Se um território já existe, não o inclua de novo.
Se o mesmo tema já é usado em outras personas (você recebe a lista), reutilize EXATAMENTE o mesmo nome para ele, sem inventar sinônimos: isso permite ver os pontos em comum depois.

FORMATO DA RESPOSTA
- Lista plana "nodes". Cada item: "ref" (um identificador curto e único, ex.: "a1", "a1b"), "parent_ref" (o "ref" do pai dentro desta lista, ou "" para o que entra direto no ponto de partida indicado), "name", "description".
- Um filho sempre vem depois do seu pai na lista.`;

function personaBlock(p: { name: string; tagline: string; role: string; data: PersonaData }) {
  const L = (t: string, a: string[]) => (a.length ? `\n- ${t}: ${a.join('; ')}` : '');
  return `PERSONA: ${p.name}${p.role ? ` (${p.role})` : ''}\nResumo: ${p.tagline}\nContexto: ${p.data.bio}${L('Objetivos', p.data.goals)}${L('Dores', p.data.pains)}${L('Objeções', p.data.objections)}${L('Gatilhos', p.data.triggers)}${L('Canais', p.data.channels)}`;
}

export type SuggestArgs = {
  persona: { name: string; tagline: string; role: string; data: PersonaData };
  brand: BrandProfile;
  icp: string;
  mode: TerritoryMode;
  count: number;
  depth: number; // níveis a gerar (modo "full" e "expand")
  /** Nó de partida (para "expand"): caminho até ele. Vazio = raiz da persona. */
  parentPath: string[];
  /** Árvore atual desta persona, com recuo. */
  existingOutline: string;
  /** Nomes já existentes sob o ponto de partida (para não repetir). */
  siblingNames: string[];
  /** Nomes de nível 1 usados em outras personas. */
  otherPersonas: string[];
  instructions: string;
};

/** Sugere territórios (só o 1º nível, filhos de um nó, ou uma subárvore completa), sem repetir o que a persona já tem. Não grava nada. */
export async function suggestTerritories(a: SuggestArgs): Promise<{ nodes: SuggestedNode[]; inputTokens: number; outputTokens: number }> {
  const n = Math.max(1, Math.round(a.count));
  if (process.env.AI_MOCK === '1') {
    await new Promise((r) => setTimeout(r, 900));
    const nodes: SuggestedNode[] = [];
    for (let i = 0; i < n; i++) {
      nodes.push({ ref: `m${i}`, parentRef: '', name: `${a.parentPath.at(-1) ?? 'Território'} ${i + 1}`, description: 'Descrição de exemplo.' });
      if (a.mode !== 'first') for (let j = 0; j < 2; j++) nodes.push({ ref: `m${i}_${j}`, parentRef: `m${i}`, name: `Subtema ${i + 1}.${j + 1}`, description: 'Descrição de exemplo.' });
    }
    return { nodes: dedupe(nodes, a), inputTokens: 1500, outputTokens: 1200 };
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError('ANTHROPIC_API_KEY não configurada no servidor.');

  const task = a.mode === 'first'
    ? `TAREFA: crie ${n} território(s) de NÍVEL 1 (grandes áreas) para esta persona. Todos com parent_ref "".`
    : a.mode === 'expand'
      ? `TAREFA: crie ${n} território(s) FILHOS de "${a.parentPath.join(' › ')}" (parent_ref "" = filho direto dele)${a.depth > 1 ? `, e aprofunde cada um com mais ${a.depth - 1} nível(is)` : ''}. Total máximo ~${MAX_TERRITORY_NODES_PER_RUN} itens.`
      : `TAREFA: crie um mapa COMPLETO com ${n} território(s) de nível 1 (parent_ref "") e aprofunde cada um até ${a.depth} níveis no total (nível 2 com 2 a 4 filhos por pai, nível 3 com 2 a 3, e assim por diante). Máximo de ${MAX_TERRITORY_NODES_PER_RUN} itens no total; priorize qualidade e especificidade.`;
  const user = [
    personaBlock(a.persona),
    a.icp.trim() ? `ICP DA MARCA:\n${a.icp.trim()}` : '',
    `MAPA ATUAL DESTA PERSONA (não repita nada daqui):\n${a.existingOutline || '(vazio)'}`,
    a.siblingNames.length ? `JÁ EXISTEM NESTE PONTO (não repita): ${a.siblingNames.join('; ')}` : '',
    a.otherPersonas.length ? `TERRITÓRIOS USADOS EM OUTRAS PERSONAS (reutilize o mesmo nome quando for o mesmo tema): ${a.otherPersonas.slice(0, 60).join('; ')}` : '',
    task,
    a.instructions.trim() ? `INSTRUÇÕES EXTRAS DO USUÁRIO:\n${a.instructions.trim()}` : '',
  ].filter(Boolean).join('\n\n');

  try {
    const res = await new Anthropic().beta.messages.create({
      model: AI_MODEL, max_tokens: 12000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      system: [SYSTEM, brandBlock(a.brand)].filter(Boolean).join('\n\n'),
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: user }],
    });
    if (res.stop_reason === 'refusal') throw new AiError('A IA recusou gerar territórios.');
    if (res.stop_reason === 'max_tokens') throw new AiError('A resposta ficou grande demais. Peça menos itens ou menos níveis.', true);
    const raw = JSON.parse(res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '') as { nodes?: { ref?: string; parent_ref?: string; name?: string; description?: string }[] };
    const nodes = (raw.nodes ?? []).slice(0, MAX_TERRITORY_NODES_PER_RUN + 10).map((x, i) => ({ ref: clean(x.ref, 20) || `n${i}`, parentRef: clean(x.parent_ref, 20), name: clean(x.name, 80), description: clean(x.description, 220) })).filter((x) => x.name);
    const out = dedupe(nodes, a);
    if (!out.length) throw new AiError('A IA não trouxe nada novo para este ponto. Tente outra instrução.', true);
    const u = res.usage as { input_tokens?: number; output_tokens?: number } | undefined;
    return { nodes: out, inputTokens: u?.input_tokens ?? 0, outputTokens: u?.output_tokens ?? 0 };
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof SyntaxError) throw new AiError('A IA devolveu uma resposta inválida. Tente de novo.', true);
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Limite de uso da IA atingido. Tente em instantes.', true);
    if (e instanceof Anthropic.AuthenticationError) throw new AiError('Chave da Anthropic inválida no servidor.');
    if (e instanceof Anthropic.APIError) throw new AiError(`Erro da IA (${e.status}).`, (e.status ?? 500) >= 500);
    throw new AiError('Não foi possível falar com a IA.', true);
  }
}

/** Garantia no código: tira o que repete um nome já existente (neste ponto, ou em qualquer lugar do mapa) e os órfãos. */
function dedupe(nodes: SuggestedNode[], a: SuggestArgs): SuggestedNode[] {
  const existing = new Set([...a.siblingNames.map(norm), ...a.existingOutline.split('\n').map((l) => norm(l.replace(/^\s*-\s*/, ''))).filter(Boolean)]);
  const seen = new Set<string>();
  const keep = new Map<string, SuggestedNode>();
  for (const x of nodes) {
    const k = norm(x.name);
    if (existing.has(k) || seen.has(k)) continue;
    if (x.parentRef && !keep.has(x.parentRef)) continue; // o pai foi descartado (ou veio depois): descarta o filho
    seen.add(k); keep.set(x.ref, x);
  }
  return [...keep.values()];
}
