import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, personas, territories } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { AiError } from '@/lib/ai/generate';
import { suggestTerritories, type TerritoryMode } from '@/lib/ai/territory';
import { MAX_TERRITORY_NODES_PER_RUN, PUBLICO_ID, outline, pathOf, type TNode } from '@/lib/territory';
import { loadBrandProfile } from '@/lib/video-server';

export const maxDuration = 120;

/** Sugere territórios para uma persona considerando TUDO que ela já tem no mapa. Não grava: o usuário aprova antes. */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const mode: TerritoryMode = b?.mode === 'expand' ? 'expand' : b?.mode === 'full' ? 'full' : 'first';
  const publico = b?.personaId === PUBLICO_ID;
  const [persona] = publico ? [null] : await db.select().from(personas).where(and(eq(personas.id, String(b?.personaId ?? '')), eq(personas.brandId, c.brandId)));
  if (!publico && !persona) return Response.json({ error: 'Persona não encontrada.' }, { status: 404 });

  const all = await db.select({ id: territories.id, personaId: territories.personaId, parentId: territories.parentId, name: territories.name, description: territories.description, position: territories.position, source: territories.source })
    .from(territories).where(eq(territories.brandId, c.brandId));
  const mapId = persona ? persona.id : PUBLICO_ID;
  const mine = all.filter((n) => (n.personaId ?? PUBLICO_ID) === mapId).map((n) => ({ ...n, personaId: mapId })) as TNode[];
  const parentId = typeof b?.parentId === 'string' && b.parentId ? b.parentId : null;
  if (parentId && !mine.some((n) => n.id === parentId)) return Response.json({ error: 'Território não encontrado.' }, { status: 404 });
  if (mode === 'expand' && !parentId) return Response.json({ error: 'Escolha o território que será expandido.' }, { status: 400 });

  const count = Math.min(MAX_TERRITORY_NODES_PER_RUN, Math.max(1, Math.round(Number(b?.count)) || (mode === 'first' ? 6 : 5)));
  const depth = Math.min(4, Math.max(1, Math.round(Number(b?.depth)) || (mode === 'full' ? 3 : 1)));
  const [s] = await db.select({ icp: brandSettings.personaIcp, aud: brandSettings.aiAudience }).from(brandSettings).where(eq(brandSettings.brandId, c.brandId));
  const icp = s?.icp || s?.aud || '';
  const brand = await loadBrandProfile(c.brandId);
  const people = publico ? await db.select({ name: personas.name, tagline: personas.tagline, data: personas.data }).from(personas).where(eq(personas.brandId, c.brandId)).limit(30) : [];
  try {
    const r = await suggestTerritories({
      // dentro de uma persona o foco é só nela: sem ICP e sem o "Público" da marca; o público e as personas entram só no mapa sem persona
      persona: persona ? { name: persona.name, tagline: persona.tagline, role: persona.data.role, data: persona.data } : null,
      publicoPersonas: people.map((p) => ({ name: p.name, tagline: p.tagline, pains: p.data.pains })),
      brand: persona ? { ...brand, audience: '' } : brand, icp: persona ? '' : icp, mode, count, depth,
      parentPath: parentId ? pathOf(mine, parentId) : [],
      existingOutline: outline(mine),
      siblingNames: mine.filter((n) => n.parentId === parentId).map((n) => n.name),
      otherPersonas: [],
      instructions: String(b?.instructions ?? '').slice(0, 1200),
    });
    return Response.json({ nodes: r.nodes });
  } catch (e) {
    return Response.json({ error: e instanceof AiError ? e.message : 'Não foi possível sugerir territórios.' }, { status: e instanceof AiError && e.retryable ? 503 : 502 });
  }
}
