import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { personas } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { AiError } from '@/lib/ai/generate';
import { translateTerritory } from '@/lib/ai/translate';
import { pathOf } from '@/lib/territory';
import { loadTerritoryNodes } from '@/lib/territory-server';
import { loadBrandProfile } from '@/lib/video-server';

export const maxDuration = 120;
const MAX_PERSONAS = 12;

/** Traduz um território para o dia a dia de uma ou mais personas. Não grava: o usuário revisa antes. */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const all = await loadTerritoryNodes(c.brandId);
  const me = all.find((n) => n.id === b?.territoryId);
  if (!me) return Response.json({ error: 'Território não encontrado.' }, { status: 404 });
  const ids = (Array.isArray(b?.personaIds) ? b.personaIds : []).filter((x): x is string => typeof x === 'string').slice(0, MAX_PERSONAS);
  if (!ids.length) return Response.json({ error: 'Escolha pelo menos uma persona.' }, { status: 400 });
  const people = await db.select().from(personas).where(and(eq(personas.brandId, c.brandId), inArray(personas.id, ids)));
  if (!people.length) return Response.json({ error: 'Persona não encontrada.' }, { status: 404 });
  const brand = await loadBrandProfile(c.brandId);
  try {
    const r = await translateTerritory({
      path: pathOf(all, me.id), description: me.description, brand: { ...brand, audience: '' },
      personas: people.map((p) => ({ id: p.id, name: p.name, tagline: p.tagline, role: p.data.role, data: p.data })),
      instructions: String(b?.instructions ?? '').slice(0, 1200),
    });
    return Response.json({ items: r.items });
  } catch (e) {
    return Response.json({ error: e instanceof AiError ? e.message : 'Não foi possível traduzir o território.' }, { status: e instanceof AiError && e.retryable ? 503 : 502 });
  }
}
