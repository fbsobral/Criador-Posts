import Anthropic from '@anthropic-ai/sdk';
import { AI_MODEL, AiError, brandBlock, type BrandProfile } from './generate';

import { NETWORKS, type Network } from './networks';
export { NETWORKS, type Network };

const GUIDE: Record<Network, string> = {
  instagram: `INSTAGRAM
- 1ª linha: gancho curto que mostra o que a pessoa ganha ao ler.
- 2 a 4 parágrafos curtos, com linhas em branco entre eles, que COMPLEMENTAM o post (não repita os slides).
- Termine com a chamada para ação da marca, se houver.
- Hashtags no fim: siga as regras da marca; se não houver, 3 a 5 relevantes.
- Ideal até ~1.200 caracteres (limite 2.200).`,
  tiktok: `TIKTOK
- Curta: 1 a 2 frases com gancho + chamada para ação.
- 3 a 5 hashtags relevantes (siga as regras da marca).
- Ideal até ~300 caracteres.`,
  x: `X (TWITTER)
- UMA publicação curta, no máximo 270 caracteres no total, contando hashtags.
- Direta, com a ideia principal; 0 a 2 hashtags.
- Sem enchimento e sem quebras de linha desnecessárias.`,
};

const SCHEMA = { type: 'object', additionalProperties: false, required: ['caption'], properties: { caption: { type: 'string' } } };

const SYSTEM = `Você é um redator sênior de redes sociais. Escreva a LEGENDA para publicar junto com um post (carrossel ou Tweet Card), em português do Brasil.

REGRAS
- A legenda complementa o post: não repita os slides, e entregue uma razão para a pessoa ler, salvar ou compartilhar.
- Respeite o tom de voz, as regras e as "Regras das legendas" da marca.
- NÃO invente fatos, números, datas ou fontes: use só o que está no post.
- Devolva só o texto da legenda, pronto para colar (sem aspas, sem título, sem explicações).`;

/** Cria (ou ajusta, com feedback) a legenda de um post para a rede escolhida. */
export async function generateCaptionText(i: {
  script: string; title: string; brand: BrandProfile; network: Network; instruction?: string; previous?: string;
}): Promise<string> {
  const limit = NETWORKS[i.network].limit;
  if (process.env.AI_MOCK === '1') return `Legenda de exemplo para ${NETWORKS[i.network].label}${i.instruction ? ` (${i.instruction})` : ''}.\n\n#exemplo`.slice(0, limit);
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError('ANTHROPIC_API_KEY não configurada no servidor.');

  const user = [
    `POST: ${i.title}`,
    `CONTEÚDO DO POST:\n${i.script.slice(0, 6000)}`,
    `FORMATO DA LEGENDA (${NETWORKS[i.network].label}):\n${GUIDE[i.network]}`,
    i.previous?.trim() ? `LEGENDA ATUAL:\n${i.previous.trim()}` : '',
    i.instruction?.trim() ? `PEDIDO DO USUÁRIO${i.previous?.trim() ? ' (ajuste a legenda atual aplicando isto)' : ''}:\n${i.instruction.trim()}` : '',
  ].filter(Boolean).join('\n\n');

  try {
    const client = new Anthropic();
    const res = await client.beta.messages.create({
      model: AI_MODEL, max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      system: [SYSTEM, brandBlock(i.brand)].filter(Boolean).join('\n\n'),
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: user }],
    });
    if (res.stop_reason === 'refusal') throw new AiError('A IA recusou gerar esta legenda.');
    const text = res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '';
    const caption = String((JSON.parse(text) as { caption?: string }).caption ?? '').trim();
    if (!caption) throw new AiError('A IA não devolveu a legenda. Tente de novo.', true);
    return caption.slice(0, limit);
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Limite de uso da IA atingido. Tente em instantes.', true);
    if (e instanceof Anthropic.APIError) throw new AiError(`Erro da IA (${e.status}).`);
    throw new AiError('Não foi possível gerar a legenda.');
  }
}
