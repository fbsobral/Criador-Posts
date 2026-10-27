import Anthropic from '@anthropic-ai/sdk';
import { AI_MODEL, AiError, brandBlock, type BrandProfile } from './generate';
import type { PersonaData } from '../persona';
import { MAX_IDEAS_PER_RUN, type IdeaFields } from '../idea';

export type SuggestedIdea = IdeaFields;
const KEYS = ['pain', 'impact', 'cause', 'guide', 'plan', 'gain', 'desire', 'cta'] as const;

const STR = { type: 'string' } as const;
const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['ideas'],
  properties: {
    ideas: { type: 'array', items: { type: 'object', additionalProperties: false, required: [...KEYS], properties: Object.fromEntries(KEYS.map((k) => [k, STR])) } },
  },
};

const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '');
const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

const SYSTEM = `Você é um estrategista de comunicação sênior, formado em enquadramento (framing) cognitivo à maneira de George Lakoff. Você cria IDEIAS DE CONTEÚDO em português do Brasil, a partir de um TERRITÓRIO (um tema do mapa de conteúdo) e de uma PERSONA.

ESTRUTURA DE CADA IDEIA (todos os campos são obrigatórios; juntos contam uma história: da dor ao convite)
1. "pain" — a DOR, em LINGUAGEM DE RUA: como a própria pessoa diria, em 1 ou 2 frases, de boca, no ônibus, no zap, na fila. Concreta, cotidiana, sem jargão, sem "marketês" e sem termo técnico. Pode ter gíria leve e o jeito de falar da persona, sem caricatura nem deboche. Nada de "a persona sente que…": é a fala dela.
2. "impact" — o IMPACTO: o que essa dor faz na vida dela, em 1 ou 2 frases concretas (contas, saúde, família, tempo, auto-estima). Mostre a consequência sentida, sem números inventados.
3. "cause" — a CAUSA: por que isso acontece, em 1 ou 2 frases. Aponte a raiz coletiva ou estrutural (como o sistema, o mercado, a falta de informação ou de apoio funcionam), nunca a culpa da pessoa. Só afirme o que você pode afirmar com segurança.
4. "guide" — o GUIA: o ENQUADRAMENTO progressista que conduz a conversa. Em 1 a 3 frases, diga (a) o valor moral que organiza a ideia (cuidado e proteção, empatia, responsabilidade de uns com os outros, equidade, dignidade, liberdade com condições reais, bem comum, cooperação) e (b) a imagem, metáfora ou cena que torna esse valor visível (ex.: "a comunidade como uma casa que todos ajudam a manter"). Regras do enquadramento:
   - Fale a partir do SEU enquadramento. NÃO repita o enquadramento do outro lado, nem para negá-lo ("não é que…"): quem nega um frame o reforça (não pense num elefante).
   - Comece pelos valores compartilhados e pela experiência vivida da pessoa, não por estatísticas nem por jargão de política pública.
   - Mostre quem cuida de quem, quem protege e quem é responsável, em vez de culpar a pessoa. A dor é compartilhada e tem causa coletiva.
   - Prefira verbos e imagens concretas a abstrações.
5. "plan" — o PLANO: o caminho para sair da dor, em 2 a 4 passos curtos e concretos (um por linha, separados por quebra de linha, sem numeração nem marcadores). Coerente com a causa e com o guia, e ligado, de forma natural, ao que a ORGANIZAÇÃO faz ou ensina. Sem inventar leis, números, prazos ou programas: se precisar de um dado que não tem certeza, escreva "[checar dado]".
6. "gain" — o GANHO: o que muda na vida dela quando o plano funciona, em 1 ou 2 frases. Resultado concreto e visível (o que ela passa a poder fazer, ter ou deixar de temer), sem promessa milagrosa.
7. "desire" — o DESEJO: a aspiração de fundo por trás da dor, em 1 frase: o que ela quer ser, sentir ou garantir (dignidade, segurança, sossego, orgulho, futuro para os filhos). Mais profundo que o ganho.
8. "cta" — a CTA: o convite final, em 1 frase, claro e natural, que dá um próximo passo fácil (olhar, perceber, conversar, guardar, compartilhar com quem passa por isso, conhecer o caminho). Sem tom de venda agressivo ("compre já", "clique agora").

REGRAS GERAIS
- Cada ideia ataca UM ângulo diferente do território e uma dor diferente. Nada de ideias parecidas entre si nem repetidas das já existentes (você recebe a lista).
- Fique no território indicado e na persona indicada. Ligue ao que a ORGANIZAÇÃO faz (veja a identidade da marca) de forma natural.
- Respeite o tom de voz e as regras da marca. Evite clichês de IA ("mergulhe", "desvende", "no mundo de hoje").
- Não ataque pessoas nem grupos; o foco é a dor real e o caminho de cuidado e solução.`;

function personaBlock(p: { name: string; tagline: string; role: string; data: PersonaData }) {
  const L = (t: string, a: string[]) => (a.length ? `\n- ${t}: ${a.join('; ')}` : '');
  return `PERSONA: ${p.name}${p.role ? ` (${p.role})` : ''}\nResumo: ${p.tagline}\nContexto: ${p.data.bio}${L('Objetivos', p.data.goals)}${L('Dores', p.data.pains)}${L('Objeções', p.data.objections)}${L('Gatilhos', p.data.triggers)}`;
}

export type SuggestIdeasArgs = {
  /** Nulo = público geral (sem persona). */
  persona: { name: string; tagline: string; role: string; data: PersonaData } | null;
  icp: string;
  brand: BrandProfile;
  /** Território de origem: caminho até ele e o que há dentro dele. */
  territory: { path: string[]; description: string; children: string[] } | null;
  /** Dores das ideias que já existem para este território/persona. */
  existingPains: string[];
  count: number;
  instructions: string;
};

/** Sugere ideias de conteúdo. Não grava nada: o usuário aprova antes. */
export async function suggestIdeas(a: SuggestIdeasArgs): Promise<{ ideas: SuggestedIdea[]; inputTokens: number; outputTokens: number }> {
  const n = Math.min(MAX_IDEAS_PER_RUN, Math.max(1, Math.round(a.count)));
  if (process.env.AI_MOCK === '1') {
    await new Promise((r) => setTimeout(r, 700));
    return { ideas: Array.from({ length: n }, (_, i) => ({ pain: `"Dor de exemplo ${i + 1}, falada do jeito da rua."`, impact: 'Impacto de exemplo.', cause: 'Causa coletiva de exemplo.', guide: 'Cuidado como valor: uma comunidade que se protege.', plan: 'Passo 1\nPasso 2\nPasso 3', gain: 'Ganho de exemplo.', desire: 'Desejo de exemplo.', cta: 'Compartilhe com quem passa por isso.' })), inputTokens: 1200, outputTokens: 900 };
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError('ANTHROPIC_API_KEY não configurada no servidor.');

  const user = [
    a.persona ? personaBlock(a.persona) : `PÚBLICO GERAL (sem persona específica).\nICP DA MARCA:\n${a.icp.trim() || '(não informado)'}`,
    a.territory
      ? `TERRITÓRIO: ${a.territory.path.join(' › ')}${a.territory.description ? `\nO que entra aqui: ${a.territory.description}` : ''}${a.territory.children.length ? `\nSubtemas (use como ângulos, sem esgotar): ${a.territory.children.join('; ')}` : ''}`
      : 'TERRITÓRIO: nenhum específico. Escolha ângulos relevantes para esta persona e para o que a organização faz.',
    a.existingPains.length ? `IDEIAS QUE JÁ EXISTEM (não repita as dores nem os ângulos):\n${a.existingPains.map((p) => `- ${p}`).join('\n')}` : '',
    `TAREFA: crie ${n} ideia(s) de conteúdo com os 8 campos (pain, impact, cause, guide, plan, gain, desire, cta).`,
    a.instructions.trim() ? `INSTRUÇÕES EXTRAS DO USUÁRIO:\n${a.instructions.trim()}` : '',
  ].filter(Boolean).join('\n\n');

  try {
    const res = await new Anthropic().beta.messages.create({
      model: AI_MODEL, max_tokens: 12000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      system: [SYSTEM, brandBlock(a.brand)].filter(Boolean).join('\n\n'),
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: user }],
    });
    if (res.stop_reason === 'refusal') throw new AiError('A IA recusou gerar ideias.');
    if (res.stop_reason === 'max_tokens') throw new AiError('A resposta ficou grande demais. Peça menos ideias.', true);
    const raw = JSON.parse(res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '') as { ideas?: Partial<Record<(typeof KEYS)[number], string>>[] };
    const seen = new Set(a.existingPains.map(norm));
    const ideas: SuggestedIdea[] = [];
    for (const x of raw.ideas ?? []) {
      const idea = Object.fromEntries(KEYS.map((k) => [k, clean(x[k], k === 'plan' ? 700 : k === 'guide' ? 600 : k === 'cta' ? 300 : 400)])) as SuggestedIdea;
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
