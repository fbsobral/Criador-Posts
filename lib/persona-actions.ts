'use server';

import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { brandSettings, personaGroups, personas } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { emptyPersonaData, normName, type PersonaData } from '@/lib/persona';
import type { SuggestedGroup } from '@/lib/ai/persona';

async function ctx() {
  const c = await getCtx();
  if (!c) throw new Error('Não autorizado');
  return c;
}
const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const list = (v: unknown, n = 8) => (Array.isArray(v) ? v.map((x) => str(x, 240)).filter(Boolean).slice(0, n) : []);
const cleanData = (d: Partial<PersonaData> | undefined): PersonaData => ({
  ...emptyPersonaData(), age: str(d?.age, 30), role: str(d?.role, 100), location: str(d?.location, 100), bio: str(d?.bio, 900),
  goals: list(d?.goals), pains: list(d?.pains), objections: list(d?.objections), triggers: list(d?.triggers), channels: list(d?.channels), quote: str(d?.quote, 300),
});
const done = () => revalidatePath('/admin/personas');

async function ownGroup(brandId: string, groupId: string | null | undefined) {
  if (!groupId) return null;
  const [g] = await db.select({ id: personaGroups.id }).from(personaGroups).where(and(eq(personaGroups.id, groupId), eq(personaGroups.brandId, brandId)));
  return g?.id ?? null;
}
async function nextPosition(brandId: string, groupId: string | null) {
  const [r] = await db.select({ m: sql<number>`coalesce(max(${personas.position}), -1)::int` }).from(personas)
    .where(and(eq(personas.brandId, brandId), groupId ? eq(personas.groupId, groupId) : sql`${personas.groupId} is null`));
  return (r?.m ?? -1) + 1;
}

export async function createGroup(name: string, description = ''): Promise<{ id?: string; error?: string }> {
  const c = await ctx();
  const n = str(name, 60);
  if (!n) return { error: 'Dê um nome ao grupo.' };
  const [{ m }] = await db.select({ m: sql<number>`coalesce(max(${personaGroups.position}), -1)::int` }).from(personaGroups).where(eq(personaGroups.brandId, c.brandId));
  const [r] = await db.insert(personaGroups).values({ brandId: c.brandId, name: n, description: str(description, 200), position: m + 1 }).returning({ id: personaGroups.id });
  done();
  return { id: r.id };
}

export async function updateGroup(id: string, input: { name: string; description?: string }): Promise<{ error?: string }> {
  const c = await ctx();
  const n = str(input.name, 60);
  if (!n) return { error: 'O grupo precisa de um nome.' };
  await db.update(personaGroups).set({ name: n, description: str(input.description, 200) }).where(and(eq(personaGroups.id, id), eq(personaGroups.brandId, c.brandId)));
  done();
  return {};
}

/** Exclui o grupo. As personas dele não são apagadas: ficam em "Sem grupo". */
export async function deleteGroup(id: string): Promise<{ error?: string }> {
  const c = await ctx();
  await db.delete(personaGroups).where(and(eq(personaGroups.id, id), eq(personaGroups.brandId, c.brandId)));
  done();
  return {};
}

export type PersonaInput = { name: string; tagline: string; groupId: string | null; data: Partial<PersonaData> };

export async function createPersona(input: PersonaInput): Promise<{ id?: string; error?: string }> {
  const c = await ctx();
  const name = str(input.name, 80);
  if (!name) return { error: 'Dê um nome à persona.' };
  const groupId = await ownGroup(c.brandId, input.groupId);
  const [r] = await db.insert(personas).values({
    brandId: c.brandId, groupId, name, tagline: str(input.tagline, 200), data: cleanData(input.data), position: await nextPosition(c.brandId, groupId), source: 'manual', createdBy: c.userId,
  }).returning({ id: personas.id });
  done();
  return { id: r.id };
}

export async function updatePersona(id: string, input: PersonaInput): Promise<{ error?: string }> {
  const c = await ctx();
  const name = str(input.name, 80);
  if (!name) return { error: 'Dê um nome à persona.' };
  const [cur] = await db.select({ groupId: personas.groupId }).from(personas).where(and(eq(personas.id, id), eq(personas.brandId, c.brandId)));
  if (!cur) return { error: 'Persona não encontrada.' };
  const groupId = await ownGroup(c.brandId, input.groupId);
  const position = groupId !== cur.groupId ? await nextPosition(c.brandId, groupId) : undefined;
  await db.update(personas).set({ name, tagline: str(input.tagline, 200), groupId, data: cleanData(input.data), updatedAt: new Date(), ...(position !== undefined ? { position } : {}) })
    .where(and(eq(personas.id, id), eq(personas.brandId, c.brandId)));
  done();
  return {};
}

export async function movePersona(id: string, groupId: string | null): Promise<{ error?: string }> {
  const c = await ctx();
  const g = await ownGroup(c.brandId, groupId);
  await db.update(personas).set({ groupId: g, position: await nextPosition(c.brandId, g), updatedAt: new Date() }).where(and(eq(personas.id, id), eq(personas.brandId, c.brandId)));
  done();
  return {};
}

export async function deletePersona(id: string): Promise<{ error?: string }> {
  const c = await ctx();
  await db.delete(personas).where(and(eq(personas.id, id), eq(personas.brandId, c.brandId)));
  done();
  return {};
}

/** Grava as personas sugeridas que o usuário aprovou. Grupos com o mesmo nome de um existente reaproveitam o existente. */
export async function addSuggested(groups: SuggestedGroup[]): Promise<{ added?: number; groups?: number; error?: string }> {
  const c = await ctx();
  const existing = await db.select().from(personaGroups).where(eq(personaGroups.brandId, c.brandId));
  const byName = new Map(existing.map((g) => [normName(g.name), g.id]));
  let pos = existing.reduce((m, g) => Math.max(m, g.position), -1);
  let added = 0, created = 0;
  for (const g of groups.slice(0, 20)) {
    const ps = (g.personas ?? []).filter((p) => str(p.name, 80));
    if (!ps.length) continue;
    const key = normName(g.name || 'Sem nome');
    let gid = byName.get(key);
    if (!gid) {
      const [r] = await db.insert(personaGroups).values({ brandId: c.brandId, name: str(g.name, 60) || 'Sem nome', description: str(g.description, 200), position: ++pos }).returning({ id: personaGroups.id });
      gid = r.id; byName.set(key, gid); created++;
    }
    let p0 = await nextPosition(c.brandId, gid);
    for (const p of ps.slice(0, 30)) {
      await db.insert(personas).values({ brandId: c.brandId, groupId: gid, name: str(p.name, 80), tagline: str(p.tagline, 200), data: cleanData(p.data), position: p0++, source: 'ai', createdBy: c.userId });
      added++;
    }
  }
  done();
  return { added, groups: created };
}

export async function savePersonaIcp(text: string): Promise<void> {
  const c = await ctx();
  await db.update(brandSettings).set({ personaIcp: str(text, 4000) }).where(eq(brandSettings.brandId, c.brandId));
}
