import Anthropic from '@anthropic-ai/sdk';
import { AI_LIGHT_MODEL, AiError, brandBlock, type BrandProfile } from './generate';
import type { PersonaData } from '../persona';
import { clampScore, type PriorityConfig } from '../priority';

export type ScoreItem = { id: string; path: string; description: string };
export type Scored = { id: string; score: number; reason: string };

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['items'],
  properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'score', 'reason'], properties: { id: { type: 'string' }, score: { type: 'integer' }, reason: { type: 'string' } } } } },
};

/** Texto dos critérios e faixas para o prompt (usado também na geração de territórios). */
export function priorityBlock(c: PriorityConfig): string {
  const total = c.criteria.reduce((a, x) => a + x.weight, 0) || 1;
  return `CRITÉRIOS DE PRIORIDADE (o score de 1 a 100 de cada território pesa assim):
${c.criteria.map((x) => `- ${x.name} (peso ${x.weight}, ${Math.round((x.weight / total) * 100)}%): ${x.description}`).join('\n')}
FAIXAS: ${[...c.levels].sort((a, b) => b.min - a.min).map((l) => `${l.name} = a partir de ${l.min}`).join('; ')}.
Como pontuar: avalie cada critério de 0 a 100, some pelos pesos e arredonde. Use a escala toda: poucos territórios acima de 85 e vários abaixo de 40; não dê o mesmo score para tudo. Um território não herda o score do pai: avalie o tema dele.`;
}

const SYSTEM = `Você é um estrategista de conteúdo sênior. Você CLASSIFICA territórios (temas de conteúdo) com um score de 1 a 100 que define a prioridade da pauta, em português do Brasil.
Para cada território recebido devolva "id" (o mesmo recebido), "score" (inteiro de 1 a 100) e "reason" (uma frase curta, até 140 caracteres, dizendo o que mais pesou). Devolva todos os territórios, sem inventar ids.`;

/** Dá um score a cada território, pelos critérios da marca. Não grava nada. */
export async function scoreTerritories(a: {
  items: ScoreItem[]; persona: { name: string; tagline: string; data: PersonaData } | null; icp: string; brand: BrandProfile; config: PriorityConfig;
}): Promise<Scored[]> {
  if (!a.items.length) return [];
  if (process.env.AI_MOCK === '1') return a.items.map((x, i) => ({ id: x.id, score: clampScore(20 + ((i * 37) % 80)), reason: 'Score de exemplo (AI_MOCK=1).' }));
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError('ANTHROPIC_API_KEY não configurada no servidor.');
  const who = a.persona
    ? `PERSONA DO MAPA: ${a.persona.name} — ${a.persona.tagline}\nDores: ${a.persona.data.pains.join('; ')}\nObjetivos: ${a.persona.data.goals.join('; ')}`
    : `MAPA DO PÚBLICO GERAL (sem persona). ICP:\n${a.icp.trim() || '(não informado)'}`;
  const user = [who, `TERRITÓRIOS A CLASSIFICAR:\n${a.items.map((x) => `[${x.id}] ${x.path}${x.description ? ` — ${x.description}` : ''}`).join('\n')}`].join('\n\n');
  try {
    const res = await new Anthropic().beta.messages.create({
      model: AI_LIGHT_MODEL, max_tokens: 8000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      system: [SYSTEM, priorityBlock(a.config), brandBlock(a.brand)].filter(Boolean).join('\n\n'),
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: user }],
    });
    if (res.stop_reason === 'refusal') throw new AiError('A IA recusou classificar.');
    const raw = JSON.parse(res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '') as { items?: { id?: string; score?: number; reason?: string }[] };
    const ids = new Set(a.items.map((x) => x.id));
    return (raw.items ?? []).filter((x) => x.id && ids.has(x.id)).map((x) => ({ id: x.id!, score: clampScore(x.score), reason: String(x.reason ?? '').trim().slice(0, 200) }));
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof SyntaxError) throw new AiError('A IA devolveu uma resposta inválida. Tente de novo.', true);
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Limite de uso da IA atingido. Tente em instantes.', true);
    if (e instanceof Anthropic.APIError) throw new AiError(`Erro da IA (${e.status}).`, (e.status ?? 500) >= 500);
    throw new AiError('Não foi possível falar com a IA.', true);
  }
}
