import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { personas } from '@/db/schema';
import type { PersonaData } from '@/lib/persona';
import { personaIdsOf } from '@/lib/idea';
import { PUBLICO_ID } from '@/lib/territory';

/** Persona no formato que os prompts usam. */
export type PersonaIn = { id: string; name: string; tagline: string; role: string; data: PersonaData };

/** Carrega as personas da marca na ordem pedida (ignora ids que não existem ou de outra marca). */
export async function loadPersonas(brandId: string, ids: string[]): Promise<PersonaIn[]> {
  const clean = [...new Set(ids.filter((x) => x && x !== PUBLICO_ID && /^[0-9a-f-]{36}$/i.test(x)))].slice(0, 6);
  if (!clean.length) return [];
  const rows = await db.select().from(personas).where(and(eq(personas.brandId, brandId), inArray(personas.id, clean)));
  return clean.map((id) => rows.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r)
    .map((p) => ({ id: p.id, name: p.name, tagline: p.tagline, role: p.data.role, data: p.data }));
}

/** As personas de uma ideia (a primeira é a principal). */
export const loadIdeaPersonas = (brandId: string, row: { personaId: string | null; personaIds?: string[] | null }) => loadPersonas(brandId, personaIdsOf(row));

/** Lê do corpo da requisição a lista de personas (aceita `personaIds` ou o antigo `personaId`). */
export function personaIdsFromBody(b: Record<string, unknown> | null): string[] {
  const list = Array.isArray(b?.personaIds) ? b.personaIds : typeof b?.personaId === 'string' ? [b.personaId] : [];
  return list.map(String).filter((x) => x && x !== PUBLICO_ID);
}
