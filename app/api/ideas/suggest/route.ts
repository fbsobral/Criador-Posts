import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, contentIdeas, personas, territories } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { AiError } from '@/lib/ai/generate';
import { suggestIdeas } from '@/lib/ai/idea';
import { MAX_IDEAS_PER_RUN } from '@/lib/idea';
import { PUBLICO_ID, pathOf, type TNode } from '@/lib/territory';
import { loadBrandProfile } from '@/lib/video-server';

export const maxDuration = 120;

/** Sugere ideias de conteúdo para uma persona e (opcionalmente) um território. Não grava: o usuário aprova antes. */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const personaId = typeof b?.personaId === 'string' && b.personaId !== PUBLICO_ID ? b.personaId : null;
  const [persona] = personaId ? await db.select().from(personas).where(and(eq(personas.id, personaId), eq(personas.brandId, c.brandId))) : [null];
  if (personaId && !persona) return Response.json({ error: 'Persona não encontrada.' }, { status: 404 });

  let territory: { path: string[]; description: string; children: string[] } | null = null;
  const territoryId = typeof b?.territoryId === 'string' && b.territoryId ? b.territoryId : null;
  if (territoryId) {
    const all = await db.select({ id: territories.id, personaId: territories.personaId, parentId: territories.parentId, name: territories.name, description: territories.description, position: territories.position, source: territories.source })
      .from(territories).where(eq(territories.brandId, c.brandId));
    const me = all.find((n) => n.id === territoryId);
    if (!me) return Response.json({ error: 'Território não encontrado.' }, { status: 404 });
    const mine = all.filter((n) => n.personaId === me.personaId).map((n) => ({ ...n, personaId: n.personaId ?? PUBLICO_ID })) as TNode[];
    territory = { path: pathOf(mine, territoryId), description: me.description, children: mine.filter((n) => n.parentId === territoryId).map((n) => n.name) };
  }

  const existing = await db.select({ pain: contentIdeas.pain }).from(contentIdeas)
    .where(and(eq(contentIdeas.brandId, c.brandId), personaId ? eq(contentIdeas.personaId, personaId) : isNull(contentIdeas.personaId), territoryId ? eq(contentIdeas.territoryId, territoryId) : undefined)).limit(40);
  const [s] = await db.select({ icp: brandSettings.personaIcp, aud: brandSettings.aiAudience }).from(brandSettings).where(eq(brandSettings.brandId, c.brandId));
  const brand = await loadBrandProfile(c.brandId);
  try {
    const r = await suggestIdeas({
      persona: persona ? { name: persona.name, tagline: persona.tagline, role: persona.data.role, data: persona.data } : null,
      icp: persona ? '' : s?.icp || s?.aud || '',
      brand: persona ? { ...brand, audience: '' } : brand,
      territory, existingPains: existing.map((x) => x.pain),
      count: Math.min(MAX_IDEAS_PER_RUN, Math.max(1, Math.round(Number(b?.count)) || 3)),
      instructions: String(b?.instructions ?? '').slice(0, 1200),
    });
    return Response.json({ ideas: r.ideas });
  } catch (e) {
    return Response.json({ error: e instanceof AiError ? e.message : 'Não foi possível sugerir ideias.' }, { status: e instanceof AiError && e.retryable ? 503 : 502 });
  }
}
