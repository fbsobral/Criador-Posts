/** Prioridade dos territórios: score de 1 a 100, critérios (o que pesa no score) e faixas (nome e cor de cada prioridade). Servidor e navegador. */

export type PriorityCriterion = { id: string; name: string; description: string; weight: number };
export type PriorityLevel = { id: string; name: string; min: number; color: string };
export type PriorityConfig = { criteria: PriorityCriterion[]; levels: PriorityLevel[] };

export const DEFAULT_PRIORITY: PriorityConfig = {
  /** Começa sem critérios: o primeiro passo é pedir à IA que os sugira a partir do que a organização faz. */
  criteria: [],
  levels: [
    { id: 'p1', name: 'Alta', min: 70, color: '#E5484D' },
    { id: 'p2', name: 'Média', min: 40, color: '#F59E0B' },
    { id: 'p3', name: 'Baixa', min: 1, color: '#8A857A' },
  ],
};

export const MAX_CRITERIA = 8;
export const MAX_LEVELS = 6;
export const ESTIMATED_COST_PER_SCORED = 0.0012;

export const clampScore = (n: unknown) => Math.min(100, Math.max(1, Math.round(Number(n)) || 1));

/** Faixa do score: a de maior "min" que o score alcança. Sem score ou sem faixas, nulo. */
export function levelOf(score: number | null | undefined, levels: PriorityLevel[]): PriorityLevel | null {
  if (!score) return null;
  return [...levels].sort((a, b) => b.min - a.min).find((l) => score >= l.min) ?? null;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
/** Limpa o que veio do formulário: nomes, pesos 1–10, faixas com "min" distintos. Pode ficar sem critérios. */
export function sanitizePriority(c: Partial<PriorityConfig> | null | undefined): PriorityConfig {
  const criteria = (c?.criteria ?? []).slice(0, MAX_CRITERIA)
    .map((x, i) => ({ id: String(x.id || `c${i}`).slice(0, 20), name: String(x.name ?? '').trim().slice(0, 60), description: String(x.description ?? '').trim().slice(0, 240), weight: Math.min(10, Math.max(1, Math.round(Number(x.weight)) || 1)) }))
    .filter((x) => x.name);
  const seen = new Set<number>();
  const levels = (c?.levels ?? []).slice(0, MAX_LEVELS)
    .map((x, i) => ({ id: String(x.id || `l${i}`).slice(0, 20), name: String(x.name ?? '').trim().slice(0, 30), min: Math.min(100, Math.max(1, Math.round(Number(x.min)) || 1)), color: HEX.test(String(x.color)) ? String(x.color) : '#8A857A' }))
    .filter((x) => x.name && !seen.has(x.min) && seen.add(x.min));
  if (!levels.some((l) => l.min === 1)) levels.push({ id: 'base', name: levels.length ? 'Sem prioridade' : 'Baixa', min: 1, color: '#8A857A' });
  return { criteria, levels };
}

export const priorityOf = (c: PriorityConfig | null | undefined): PriorityConfig => (c ? sanitizePriority(c) : DEFAULT_PRIORITY);
