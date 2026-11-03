/**
 * Limite de uso simples, em memória (o app roda em um único processo): janela deslizante por chave.
 * Protege o custo das chamadas de IA e as rotas de gravação contra abuso ou laços de requisições.
 */
const hits = new Map<string, number[]>();

/** true = pode seguir; false = passou do limite (`max` chamadas em `windowMs`). */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) { hits.set(key, list); return false; }
  list.push(now); hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}

export const TOO_MANY = { error: 'Muitas solicitações seguidas à IA. Aguarde alguns instantes e tente de novo.' };
