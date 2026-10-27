/** Tipos, árvore e layout do mapa mental de territórios (servidor e navegador). */

export type TNode = { id: string; personaId: string; parentId: string | null; name: string; description: string; position: number; source: string };

/** Identificador do mapa sem persona ("Público geral") no navegador; no banco é persona_id nulo. */
export const PUBLICO_ID = 'publico';
export const MAX_TERRITORY_NODES_PER_RUN = 60;
export const ESTIMATED_COST_TERRITORY_BASE = 0.01;
export const ESTIMATED_COST_PER_TERRITORY = 0.0015;
export const MAX_DEPTH = 6;

export type TreeItem<T> = { id: string; data: T; children: TreeItem<T>[] };

/** Monta a árvore (ordenada por posição) a partir da lista plana. Nós órfãos viram raízes. */
export function buildTree(nodes: TNode[]): TreeItem<TNode>[] {
  const ids = new Set(nodes.map((n) => n.id));
  const kids = new Map<string | null, TNode[]>();
  for (const n of nodes) {
    const k = n.parentId && ids.has(n.parentId) ? n.parentId : null;
    (kids.get(k) ?? kids.set(k, []).get(k)!).push(n);
  }
  const make = (n: TNode): TreeItem<TNode> => ({ id: n.id, data: n, children: (kids.get(n.id) ?? []).sort((a, b) => a.position - b.position).map(make) });
  return (kids.get(null) ?? []).sort((a, b) => a.position - b.position).map(make);
}

export function descendantIds(nodes: TNode[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) { grew = false; for (const n of nodes) if (n.parentId && out.has(n.parentId) && !out.has(n.id)) { out.add(n.id); grew = true; } }
  return out;
}

export const depthOf = (nodes: TNode[], id: string): number => {
  const by = new Map(nodes.map((n) => [n.id, n]));
  let d = 0, cur = by.get(id);
  while (cur?.parentId && d < 50) { d++; cur = by.get(cur.parentId); }
  return d;
};

/** Caminho do nó, da raiz até ele. */
export function pathOf(nodes: TNode[], id: string): string[] {
  const by = new Map(nodes.map((n) => [n.id, n]));
  const out: string[] = [];
  let cur = by.get(id), g = 0;
  while (cur && g++ < 50) { out.unshift(cur.name); cur = cur.parentId ? by.get(cur.parentId) : undefined; }
  return out;
}

/** Texto da árvore com recuo, para a IA enxergar o que já existe. */
export function outline(nodes: TNode[], max = 220): string {
  const lines: string[] = [];
  const walk = (items: TreeItem<TNode>[], d: number) => { for (const it of items) { if (lines.length >= max) return; lines.push(`${'  '.repeat(d)}- ${it.data.name}`); walk(it.children, d + 1); } };
  walk(buildTree(nodes), 0);
  return lines.join('\n');
}

/* ---------- layout horizontal ---------- */
export const NODE_W = 232;
export const NODE_H = 54;
export const GAP_X = 72;
export const GAP_Y = 14;

export type Placed<T> = { id: string; data: T; x: number; y: number; depth: number; hasKids: boolean; collapsed: boolean };
export type Edge = { id: string; x1: number; y1: number; x2: number; y2: number };

/** Posiciona a árvore: colunas por nível, filhos empilhados e o pai centralizado sobre eles. A raiz virtual (persona) fica no nível 0. */
export function layoutTree<T>(roots: TreeItem<T>[], collapsed: Set<string>) {
  const placed: Placed<T>[] = [], edges: Edge[] = [];
  let cursor = 0;
  const col = (d: number) => d * (NODE_W + GAP_X);
  const place = (it: TreeItem<T>, d: number): number => {
    const isCollapsed = collapsed.has(it.id) && it.children.length > 0;
    let y: number;
    if (!it.children.length || isCollapsed) { y = cursor; cursor += NODE_H + GAP_Y; }
    else {
      const ys = it.children.map((c) => place(c, d + 1));
      y = (ys[0] + ys[ys.length - 1]) / 2;
      it.children.forEach((c, i) => edges.push({ id: `${it.id}>${c.id}`, x1: col(d) + NODE_W, y1: y + NODE_H / 2, x2: col(d + 1), y2: ys[i] + NODE_H / 2 }));
    }
    placed.push({ id: it.id, data: it.data, x: col(d), y, depth: d, hasKids: it.children.length > 0, collapsed: isCollapsed });
    return y;
  };
  const ys = roots.map((r) => place(r, 1));
  const rootY = ys.length ? (ys[0] + ys[ys.length - 1]) / 2 : 0;
  roots.forEach((r, i) => edges.push({ id: `root>${r.id}`, x1: NODE_W, y1: rootY + NODE_H / 2, x2: col(1), y2: ys[i] + NODE_H / 2 }));
  const width = Math.max(...placed.map((p) => p.x + NODE_W), NODE_W) + 40;
  const height = Math.max(cursor, NODE_H + GAP_Y) + 20;
  return { placed, edges, rootY, width, height };
}

export const edgePath = (e: Edge) => { const mx = (e.x1 + e.x2) / 2; return `M ${e.x1} ${e.y1} C ${mx} ${e.y1}, ${mx} ${e.y2}, ${e.x2} ${e.y2}`; };

/* ---------- visão geral (consolidada) ---------- */
export type Merged = { key: string; name: string; personaIds: string[]; descriptions: { personaId: string; text: string }[]; children: Merged[]; alsoIn: string[]; nodeIds: Record<string, string> };

const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

/** Junta os mapas de todas as personas: nós com o mesmo nome (sem acento e caixa) sob o mesmo pai viram um só, com as personas que o usam. */
export function mergeTrees(nodes: TNode[]): Merged[] {
  type G = TNode[];
  const kids = new Map<string | null, TNode[]>();
  for (const n of nodes) (kids.get(n.parentId) ?? kids.set(n.parentId, []).get(n.parentId)!).push(n);
  const mergeLevel = (group: G, path: string[]): Merged[] => {
    const byName = new Map<string, G>();
    for (const n of [...group].sort((a, b) => a.position - b.position)) (byName.get(norm(n.name)) ?? byName.set(norm(n.name), []).get(norm(n.name))!).push(n);
    return [...byName.entries()].map(([key, g]) => {
      const children = g.flatMap((n) => kids.get(n.id) ?? []);
      const name = g[0].name;
      return {
        key: [...path, key].join('/'), name, personaIds: [...new Set(g.map((n) => n.personaId))],
        descriptions: g.filter((n) => n.description).map((n) => ({ personaId: n.personaId, text: n.description })),
        children: mergeLevel(children, [...path, key]), alsoIn: [], nodeIds: Object.fromEntries(g.map((n) => [n.personaId, n.id])),
      };
    });
  };
  const tree = mergeLevel(kids.get(null) ?? [], []);
  // o mesmo nome em lugares diferentes da hierarquia: avisa nos dois
  const places = new Map<string, Merged[]>();
  const index = (items: Merged[], pathNames: string[]) => { for (const m of items) { (places.get(norm(m.name)) ?? places.set(norm(m.name), []).get(norm(m.name))!).push(m); (m as Merged & { _p?: string })._p = [...pathNames, m.name].join(' › '); index(m.children, [...pathNames, m.name]); } };
  index(tree, []);
  for (const list of places.values()) if (list.length > 1) for (const m of list) m.alsoIn = list.filter((o) => o !== m).map((o) => (o as Merged & { _p?: string })._p ?? o.name);
  return tree;
}
