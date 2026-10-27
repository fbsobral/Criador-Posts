'use server';

import { and, eq, gt, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { personas, territories } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { MAX_DEPTH, descendantIds, depthOf, type TNode } from '@/lib/territory';
import type { SuggestedNode } from '@/lib/ai/territory';

async function ctx() {
  const c = await getCtx();
  if (!c) throw new Error('Não autorizado');
  return c;
}
const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const done = () => revalidatePath('/admin/territorios');

async function ownPersona(brandId: string, personaId: string) {
  const [p] = await db.select({ id: personas.id }).from(personas).where(and(eq(personas.id, personaId), eq(personas.brandId, brandId)));
  return !!p;
}
async function loadNodes(brandId: string, personaId: string): Promise<TNode[]> {
  return db.select({ id: territories.id, personaId: territories.personaId, parentId: territories.parentId, name: territories.name, description: territories.description, position: territories.position, source: territories.source })
    .from(territories).where(and(eq(territories.brandId, brandId), eq(territories.personaId, personaId)));
}
const nextPos = async (brandId: string, personaId: string, parentId: string | null) => {
  const [r] = await db.select({ m: sql<number>`coalesce(max(${territories.position}), -1)::int` }).from(territories)
    .where(and(eq(territories.brandId, brandId), eq(territories.personaId, personaId), parentId ? eq(territories.parentId, parentId) : sql`${territories.parentId} is null`));
  return (r?.m ?? -1) + 1;
};

/** Cria um território. Com `afterId`, entra logo depois desse irmão (mesmo pai). */
export async function createNode(personaId: string, parentId: string | null, name: string, afterId?: string): Promise<{ node?: TNode; error?: string }> {
  const c = await ctx();
  if (!(await ownPersona(c.brandId, personaId))) return { error: 'Persona não encontrada.' };
  const n = str(name, 80) || 'Novo território';
  const all = await loadNodes(c.brandId, personaId);
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
      .where(and(eq(territories.brandId, c.brandId), eq(territories.personaId, personaId), sib.parentId ? eq(territories.parentId, sib.parentId) : sql`${territories.parentId} is null`, gt(territories.position, sib.position)));
  } else position = await nextPos(c.brandId, personaId, parentId);
  const [r] = await db.insert(territories).values({ brandId: c.brandId, personaId, parentId, name: n, position, source: 'manual', createdBy: c.userId }).returning();
  done();
  return { node: { id: r.id, personaId, parentId, name: r.name, description: r.description, position: r.position, source: r.source } };
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
  const all = await loadNodes(c.brandId, cur.personaId);
  if (newParentId) {
    if (descendantIds(all, id).has(newParentId)) return { error: 'Não dá para mover um território para dentro dele mesmo.' };
    if (!all.some((x) => x.id === newParentId)) return { error: 'Destino não encontrado.' };
    const sub = Math.max(...[...descendantIds(all, id)].map((d) => depthOf(all, d))) - depthOf(all, id);
    if (depthOf(all, newParentId) + 1 + sub >= MAX_DEPTH) return { error: `O mapa aceita até ${MAX_DEPTH} níveis.` };
  }
  await db.update(territories).set({ parentId: newParentId, position: await nextPos(c.brandId, cur.personaId, newParentId), updatedAt: new Date() }).where(eq(territories.id, id));
  done();
  return {};
}

/** Exclui o território e tudo que está dentro dele. */
export async function deleteNode(id: string): Promise<{ error?: string }> {
  const c = await ctx();
  await db.delete(territories).where(and(eq(territories.id, id), eq(territories.brandId, c.brandId)));
  done();
  return {};
}

/** Grava os territórios sugeridos que o usuário aprovou, sob `parentId` (ou na raiz da persona). */
export async function addSuggestedNodes(personaId: string, parentId: string | null, nodes: SuggestedNode[]): Promise<{ added?: number; error?: string }> {
  const c = await ctx();
  if (!(await ownPersona(c.brandId, personaId))) return { error: 'Persona não encontrada.' };
  const all = await loadNodes(c.brandId, personaId);
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
    const pos = counters.get(key) ?? (await nextPos(c.brandId, personaId, parent ?? null));
    counters.set(key, pos + 1);
    const [r] = await db.insert(territories).values({ brandId: c.brandId, personaId, parentId: parent ?? null, name, description: str(x.description, 400), position: pos, source: 'ai', createdBy: c.userId }).returning({ id: territories.id });
    idByRef.set(x.ref, r.id); depthByRef.set(x.ref, d); added++;
  }
  done();
  return { added };
}
