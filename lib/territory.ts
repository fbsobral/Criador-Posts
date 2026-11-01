/** Tipos, árvore e layout do mapa mental de territórios (servidor e navegador). */

/** Ligação do território com uma persona: `translation` é como o tema aparece na vida dela (vazio = ligada, sem tradução). */
export type TLink = { personaId: string; translation: string };
/** `personaId` é só a ORIGEM do tema (PUBLICO_ID = tema macro, nasceu sem persona); quem usa o tema está em `links`. */
export type TNode = { id: string; personaId: string; parentId: string | null; name: string; description: string; position: number; source: string; score?: number | null; scoreReason?: string; links: TLink[] };

/** "Sem persona" no navegador (tema macro / ideia sem persona); no banco é persona_id nulo. */
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

/* ---------- personas ligadas (herança pela árvore) ---------- */

/** Personas que enxergam o território: as ligadas a ele e as ligadas a qualquer ancestral (os filhos herdam). */
export function effectivePersonas(nodes: TNode[], id: string): string[] {
  const by = new Map(nodes.map((n) => [n.id, n]));
  const out = new Set<string>();
  let cur = by.get(id), g = 0;
  while (cur && g++ < 50) { for (const l of cur.links) out.add(l.personaId); cur = cur.parentId ? by.get(cur.parentId) : undefined; }
  return [...out];
}

/** Tradução do tema para a persona: a do próprio território; se não houver, a do ancestral mais próximo. */
export function translationFor(nodes: TNode[], id: string, personaId: string): { text: string; from: string | null } {
  const by = new Map(nodes.map((n) => [n.id, n]));
  let cur = by.get(id), g = 0;
  while (cur && g++ < 50) {
    const l = cur.links.find((x) => x.personaId === personaId && x.translation.trim());
    if (l) return { text: l.translation, from: cur.id === id ? null : cur.name };
    cur = cur.parentId ? by.get(cur.parentId) : undefined;
  }
  return { text: '', from: null };
}

/** Lente de uma persona: os territórios que ela enxerga (ligados ou herdados) e, só como contexto, os ancestrais deles. */
export function lensNodes(nodes: TNode[], personaId: string): { nodes: TNode[]; context: Set<string> } {
  const by = new Map(nodes.map((n) => [n.id, n]));
  const mine = new Set(nodes.filter((n) => effectivePersonas(nodes, n.id).includes(personaId)).map((n) => n.id));
  const keep = new Set(mine);
  for (const id of mine) { let cur = by.get(id)?.parentId, g = 0; while (cur && g++ < 50) { keep.add(cur); cur = by.get(cur)?.parentId ?? null; } }
  return { nodes: nodes.filter((n) => keep.has(n.id)), context: new Set([...keep].filter((id) => !mine.has(id))) };
}
