import { sanitizeHtml } from './ai/generate';

/**
 * Defesa no servidor para o que o navegador manda ao salvar um post. Os editores montam o HTML dos slides com
 * template strings, então qualquer valor que vire atributo, estilo ou HTML precisa ser de um formato conhecido.
 * Sem isso, um membro da marca poderia gravar um valor malicioso (XSS armazenado) que rodaria no navegador de outro membro.
 */
const URL_KEYS = new Set(['image', 'bgImage', 'logo', 'avatar', 'photo']);
const SAFE_URL = [
  /^$/,
  /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/, // upload local ainda não enviado à galeria
  /^\/api\/assets\/[0-9a-f-]{36}(?:\?thumb=1)?$/, // imagem da galeria da marca
  /^https:\/\/[^\s"'<>()\\`]+$/, // imagem externa (sem caracteres que escapam de atributo/estilo)
];
const SAFE_RATIO = /^(?:orig|custom|[0-9]{1,3}(?:\.[0-9]+)?(?:\s*\/\s*[0-9]{1,3}(?:\.[0-9]+)?)?)$/;
export const MAX_POST_BYTES = 12 * 1024 * 1024;

function walk(v: unknown, key: string, depth: number): unknown {
  if (depth > 8) return null;
  if (typeof v === 'string') {
    if (URL_KEYS.has(key)) return SAFE_URL.some((r) => r.test(v)) ? v : '';
    if (key === 'html') return sanitizeHtml(v);
    if (key === 'ratio') return SAFE_RATIO.test(v) ? v : '';
    return v;
  }
  if (Array.isArray(v)) return v.slice(0, 200).map((x) => walk(x, key, depth + 1));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = walk(x, k, depth + 1);
    return out;
  }
  return v;
}

export const sanitizePostData = <T>(data: T): T => walk(data, '', 0) as T;
