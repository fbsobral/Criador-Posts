/**
 * Geração de imagens com o Nano Banana (API do Gemini / Google AI Studio).
 * Usa a Interactions API: POST {base}/v1beta/interactions
 * Docs: https://ai.google.dev/gemini-api/docs/image-generation
 */

export const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-nano-banana-2.1';
export const ASPECT_RATIOS = ['1:1', '4:3', '16:9', '4:5', '3:4', '9:16'] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];
export const MAX_PROMPT_CHARS = 1500;

export class ImageError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

export const imageEnabled = () => !!process.env.GEMINI_API_KEY || process.env.AI_MOCK === '1';

/** Procura o primeiro bloco de imagem em qualquer lugar da resposta (aceita o formato novo e o antigo). */
export function findImage(node: unknown): { data: string; mime: string } | null {
  if (!node || typeof node !== 'object') return null;
  const o = node as Record<string, unknown>;
  if (o.type === 'image' && typeof o.data === 'string' && o.data.length > 100) {
    return { data: o.data, mime: typeof o.mime_type === 'string' ? o.mime_type : 'image/png' };
  }
  const inline = (o.inlineData ?? o.inline_data) as Record<string, unknown> | undefined;
  if (inline && typeof inline.data === 'string' && inline.data.length > 100) {
    return { data: inline.data, mime: String(inline.mimeType ?? inline.mime_type ?? 'image/png') };
  }
  for (const v of Object.values(o)) {
    const hit = findImage(v);
    if (hit) return hit;
  }
  return null;
}

export const MAX_BRIEF_CHARS = 1500;

/** Soma o briefing de imagens da marca e o do post (o do post prevalece em caso de conflito). */
export function combineBriefs(brand: string, post: string): string {
  const b = brand.trim().slice(0, MAX_BRIEF_CHARS), p = post.trim().slice(0, MAX_BRIEF_CHARS);
  return [b && `Marca: ${b}`, p && `Este post: ${p}`].filter(Boolean).join('\n');
}

/** Monta o prompt final: descrição + briefing visual (marca + post) + regras fixas. */
export function buildPrompt(description: string, brief: string): string {
  return [
    description.trim(),
    brief.trim() ? `Briefing visual (siga; se houver conflito, o do post prevalece):\n${brief.trim()}` : '',
    'Não inclua texto, letras, números, logotipos nem marcas d\'água na imagem, a menos que a descrição peça explicitamente.',
  ].filter(Boolean).join('\n');
}

/** Gera uma imagem. Devolve base64 + mime. */
export async function generateImage(prompt: string, aspectRatio: AspectRatio): Promise<{ data: string; mime: string }> {
  if (process.env.AI_MOCK === '1') return mockImage(prompt, aspectRatio);
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new ImageError('GEMINI_API_KEY não configurada no servidor.', 503);

  const base = (process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
  let res: Response;
  try {
    res = await fetch(`${base}/v1beta/interactions`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        input: [{ type: 'text', text: prompt }],
        response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: aspectRatio, image_size: '1K' },
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    const timeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
    throw new ImageError(timeout ? 'A geração da imagem demorou demais. Tente de novo.' : 'Não foi possível falar com o Google.', 504);
  }

  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* corpo não-JSON */ }

  if (!res.ok) {
    const msg: string = json?.error?.message || json?.message || text.slice(0, 200);
    if (res.status === 401 || res.status === 403) throw new ImageError(`Chave do Google recusada: ${msg}`, 503);
    if (res.status === 429) throw new ImageError('Limite de uso do Google atingido. Tente novamente em instantes.', 429);
    if (res.status === 400) throw new ImageError(`O Google recusou o pedido: ${msg}`, 422);
    throw new ImageError(`Erro do Google (${res.status}): ${msg}`, 502);
  }

  const img = findImage(json);
  if (!img) {
    const why = json?.errors?.[0]?.message || (json?.status && json.status !== 'completed' ? `status: ${json.status}` : '');
    throw new ImageError(`O Google não devolveu imagem${why ? ` (${why})` : ''}. Tente reescrever a descrição.`, 422);
  }
  return img;
}

/** Imagem simulada (AI_MOCK=1) — um degradê com a descrição, para desenvolver sem gastar. */
async function mockImage(prompt: string, ratio: AspectRatio): Promise<{ data: string; mime: string }> {
  await new Promise((r) => setTimeout(r, 900));
  if (/erro/i.test(prompt)) throw new ImageError('Erro simulado (a descrição continha "erro").', 422);
  const [w, h] = ratio.split(':').map(Number);
  const W = 1024, H = Math.round((1024 * h) / w);
  const label = prompt.split('\n')[0].slice(0, 60).replace(/[<&>]/g, ' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFB02E"/><stop offset="1" stop-color="#F97335"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="50%" font-family="sans-serif" font-size="34" fill="#fff" text-anchor="middle">${label}</text></svg>`;
  return { data: Buffer.from(svg).toString('base64'), mime: 'image/svg+xml' };
}
