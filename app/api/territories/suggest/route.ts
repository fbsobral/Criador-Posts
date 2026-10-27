import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, personas, territories } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { AiError } from '@/lib/ai/generate';
import { suggestTerritories, type TerritoryMode } from '@/lib/ai/territory';
import { MAX_TERRITORY_NODES_PER_RUN, outline, pathOf, type TNode } from '@/lib/territory';
import { loadBrandProfile } from '@/lib/video-server';

export const maxDuration = 120;

/** Sugere territórios para uma persona considerando TUDO que ela já tem no mapa. Não grava: o usuário aprova antes. */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const mode: TerritoryMode = b?.mode === 'expand' ? 'expand' : b?.mode === 'full' ? 'full' : 'first';
  const [persona] = await db.select().from(personas).where(and(eq(personas.id, String(b?.personaId ?? ''), ), eq(personas.brandId, c.brandId)));
  if (!persona) return Response.json({ error: 'Persona não encontrada.' }, { status: 404 });

  const rows = await db.select({ id: territories.id, personaId: territories.personaId, parentId: territories.parentId, name: territories.name, description: territories.description, position: territories.position, source: territories.source })
    .from(territories).where(eq(territories.brandId, c.brandId)) as TNode[];
  const mine = rows.filter((n) => n.personaId === persona.id);
  const parentId = typeof b?.parentId === 'string' && b.parentId ? b.parentId : null;
  if (parentId && !mine.some((n) => n.id === parentId)) return Response.json({ error: 'Território não encontrado.' }, { status: 404 });
  if (mode === 'expand' && !parentId) return Response.json({ error: 'Escolha o território que será expandido.' }, { status: 400 });

  const count = Math.min(MAX_TERRITORY_NODES_PER_RUN, Math.max(1, Math.round(Number(b?.count)) || (mode === 'first' ? 6 : 5)));
  const depth = Math.min(4, Math.max(1, Math.round(Number(b?.depth)) || (mode === 'full' ? 3 : 1)));
  const [s] = await db.select({ icp: brandSettings.personaIcp, aud: brandSettings.aiAudience }).from(brandSettings).where(eq(brandSettings.brandId, c.brandId));
  try {
    const r = await suggestTerritories({
      persona: { name: persona.name, tagline: persona.tagline, role: persona.data.role, data: persona.data },
      brand: await loadBrandProfile(c.brandId), icp: s?.icp || s?.aud || '', mode, count, depth,
      parentPath: parentId ? pathOf(mine, parentId) : [],
      existingOutline: outline(mine),
      siblingNames: mine.filter((n) => n.parentId === parentId).map((n) => n.name),
      otherPersonas: [...new Set(rows.filter((n) => n.personaId !== persona.id && !n.parentId).map((n) => n.name))],
      instructions: String(b?.instructions ?? '').slice(0, 1200),
    });
    return Response.json({ nodes: r.nodes });
  } catch (e) {
    return Response.json({ error: e instanceof AiError ? e.message : 'Não foi possível sugerir territórios.' }, { status: e instanceof AiError && e.retryable ? 503 : 502 });
  }
}
