import Anthropic from '@anthropic-ai/sdk';
import { AI_MODEL, AiError, brandBlock, type BrandProfile } from './generate';
import type { PersonaData } from '../persona';
import { MAX_IDEAS_PER_RUN } from '../idea';

export type SuggestedIdea = { pain: string; guide: string; args: string[]; cta: string };

const STR = { type: 'string' } as const;
const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['ideas'],
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['pain', 'guide', 'args', 'cta'],
        properties: { pain: STR, guide: STR, args: { type: 'array', items: STR }, cta: STR },
      },
    },
  },
};

const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '');
const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

const SYSTEM = `Você é um estrategista de comunicação sênior, formado em enquadramento (framing) cognitivo à maneira de George Lakoff. Você cria IDEIAS DE CONTEÚDO em português do Brasil, a partir de um TERRITÓRIO (um tema do mapa de conteúdo) e de uma PERSONA.

ESTRUTURA DE CADA IDEIA (todos os campos são obrigatórios)
1. "pain" — a DOR, em LINGUAGEM DE RUA: como a própria pessoa diria, em 1 ou 2 frases, de boca, no ônibus, no zap, na fila. Concreta, cotidiana, sem jargão, sem "marketês" e sem termo técnico. Pode ter gíria leve e o jeito de falar da persona, sem caricatura nem deboche. Nada de "a persona sente que…": é a fala dela.
2. "guide" — o GUIA: o ENQUADRAMENTO progressista que conduz a conversa. Em 1 a 3 frases, diga (a) o valor moral que organiza a ideia (cuidado e proteção, empatia, responsabilidade de uns com os outros, equidade, dignidade, liberdade com condições reais, bem comum, cooperação) e (b) a imagem, metáfora ou cena que torna esse valor visível (ex.: "a comunidade como uma casa que todos ajudam a manter"). Regras do enquadramento:
   - Fale a partir do SEU enquadramento. NÃO repita o enquadramento do outro lado, nem para negá-lo ("não é que…"): quem nega um frame o reforça (não pense num elefante).
   - Comece pelos valores compartilhados e pela experiência vivida da pessoa, não por estatísticas nem por jargão de política pública.
   - Mostre quem cuida de quem, quem protege e quem é responsável, em vez de culpar a pessoa pelo problema. A dor é compartilhada e tem causa coletiva, não é falha individual.
   - Prefira verbos e imagens concretas a abstrações ("direito", "política", "equidade" sozinhos não bastam: mostre o que muda na vida).
3. "args" — os ARGUMENTOS: 3 a 4 itens curtos (uma frase cada) que sustentam o guia, já dentro do enquadramento: o que acontece na vida da pessoa, por que acontece, o que funciona e o que a organização pode oferecer ou saber. Sem inventar números, datas, leis, estudos ou fontes: use só fatos que você pode afirmar com segurança, ou formule como observação do cotidiano. Se uma estatística seria útil mas você não tem certeza dela, escreva "[checar dado]" no lugar.
4. "cta" — a CTA INDIRETA: um convite natural, em 1 frase, que não pede nada diretamente (sem "compre", "contrate", "clique", "fale conosco"). Ex.: convidar a olhar para algo de outro jeito, perceber um padrão, conversar com alguém, guardar, compartilhar com quem passa por isso, conhecer um caminho. Deve levar de forma sutil ao que a organização faz.

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
    return { ideas: Array.from({ length: n }, (_, i) => ({ pain: `"Dor de exemplo ${i + 1}, falada do jeito da rua."`, guide: 'Cuidado como valor: uma comunidade que se protege.', args: ['Argumento 1.', 'Argumento 2.', 'Argumento 3.'], cta: 'Compartilhe com quem passa por isso.' })), inputTokens: 1200, outputTokens: 900 };
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError('ANTHROPIC_API_KEY não configurada no servidor.');

  const user = [
    a.persona ? personaBlock(a.persona) : `PÚBLICO GERAL (sem persona específica).\nICP DA MARCA:\n${a.icp.trim() || '(não informado)'}`,
    a.territory
      ? `TERRITÓRIO: ${a.territory.path.join(' › ')}${a.territory.description ? `\nO que entra aqui: ${a.territory.description}` : ''}${a.territory.children.length ? `\nSubtemas (use como ângulos, sem esgotar): ${a.territory.children.join('; ')}` : ''}`
      : 'TERRITÓRIO: nenhum específico. Escolha ângulos relevantes para esta persona e para o que a organização faz.',
    a.existingPains.length ? `IDEIAS QUE JÁ EXISTEM (não repita as dores nem os ângulos):\n${a.existingPains.map((p) => `- ${p}`).join('\n')}` : '',
    `TAREFA: crie ${n} ideia(s) de conteúdo com os 4 campos (pain, guide, args, cta).`,
    a.instructions.trim() ? `INSTRUÇÕES EXTRAS DO USUÁRIO:\n${a.instructions.trim()}` : '',
  ].filter(Boolean).join('\n\n');

  try {
    const res = await new Anthropic().beta.messages.create({
      model: AI_MODEL, max_tokens: 8000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      system: [SYSTEM, brandBlock(a.brand)].filter(Boolean).join('\n\n'),
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: user }],
    });
    if (res.stop_reason === 'refusal') throw new AiError('A IA recusou gerar ideias.');
    if (res.stop_reason === 'max_tokens') throw new AiError('A resposta ficou grande demais. Peça menos ideias.', true);
    const raw = JSON.parse(res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '') as { ideas?: { pain?: string; guide?: string; args?: string[]; cta?: string }[] };
    const seen = new Set(a.existingPains.map(norm));
    const ideas: SuggestedIdea[] = [];
    for (const x of raw.ideas ?? []) {
      const idea = { pain: clean(x.pain, 400), guide: clean(x.guide, 600), args: (Array.isArray(x.args) ? x.args : []).map((t) => clean(t, 300)).filter(Boolean).slice(0, 6), cta: clean(x.cta, 300) };
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
