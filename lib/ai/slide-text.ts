import Anthropic from '@anthropic-ai/sdk';
import { AI_MODEL, AiError, brandBlock, sanitizeHtml, type BrandProfile } from './generate';

export type SlideTextInput = {
  editor: 'carrossel' | 'tweet';
  /** Texto atual do slide: HTML do carrossel ou texto puro do Tweet Card. */
  current: string;
  format: string;
  slideIndex: number;
  total: number;
  outline: string[];
  title: string;
  topic: string;
  /** O que o usuário quer mudar. */
  feedback: string;
  /** Sugestão anterior que o usuário não aprovou (com o novo pedido, a IA parte dela). */
  previous?: string;
  /** O slide tem imagem ou botão: pouco espaço para texto. */
  tight?: boolean;
  brand: BrandProfile;
};

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['text', 'note'],
  properties: { text: { type: 'string' }, note: { type: 'string' } },
};

const SYSTEM = `Você é um redator sênior de conteúdo para redes sociais. O usuário pediu um ajuste no texto de UM slide de um post. Devolva o slide reescrito, em JSON estrito.

REGRAS
- Aplique o feedback do usuário. Mude só o que o feedback pede ou o que for necessário para atendê-lo; preserve o resto (ideia, tom, fatos, estrutura).
- Não invente fatos, números, datas, nomes ou fontes. Use apenas o que já está no slide, no contexto do post ou no feedback.
- Leia o POST INTEIRO antes de reescrever. O slide faz parte de uma sequência: continue a ideia do slide anterior, abra caminho para o seguinte e não repita argumentos, exemplos, expressões nem a chamada para ação que os outros slides já usam. Não contradiga nada do post e não antecipe o que outro slide vai explicar.
- Se o feedback pedir algo que repetiria ou contradiria outro slide, atenda do jeito que preserva a coerência do post e explique em "note".
- Respeite o tom de voz e as regras da marca. Português do Brasil. Evite clichês de IA ("mergulhe", "desvende", "no mundo de hoje").
- Se houver "SUGESTÃO ANTERIOR (não aprovada)", parta dela e aplique o novo pedido, sem voltar atrás no que já estava bom.
- "note": uma frase curta dizendo o que você mudou (ex.: "Encurtei o título e troquei o exemplo por um mais concreto").`;

const CARROSSEL = `FORMATO DO TEXTO (carrossel)
"text" é HTML e aceita somente: <h2> título, <p> parágrafo, <ul class="check"> lista com ✔, <ul class="arrow"> lista com →, <ul class="dot"> lista com marcadores, <li>, <b>, <i>, <u>, <br>. Nenhum outro atributo. Slide "cover" (capa): título forte + gancho curto. O texto deve caber no slide: no máximo ~50 palavras (~30 em "text-image").`;

const TWEET = `FORMATO DO TEXTO (Tweet Card)
"text" é texto puro (sem HTML nem markdown), como um post de rede social. O card tem espaço limitado: no máximo ~38 palavras (~22 quando o slide tem imagem ou botão).`;

/** Reescreve o texto de um slide a partir de um feedback. Não grava nada: o usuário aprova no editor. */
export async function adjustSlideText(i: SlideTextInput): Promise<{ text: string; note: string; inputTokens: number; outputTokens: number }> {
  if (process.env.AI_MOCK === '1') {
    const t = `[ajustado: ${i.feedback.slice(0, 50)}] ${i.editor === 'carrossel' ? i.current : i.current.slice(0, 160)}`;
    return { text: i.editor === 'carrossel' ? sanitizeHtml(t) : t, note: 'Versão simulada (AI_MOCK=1).', inputTokens: 0, outputTokens: 0 };
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError('ANTHROPIC_API_KEY não configurada no servidor.');

  const user = [
    `POST: ${i.title || '(sem título)'}${i.topic ? ` · tema: ${i.topic}` : ''}`,
    i.outline.length ? `POST COMPLETO (texto de cada slide, na ordem; o slide a ajustar é o ${i.slideIndex}):\n${i.outline.map((l) => `- ${l}`).join('\n')}` : '',
    `ESTE É O SLIDE ${i.slideIndex} DE ${i.total} (formato: ${i.format}${i.tight ? '; tem imagem ou botão, então o espaço de texto é menor' : ''}).`,
    `TEXTO ATUAL DO SLIDE:\n${i.current || '(vazio)'}`,
    i.previous?.trim() ? `SUGESTÃO ANTERIOR (não aprovada):\n${i.previous.trim()}` : '',
    `FEEDBACK DO USUÁRIO:\n${i.feedback.trim()}`,
  ].filter(Boolean).join('\n\n');

  let res;
  try {
    res = await new Anthropic().beta.messages.create({
      model: AI_MODEL, max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      system: [SYSTEM, brandBlock(i.brand), i.editor === 'carrossel' ? CARROSSEL : TWEET].filter(Boolean).join('\n\n'),
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: user }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Limite de uso da IA atingido. Tente em instantes.', true);
    if (e instanceof Anthropic.APIError) throw new AiError(`Erro da IA (${e.status}).`);
    throw new AiError('Não foi possível falar com a IA.');
  }
  if (res.stop_reason === 'refusal') throw new AiError('A IA recusou este ajuste.');
  const raw = res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '';
  let out: { text?: string; note?: string };
  try { out = JSON.parse(raw); } catch { throw new AiError('A IA devolveu uma resposta inválida. Tente de novo.', true); }
  const body = String(out.text ?? '').trim();
  if (!body) throw new AiError('A IA não devolveu o texto. Tente de novo.', true);
  return {
    text: i.editor === 'carrossel' ? sanitizeHtml(body).slice(0, 4000) : body.replace(/<[^>]*>/g, '').slice(0, 1200),
    note: String(out.note ?? '').trim().slice(0, 300),
    inputTokens: res.usage?.input_tokens ?? 0, outputTokens: res.usage?.output_tokens ?? 0,
  };
}
