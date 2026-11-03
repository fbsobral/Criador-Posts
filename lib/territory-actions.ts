'use server';

import { and, eq, gt, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { brandSettings, territories, territoryPersonas } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { MAX_DEPTH, PUBLICO_ID, buildTree, descendantIds, depthOf, effectivePersonas, type TNode, type TreeItem } from '@/lib/territory';
import { ensureLink, loadTerritoryNodes, personaOfBrand } from '@/lib/territory-server';
import { clampScore, sanitizePriority, type PriorityConfig } from '@/lib/priority';
import type { SuggestedNode } from '@/lib/ai/territory';

async function ctx() {
  const c = await getCtx();
  if (!c) throw new Error('Não autorizado');
  return c;
}
const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const done = () => revalidatePath('/admin/territorios');

/** "publico" (tema macro, sem persona) vira persona nula no banco. */
const toPid = (personaId: string | null | undefined): string | null => (!personaId || personaId === PUBLICO_ID ? null : personaId);

const nextPos = async (brandId: string, parentId: string | null) => {
  const [r] = await db.select({ m: sql<number>`coalesce(max(${territories.position}), -1)::int` }).from(territories)
    .where(and(eq(territories.brandId, brandId), parentId ? eq(territories.parentId, parentId) : sql`${territories.parentId} is null`));
  return (r?.m ?? -1) + 1;
};

/** Cria um território no mapa da marca. `personaId` (opcional) é a persona em foco: vira a origem e fica ligada ao tema. Com `afterId`, entra logo depois desse irmão. */
export async function createNode(personaId: string | null, parentId: string | null, name: string, afterId?: string): Promise<{ node?: TNode; error?: string }> {
  const c = await ctx();
  const pid = toPid(personaId);
  if (pid && !(await personaOfBrand(c.brandId, pid))) return { error: 'Persona não encontrada.' };
  const n = str(name, 80) || 'Novo território';
  const all = await loadTerritoryNodes(c.brandId);
  if (parentId) {
    if (!all.some((x) => x.id === parentId)) return { error: 'Território pai não encontrado.' };
    if (depthOf(all, parentId) + 1 >= MAX_DEPTH) return { error: `O mapa aceita até ${MAX_DEPTH} níveis.` };
  }
  let position: number;
  if (afterId) {
    const sib = all.find((x) => x.id === afterId);
    if (!sib) return { error: 'Território não encontrado.' };
    position = sib.position + 1;
    await db.update(territories).set({ position: sql`${territories.position} + 1` })
      .where(and(eq(territories.brandId, c.brandId), sib.parentId ? eq(territories.parentId, sib.parentId) : sql`${territories.parentId} is null`, gt(territories.position, sib.position)));
  } else position = await nextPos(c.brandId, parentId);
  const [r] = await db.insert(territories).values({ brandId: c.brandId, personaId: pid, parentId, name: n, position, source: 'manual', createdBy: c.userId }).returning();
  const node: TNode = { id: r.id, personaId: pid ?? PUBLICO_ID, parentId, name: r.name, description: r.description, position: r.position, source: r.source, links: [] };
  if (pid && !effectivePersonas([...all, node], r.id).includes(pid)) { await ensureLink(c.brandId, [...all, node], r.id, pid); node.links = [{ personaId: pid, translation: '' }]; }
  done();
  return { node };
}

export async function updateNode(id: string, input: { name: string; description: string }): Promise<{ error?: string }> {
  const c = await ctx();
  const name = str(input.name, 80);
  if (!name) return { error: 'O território precisa de um nome.' };
  await db.update(territories).set({ name, description: str(input.description, 400), updatedAt: new Date() }).where(and(eq(territories.id, id), eq(territories.brandId, c.brandId)));
  done();
  return {};
}

/** Move o território para outro pai (ou para a raiz). Não deixa mover para dentro dele mesmo. */
export async function moveNode(id: string, newParentId: string | null): Promise<{ error?: string }> {
  const c = await ctx();
  const [cur] = await db.select().from(territories).where(and(eq(territories.id, id), eq(territories.brandId, c.brandId)));
  if (!cur) return { error: 'Território não encontrado.' };
  const all = await loadTerritoryNodes(c.brandId);
  if (newParentId) {
    if (descendantIds(all, id).has(newParentId)) return { error: 'Não dá para mover um território para dentro dele mesmo.' };
    if (!all.some((x) => x.id === newParentId)) return { error: 'Destino não encontrado.' };
    const sub = Math.max(...[...descendantIds(all, id)].map((d) => depthOf(all, d))) - depthOf(all, id);
    if (depthOf(all, newParentId) + 1 + sub >= MAX_DEPTH) return { error: `O mapa aceita até ${MAX_DEPTH} níveis.` };
  }
  await db.update(territories).set({ parentId: newParentId, position: await nextPos(c.brandId, newParentId), updatedAt: new Date() }).where(eq(territories.id, id));
  done();
  return {};
}

/** Duplica o território com tudo que está dentro dele (subtemas, ligações com personas e traduções), logo depois do original. As ideias de conteúdo não são copiadas. */
export async function duplicateNode(id: string): Promise<{ rootId?: string; nodes?: TNode[]; error?: string }> {
  const c = await ctx();
  const all = await loadTerritoryNodes(c.brandId);
  const src = all.find((n) => n.id === id);
  if (!src) return { error: 'Território não encontrado.' };
  const inside = descendantIds(all, id);
  if (inside.size > 200) return { error: 'Este território tem itens demais para duplicar de uma vez (máximo 200).' };
  const tree = buildTree(all.filter((n) => inside.has(n.id)))[0] as TreeItem<TNode> | undefined;
  if (!tree) return { error: 'Território não encontrado.' };
  // abre espaço logo depois do original
  await db.update(territories).set({ position: sql`${territories.position} + 1` })
    .where(and(eq(territories.brandId, c.brandId), src.parentId ? eq(territories.parentId, src.parentId) : sql`${territories.parentId} is null`, gt(territories.position, src.position)));
  const created: TNode[] = [];
  const copy = async (it: TreeItem<TNode>, parentId: string | null, position: number, isRoot: boolean) => {
    const n = it.data;
    const [r] = await db.insert(territories).values({ brandId: c.brandId, personaId: toPid(n.personaId), parentId, name: isRoot ? str(`${n.name} (cópia)`, 80) : n.name, description: n.description, position, score: n.score ?? null, scoreReason: n.scoreReason ?? '', source: 'manual', createdBy: c.userId }).returning();
    if (n.links.length) await db.insert(territoryPersonas).values(n.links.map((l) => ({ brandId: c.brandId, territoryId: r.id, personaId: l.personaId, translation: l.translation, source: 'manual' }))).onConflictDoNothing();
    created.push({ id: r.id, personaId: n.personaId, parentId, name: r.name, description: r.description, position: r.position, source: 'manual', score: r.score, scoreReason: r.scoreReason, links: n.links.map((l) => ({ ...l })) });
    for (let i = 0; i < it.children.length; i++) await copy(it.children[i], r.id, i, false);
    return r.id;
  };
  const rootId = await copy(tree, src.parentId, src.position + 1, true);
  done();
  return { rootId, nodes: created };
}

/** Exclui o território e tudo que está dentro dele. */
export async function deleteNode(id: string): Promise<{ error?: string }> {
  const c = await ctx();
  const gone = await db.delete(territories).where(and(eq(territories.id, id), eq(territories.brandId, c.brandId))).returning({ id: territories.id });
  done();
  return gone.length ? {} : { error: 'Território não encontrado (talvez já tenha sido excluído).' };
}

/** Grava os territórios sugeridos que o usuário aprovou, sob `parentId` (ou na raiz da persona). */
export async function addSuggestedNodes(personaId: string | null, parentId: string | null, nodes: SuggestedNode[]): Promise<{ added?: number; error?: string }> {
  const c = await ctx();
  const pid = toPid(personaId);
  if (pid && !(await personaOfBrand(c.brandId, pid))) return { error: 'Persona não encontrada.' };
  const all = await loadTerritoryNodes(c.brandId);
  if (parentId && !all.some((x) => x.id === parentId)) return { error: 'Território pai não encontrado.' };
  const base = parentId ? depthOf(all, parentId) + 1 : 0;
  const idByRef = new Map<string, string>();
  const depthByRef = new Map<string, number>();
  const counters = new Map<string, number>();
  let added = 0;
  for (const x of nodes.slice(0, 80)) {
    const name = str(x.name, 80);
    if (!name) continue;
    const parent = x.parentRef ? idByRef.get(x.parentRef) : parentId;
    if (x.parentRef && !parent) continue;
    const d = x.parentRef ? (depthByRef.get(x.parentRef) ?? 0) + 1 : base;
    if (d >= MAX_DEPTH) continue;
    const key = parent ?? 'root';
    const pos = counters.get(key) ?? (await nextPos(c.brandId, parent ?? null));
    counters.set(key, pos + 1);
    const [r] = await db.insert(territories).values({ brandId: c.brandId, personaId: pid, parentId: parent ?? null, name, description: str(x.description, 400), position: pos, score: x.score ? clampScore(x.score) : null, scoreReason: str(x.reason, 200), source: 'ai', createdBy: c.userId }).returning({ id: territories.id });
    idByRef.set(x.ref, r.id); depthByRef.set(x.ref, d); added++;
    // com persona em foco, o tema novo já nasce ligado a ela (a menos que ela já o herde do pai)
    if (pid) { const n: TNode = { id: r.id, personaId: pid, parentId: parent ?? null, name, description: '', position: pos, source: 'ai', links: [] }; all.push(n); const before = effectivePersonas(all, r.id).includes(pid); await ensureLink(c.brandId, all, r.id, pid, 'ai'); if (!before) n.links = [{ personaId: pid, translation: '' }]; }
  }
  done();
  return { added };
}

/** Salva "o que a organização faz" (só administradores). É a base de personas, territórios e todo conteúdo com IA. */
export async function saveOrgAbout(text: string): Promise<{ error?: string }> {
  const c = await ctx();
  if (!c.isBrandAdmin) return { error: 'Apenas administradores da marca editam isto.' };
  await db.update(brandSettings).set({ aiAbout: str(text, 3000), updatedAt: new Date() }).where(eq(brandSettings.brandId, c.brandId));
  revalidatePath('/admin/territorios'); revalidatePath('/admin/configuracoes');
  return {};
}

/** Muda o score à mão (1 a 100; vazio = sem classificação). */
export async function setScore(id: string, score: number | null): Promise<{ error?: string }> {
  const c = await ctx();
  await db.update(territories).set({ score: score == null ? null : clampScore(score), scoreReason: score == null ? '' : 'Definido à mão.', updatedAt: new Date() }).where(and(eq(territories.id, id), eq(territories.brandId, c.brandId)));
  done();
  return {};
}

/** Critérios e faixas de prioridade (só administradores). */
export async function savePriorityConfig(input: PriorityConfig): Promise<{ error?: string; config?: PriorityConfig }> {
  const c = await ctx();
  if (!c.isBrandAdmin) return { error: 'Apenas administradores da marca editam isto.' };
  const config = sanitizePriority(input);
  await db.update(brandSettings).set({ priorityConfig: config, updatedAt: new Date() }).where(eq(brandSettings.brandId, c.brandId));
  done();
  return { config };
}


/** Liga uma persona a um território (ela passa a enxergar o tema e os filhos dele). */
export async function linkPersona(territoryId: string, personaId: string): Promise<{ error?: string }> {
  const c = await ctx();
  const [t] = await db.select({ id: territories.id }).from(territories).where(and(eq(territories.id, territoryId), eq(territories.brandId, c.brandId)));
  if (!t) return { error: 'Território não encontrado.' };
  if (!(await personaOfBrand(c.brandId, personaId))) return { error: 'Persona não encontrada.' };
  await db.insert(territoryPersonas).values({ brandId: c.brandId, territoryId, personaId, source: 'manual' }).onConflictDoNothing();
  done();
  return {};
}

/** Desliga a ligação própria da persona com o território (a tradução vai junto). */
export async function unlinkPersona(territoryId: string, personaId: string): Promise<{ error?: string }> {
  const c = await ctx();
  await db.delete(territoryPersonas).where(and(eq(territoryPersonas.brandId, c.brandId), eq(territoryPersonas.territoryId, territoryId), eq(territoryPersonas.personaId, personaId)));
  done();
  return {};
}

/** Grava as traduções do tema (uma por persona), ligando a persona ao território se ainda não estiver. */
export async function saveTranslations(territoryId: string, items: { personaId: string; translation: string; source?: 'ai' | 'manual' }[]): Promise<{ saved?: number; error?: string }> {
  const c = await ctx();
  const [t] = await db.select({ id: territories.id }).from(territories).where(and(eq(territories.id, territoryId), eq(territories.brandId, c.brandId)));
  if (!t) return { error: 'Território não encontrado.' };
  let saved = 0;
  for (const x of items.slice(0, 60)) {
    if (!(await personaOfBrand(c.brandId, x.personaId))) continue;
    const translation = str(x.translation, 1200);
    const source = x.source === 'ai' ? 'ai' : 'manual';
    await db.insert(territoryPersonas).values({ brandId: c.brandId, territoryId, personaId: x.personaId, translation, source })
      .onConflictDoUpdate({ target: [territoryPersonas.territoryId, territoryPersonas.personaId], set: { translation, source, updatedAt: new Date() } });
    saved++;
  }
  done();
  return { saved };
}
