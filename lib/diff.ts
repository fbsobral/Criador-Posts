/** Diferença palavra a palavra entre dois textos (para mostrar o que mudou, como o "controle de alterações" de um editor de texto). */
export type Seg = { t: string; k: 'same' | 'add' | 'del' };

const tokens = (s: string) => s.match(/\s+|[^\s]+/g) ?? [];

export function wordDiff(before: string, after: string): Seg[] {
  const a = tokens(before), b = tokens(after);
  // textos enormes: não vale o custo, mostra tudo como troca
  if (a.length * b.length > 250_000) return [...(before ? [{ t: before, k: 'del' as const }] : []), ...(after ? [{ t: after, k: 'add' as const }] : [])];
  const n = a.length, m = b.length;
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: Seg[] = [];
  const push = (t: string, k: Seg['k']) => { const last = out[out.length - 1]; if (last && last.k === k) last.t += t; else out.push({ t, k }); };
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { push(a[i], 'same'); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { push(a[i], 'del'); i++; }
    else { push(b[j], 'add'); j++; }
  }
  while (i < n) push(a[i++], 'del');
  while (j < m) push(b[j++], 'add');
  return out;
}
