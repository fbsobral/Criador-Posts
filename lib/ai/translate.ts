import Anthropic from '@anthropic-ai/sdk';
import { AI_MODEL, AiError, brandBlock, type BrandProfile } from './generate';
import type { PersonaData } from '../persona';

export type TranslatePersona = { id: string; name: string; tagline: string; role: string; data: PersonaData };
export type Translation = { personaId: string; translation: string };

const SYSTEM = `Você é um estrategista de comunicação sênior. Sua tarefa é TRADUZIR um TERRITÓRIO (um tema de conteúdo, muitas vezes um debate coletivo e macro) para o DIA A DIA de cada PERSONA, em português do Brasil.

O QUE É A TRADUÇÃO
- Um parágrafo curto (2 a 4 frases) que diz COMO esse tema aparece na vida da persona: a cena do cotidiano, o momento em que ela esbarra nele, o que ela já sente, diz ou teme a respeito. É a PONTE entre o tema coletivo e a experiência individual.
- Escreva em linguagem de rua, simples, concreta, a partir do universo da persona (o trabalho, o lugar, as contas, a rotina dela). Sem jargão, sem "marketês", sem explicar o tema como um verbete.
- Cada persona recebe uma tradução DIFERENTE, porque cada uma vive o tema de um jeito. Não repita a mesma cena para personas distintas.
- Mantenha o caráter coletivo do tema: a tradução mostra onde ele pesa na vida da persona, sem reduzi-lo a um problema individual nem culpar a pessoa.
- NÃO invente números, leis, datas ou fontes. Sem dado real, fale em termos qualitativos.
- Se o tema realmente não toca uma persona, diga em uma frase curta qual é a ponte mais plausível (ou que a ligação é fraca), em vez de forçar.
- Ligue, de forma natural, ao que a ORGANIZAÇÃO faz e defende (veja a identidade da marca). Respeite o tom de voz da marca.`;

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['items'],
  properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['persona_id', 'translation'], properties: { persona_id: { type: 'string' }, translation: { type: 'string' } } } } },
};

const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

function personaLine(p: TranslatePersona) {
  const L = (t: string, a: string[]) => (a.length ? `\n  ${t}: ${a.slice(0, 5).join('; ')}` : '');
  return `- id ${p.id} · ${p.name}${p.role ? ` (${p.role})` : ''}\n  Resumo: ${p.tagline}${p.data.bio ? `\n  Contexto: ${p.data.bio}` : ''}${L('Dores', p.data.pains)}${L('Objetivos', p.data.goals)}${L('Gatilhos', p.data.triggers)}`;
}

/** Traduz um território para o dia a dia de cada persona. Não grava nada: o usuário revisa antes. */
export async function translateTerritory(a: {
  path: string[]; description: string; personas: TranslatePersona[]; brand: BrandProfile; instructions: string;
}): Promise<{ items: Translation[]; inputTokens: number; outputTokens: number }> {
  if (process.env.AI_MOCK === '1') {
    await new Promise((r) => setTimeout(r, 600));
    return { items: a.personas.map((p) => ({ personaId: p.id, translation: `Como “${a.path.at(-1)}” aparece na vida de ${p.name}: cena de exemplo do dia a dia.` })), inputTokens: 900, outputTokens: 500 };
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError('ANTHROPIC_API_KEY não configurada no servidor.');
  const user = [
    `TERRITÓRIO: ${a.path.join(' › ')}${a.description ? `\nO que entra aqui: ${a.description}` : ''}`,
    `PERSONAS (traduza o tema para cada uma, usando o id exato em "persona_id"):\n${a.personas.map(personaLine).join('\n')}`,
    `TAREFA: devolva uma tradução para CADA persona listada (${a.personas.length}).`,
    a.instructions.trim() ? `INSTRUÇÕES EXTRAS DO USUÁRIO:\n${a.instructions.trim()}` : '',
  ].filter(Boolean).join('\n\n');
  try {
    const res = await new Anthropic().beta.messages.create({
      model: AI_MODEL, max_tokens: 8000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      system: [SYSTEM, brandBlock(a.brand)].filter(Boolean).join('\n\n'),
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: user }],
    });
    if (res.stop_reason === 'refusal') throw new AiError('A IA recusou gerar as traduções.');
    if (res.stop_reason === 'max_tokens') throw new AiError('A resposta ficou grande demais. Escolha menos personas.', true);
    const raw = JSON.parse(res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '') as { items?: { persona_id?: string; translation?: string }[] };
    const ids = new Set(a.personas.map((p) => p.id));
    const seen = new Set<string>();
    const items: Translation[] = [];
    for (const x of raw.items ?? []) {
      const id = clean(x.persona_id, 60), t = clean(x.translation, 1200);
      if (!ids.has(id) || seen.has(id) || !t) continue;
      seen.add(id); items.push({ personaId: id, translation: t });
    }
    if (!items.length) throw new AiError('A IA não trouxe nenhuma tradução. Tente de novo.', true);
    const u = res.usage as { input_tokens?: number; output_tokens?: number } | undefined;
    return { items, inputTokens: u?.input_tokens ?? 0, outputTokens: u?.output_tokens ?? 0 };
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof SyntaxError) throw new AiError('A IA devolveu uma resposta inválida. Tente de novo.', true);
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Limite de uso da IA atingido. Tente em instantes.', true);
    if (e instanceof Anthropic.AuthenticationError) throw new AiError('Chave da Anthropic inválida no servidor.');
    if (e instanceof Anthropic.APIError) throw new AiError(`Erro da IA (${e.status}).`, (e.status ?? 500) >= 500);
    throw new AiError('Não foi possível falar com a IA.', true);
  }
}
