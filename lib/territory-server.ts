import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { personas, territories, territoryPersonas } from '@/db/schema';
import { PUBLICO_ID, effectivePersonas, type TLink, type TNode } from '@/lib/territory';

/** O mapa inteiro da marca (uma árvore só), com as personas ligadas a cada território. */
export async function loadTerritoryNodes(brandId: string): Promise<TNode[]> {
  const [rows, links] = await Promise.all([
    db.select({ id: territories.id, personaId: territories.personaId, parentId: territories.parentId, name: territories.name, description: territories.description, position: territories.position, source: territories.source, score: territories.score, scoreReason: territories.scoreReason })
      .from(territories).where(eq(territories.brandId, brandId)),
    db.select({ territoryId: territoryPersonas.territoryId, personaId: territoryPersonas.personaId, translation: territoryPersonas.translation }).from(territoryPersonas).where(eq(territoryPersonas.brandId, brandId)),
  ]);
  const by = new Map<string, TLink[]>();
  for (const l of links) (by.get(l.territoryId) ?? by.set(l.territoryId, []).get(l.territoryId)!).push({ personaId: l.personaId, translation: l.translation });
  return rows.map((r) => ({ ...r, personaId: r.personaId ?? PUBLICO_ID, links: by.get(r.id) ?? [] }));
}

/** Garante que a persona enxerga o território (ligação própria ou herdada). Não mexe se já enxerga. */
export async function ensureLink(brandId: string, nodes: TNode[], territoryId: string, personaId: string, source: 'ai' | 'manual' = 'manual') {
  if (effectivePersonas(nodes, territoryId).includes(personaId)) return;
  await db.insert(territoryPersonas).values({ brandId, territoryId, personaId, source }).onConflictDoNothing();
}

/** A persona existe e é desta marca? */
export async function personaOfBrand(brandId: string, personaId: string): Promise<boolean> {
  const [p] = await db.select({ id: personas.id }).from(personas).where(and(eq(personas.id, personaId), eq(personas.brandId, brandId)));
  return !!p;
}
