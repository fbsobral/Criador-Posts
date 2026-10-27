import Anthropic from '@anthropic-ai/sdk';
import { AI_MODEL, AiError, brandBlock, type BrandProfile } from './generate';
import { MAX_CRITERIA, sanitizePriority, type PriorityCriterion } from '../priority';

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['criteria'],
  properties: { criteria: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'description', 'weight'], properties: { name: { type: 'string' }, description: { type: 'string' }, weight: { type: 'integer' } } } } },
};

const SYSTEM = `Você é um estrategista de conteúdo sênior. Você define os CRITÉRIOS que uma organização usa para dar prioridade (score de 1 a 100) às suas pautas, em português do Brasil.

Uma pauta é um "território": um tema de conteúdo ligado a uma persona. Depois, uma IA vai dar a cada território uma nota de 0 a 100 em cada critério e somar pelos pesos. Por isso cada critério precisa ser AVALIÁVEL olhando só o tema, a persona e o contexto da organização.

REGRAS
- Crie de 4 a 6 critérios, DIFERENTES entre si (sem sobreposição) e específicos para esta organização: parta do que ela faz, de quem ela quer alcançar e do que ela precisa conquistar com o conteúdo. Nada de lista genérica de marketing.
- "O que a organização faz" é o seu contexto: use-o para escolher o que realmente importa para ELA. Ele NÃO precisa virar um critério, e só deve virar um se for de fato o que mais separa uma pauta boa de uma ruim.
- Cada critério tem: "name" (2 a 5 palavras), "description" (1 a 2 frases dizendo o que a IA deve avaliar e o que é nota alta e nota baixa) e "weight" (inteiro de 1 a 10, a importância relativa; use pesos diferentes, os mais decisivos com 7 a 10).
- Evite critérios que exigem dados que ninguém tem (volume de busca exato, concorrência medida). Prefira julgamentos que dá para fazer com bom senso.`;

export async function suggestCriteria(a: { brand: BrandProfile; icp: string; personas: { name: string; tagline: string; pains: string[] }[]; current: PriorityCriterion[]; instructions: string }): Promise<PriorityCriterion[]> {
  if (process.env.AI_MOCK === '1') {
    await new Promise((r) => setTimeout(r, 600));
    return sanitizePriority({ criteria: [{ id: 'm1', name: 'Urgência da dor', description: 'Quão urgente é a dor.', weight: 8 }, { id: 'm2', name: 'Caminho até a oferta', description: 'Quão perto o tema leva ao que a organização faz.', weight: 5 }, { id: 'm3', name: 'Chance de compartilhamento', description: 'Quanto as pessoas repassariam.', weight: 3 }] }).criteria;
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError('ANTHROPIC_API_KEY não configurada no servidor.');
  const user = [
    a.icp.trim() && `ICP (público ideal):\n${a.icp.trim()}`,
    a.personas.length ? `PERSONAS:\n${a.personas.slice(0, 12).map((p) => `- ${p.name}: ${p.tagline}${p.pains.length ? ` | dores: ${p.pains.slice(0, 2).join('; ')}` : ''}`).join('\n')}` : '',
    a.current.length ? `CRITÉRIOS ATUAIS (o usuário vai substituí-los; melhore, não repita sem motivo):\n${a.current.map((c) => `- ${c.name}: ${c.description}`).join('\n')}` : '',
    'TAREFA: sugira os critérios de prioridade das pautas desta organização.',
    a.instructions.trim() && `INSTRUÇÕES EXTRAS DO USUÁRIO:\n${a.instructions.trim()}`,
  ].filter(Boolean).join('\n\n');
  try {
    const res = await new Anthropic().beta.messages.create({
      model: AI_MODEL, max_tokens: 3000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      system: [SYSTEM, brandBlock({ ...a.brand, audience: '' })].filter(Boolean).join('\n\n'),
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: user }],
    });
    if (res.stop_reason === 'refusal') throw new AiError('A IA recusou sugerir critérios.');
    const raw = JSON.parse(res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '') as { criteria?: { name?: string; description?: string; weight?: number }[] };
    const out = sanitizePriority({ criteria: (raw.criteria ?? []).slice(0, MAX_CRITERIA).map((x, i) => ({ id: `c${Date.now().toString(36)}${i}`, name: String(x.name ?? ''), description: String(x.description ?? ''), weight: Number(x.weight) })) }).criteria;
    if (!out.length) throw new AiError('A IA não trouxe critérios. Tente de novo.', true);
    return out;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof SyntaxError) throw new AiError('A IA devolveu uma resposta inválida. Tente de novo.', true);
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Limite de uso da IA atingido. Tente em instantes.', true);
    if (e instanceof Anthropic.APIError) throw new AiError(`Erro da IA (${e.status}).`, (e.status ?? 500) >= 500);
    throw new AiError('Não foi possível falar com a IA.', true);
  }
}
