import Anthropic from '@anthropic-ai/sdk';
import { AI_MODEL, AiError, brandBlock, type BrandProfile } from './generate';
import { personaBlock } from './idea';
import type { PersonaData } from '../persona';
import type { IdeaFields } from '../idea';
import { CAROUSEL_ANGLES, IDEA_TO_SLIDES, slidesRule, type CarouselAngleId } from './carousel-rules';

/** Carrossel a partir de ideia: bloco estruturado da ideia e planejamento do roteiro dos slides (com IA). As regras puras estão em carousel-rules.ts. */

/* ---------------- bloco estruturado da ideia ---------------- */
type PersonaIn = { name: string; tagline: string; role: string; data: PersonaData };

/** Regra de público amplo: a ideia é para duas ou mais personas ao mesmo tempo. Entra no bloco da ideia, então vale para carrossel, artigo e planejamento. */
export const MULTI_AUDIENCE = `PÚBLICO AMPLO (esta ideia é para VÁRIAS personas ao mesmo tempo; esta regra vale no lugar de "fale com a persona")
- Fale com o GRUPO pelo que ele tem em comum e chame-o de forma ampla e concreta ("quem está procurando o primeiro emprego", "quem contrata jovens"), nunca pelo nome de um perfil e sem escolher uma persona só.
- Parta do que é COMUM entre os perfis (a situação, a dor, a pergunta que todos se fazem). Use os perfis como reservatório: cenas, objeções e palavras de cada um podem aparecer, cada uma reconhecível por quem a vive, mas o texto não vira de uma persona só.
- Se as personas estão em LADOS diferentes do problema (ex.: quem procura vaga e quem contrata), use o ângulo de PONTE: o mesmo problema visto dos dois lados, cada lado reconhece a sua perda e o seu ganho, e a solução serve aos dois.
- "Você" só quando a frase serve a todos; quando for de um lado só, diga de quem é ("quem contrata sabe…", "para quem está começando…").
- UMA CTA só, para quem a CTA da ideia convoca (o grupo todo ou um dos lados).`;

/** A ideia como texto estruturado, com cada campo no seu lugar. Aceita uma persona ou várias (público amplo). */
export function ideaBlockFor(f: IdeaFields, persona: PersonaIn | PersonaIn[] | null, personaName: string, territory: string): string {
  const list = Array.isArray(persona) ? persona : persona ? [persona] : [];
  const lines = (t: string) => t.split('\n').map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim()).filter(Boolean);
  const profile = (p: PersonaIn) => `${personaBlock(p).replace(/^PERSONA: /, '')}${p.data.quote ? `\nFrase típica: ${p.data.quote}` : ''}`;
  const out = [
    'IDEIA DE CONTEÚDO (estruturada)',
    list.length > 1 ? `Público: várias personas (público amplo): ${list.map((p) => p.name).join('; ')}` : `Persona: ${list[0] ? list[0].name : personaName || 'público geral (sem persona)'}`,
    territory ? `Território: ${territory}` : '',
    f.pain && `DOR (a cena que a pessoa reconhece): ${f.pain}`,
    f.impact && `IMPACTO (o que a dor custa): ${f.impact}`,
    f.cause && `CAUSA (por que acontece, coletiva): ${f.cause}`,
    f.guide && `GUIA (enquadramento): ${f.guide}`,
    lines(f.args).length ? `ARGUMENTOS (razões que sustentam a solução; independentes, não um passo a passo):\n${lines(f.args).map((a) => `- ${a}`).join('\n')}` : '',
    f.gain && `GANHO (resultado racional): ${f.gain}`,
    f.desire && `DESEJO (resultado emocional): ${f.desire}`,
    f.cta && `CTA da ideia (a ação desejada, sem canal): ${f.cta}`,
    list.length === 1 ? `\nPERFIL DA PERSONA\n${profile(list[0])}` : '',
    list.length > 1 ? `\nPERFIS DAS PERSONAS (o público é o conjunto; use-os como referência, não fale com uma só)\n${list.map((p, i) => `${i + 1}. ${profile(p)}`).join('\n\n')}\n\n${MULTI_AUDIENCE}` : '',
  ].filter(Boolean);
  return out.join('\n').slice(0, 14000);
}

/* ---------------- planejamento (roteiro dos slides) ---------------- */
export type CarouselPlan = { angle: string; promise: string; slides: { role: string; message: string }[]; covers: string[] };

const STR = { type: 'string' } as const;
const PLAN_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['angle', 'promise', 'slides', 'covers'],
  properties: {
    angle: { type: 'string', enum: CAROUSEL_ANGLES.filter((a) => a.id !== 'auto').map((a) => a.id) },
    promise: STR,
    slides: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['role', 'message'], properties: { role: STR, message: STR } } },
    covers: { type: 'array', items: STR },
  },
};

const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

const PLAN_SYSTEM = `Você é um diretor de conteúdo sênior de redes sociais. Você planeja o ROTEIRO DOS SLIDES de um carrossel (ainda sem escrever os slides), em JSON estrito, em português do Brasil.

SAÍDA
- "angle": o ângulo narrativo escolhido (um dos ids permitidos).
- "promise": a promessa do carrossel em uma frase: o que a persona leva ao terminar de ler.
- "slides": um item por slide, na ordem. "role": a função do slide (ex.: "Capa", "Identificação", "Virada", "Prova 1", "Exemplo", "Futuro", "CTA"). "message": a mensagem do slide em UMA frase curta e concreta (até 18 palavras), já no tom final, que pode virar o título do slide. A mensagem do slide 1 é o título da capa.
- "covers": 3 alternativas de título de capa, com abordagens diferentes (tensão/contradição, pergunta, promessa), até 10 palavras cada, diferentes da mensagem do slide 1 e ESPECÍFICAS (usam elementos concretos da ideia; nada genérico como "Por que tantos jovens…?").
- A sequência precisa ter fio: cada mensagem responde a uma pergunta que a anterior deixou e puxa a seguinte (cena → custo → causa → virada → o que muda, com exemplo → resultado → ação). É uma história com argumento, não uma lista de dicas: nenhuma mensagem de prova começa com verbo no imperativo ou infinitivo ("Comece…", "Conecte…") e no máximo 2 ou 3 slides são de prova.
- O último slide é a CTA DA IDEIA: a mesma ação e o mesmo destinatário (sem trocar por "siga a página" ou outra CTA genérica).
- Nada de abstração nem de tease vazio ("E aí tudo muda", "Mas tem um detalhe"); sem inventar números, datas nem nomes.`;

/** Planeja o roteiro dos slides para o usuário aprovar antes da escrita. Não grava nada. */
export async function planCarousel(a: { idea: string; angle: CarouselAngleId; slides: number; instructions: string; brand: BrandProfile }): Promise<CarouselPlan & { inputTokens: number; outputTokens: number }> {
  const n = a.slides > 0 ? a.slides : 7;
  if (process.env.AI_MOCK === '1') {
    await new Promise((r) => setTimeout(r, 600));
    const roles = ['Capa', 'Identificação', 'Virada', 'Prova 1', 'Prova 2', 'Futuro', 'CTA'];
    return {
      angle: a.angle === 'auto' ? 'crenca' : a.angle, promise: 'Entender por que o problema acontece e o que muda a situação.',
      slides: Array.from({ length: n }, (_, i) => ({ role: roles[i] ?? `Slide ${i + 1}`, message: `Mensagem do slide ${i + 1} de exemplo.` })),
      covers: ['Capa alternativa em forma de tensão', 'Capa alternativa em forma de pergunta?', 'Capa alternativa em forma de promessa'], inputTokens: 900, outputTokens: 500,
    };
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError('ANTHROPIC_API_KEY não configurada no servidor.');
  const angle = CAROUSEL_ANGLES.find((x) => x.id === a.angle);
  const user = [
    a.idea,
    angle && angle.guide ? `ÂNGULO ESCOLHIDO PELO USUÁRIO:\n${angle.guide}` : 'ÂNGULO: escolha o que melhor serve a esta ideia, entre os ids permitidos.',
    `QUANTIDADE: ${slidesRule(a.slides)}`,
    a.instructions.trim() ? `INSTRUÇÕES EXTRAS DO USUÁRIO:\n${a.instructions.trim()}` : '',
  ].filter(Boolean).join('\n\n');
  try {
    const res = await new Anthropic().beta.messages.create({
      model: AI_MODEL, max_tokens: 3000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      system: [PLAN_SYSTEM, IDEA_TO_SLIDES, brandBlock(a.brand)].filter(Boolean).join('\n\n'),
      output_config: { effort: 'low', format: { type: 'json_schema', schema: PLAN_SCHEMA } },
      messages: [{ role: 'user', content: user }],
    });
    if (res.stop_reason === 'refusal') throw new AiError('A IA recusou planejar este carrossel.');
    if (res.stop_reason === 'max_tokens') throw new AiError('A resposta ficou grande demais. Tente de novo.', true);
    const raw = JSON.parse(res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '') as { angle?: string; promise?: string; slides?: { role?: string; message?: string }[]; covers?: string[] };
    const slides = (raw.slides ?? []).map((s) => ({ role: clean(s.role, 40), message: clean(s.message, 220) })).filter((s) => s.message).slice(0, 10);
    if (slides.length < 3) throw new AiError('A IA não devolveu um roteiro de slides válido. Tente de novo.', true);
    const u = res.usage as { input_tokens?: number; output_tokens?: number } | undefined;
    return { angle: clean(raw.angle, 30), promise: clean(raw.promise, 240), slides, covers: (raw.covers ?? []).map((c) => clean(c, 120)).filter(Boolean).slice(0, 3), inputTokens: u?.input_tokens ?? 0, outputTokens: u?.output_tokens ?? 0 };
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof SyntaxError) throw new AiError('A IA devolveu uma resposta inválida. Tente de novo.', true);
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Limite de uso da IA atingido. Tente em instantes.', true);
    if (e instanceof Anthropic.AuthenticationError) throw new AiError('Chave da Anthropic inválida no servidor.');
    if (e instanceof Anthropic.APIError) throw new AiError(`Erro da IA (${e.status}).`, (e.status ?? 500) >= 500);
    throw new AiError('Não foi possível falar com a IA.', true);
  }
}

