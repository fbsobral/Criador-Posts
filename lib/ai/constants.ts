/** Constantes da geração com IA que também são usadas no navegador (sem importar o SDK). */
export const MAX_SLIDES = 12;
export const MAX_ITEMS_PER_BATCH = 30;
/** Preço por 1M de tokens (US$) do modelo de geração (Claude Opus 5.5). */
export const PRICE_PER_MTOK = { input: 4, output: 20 };
/** Média por post, só para a estimativa exibida antes de rodar. */
export const ESTIMATED_COST_PER_POST = 0.08;

export const costUsd = (inputTokens: number, outputTokens: number) =>
  (inputTokens * PRICE_PER_MTOK.input + outputTokens * PRICE_PER_MTOK.output) / 1_000_000;

export const fmtUsd = (v: number) => `US$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: v < 1 ? 3 : 2 })}`;

/** Um tema por linha, ou roteiros separados por uma linha com "---". */
export function parseBriefs(raw: string, mode: 'tema' | 'roteiro'): string[] {
  const parts = mode === 'roteiro' ? raw.split(/^\s*-{3,}\s*$/m) : raw.split('\n');
  return parts
    .map((t) => (mode === 'roteiro' ? t.trim() : t.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()))
    .filter(Boolean);
}
