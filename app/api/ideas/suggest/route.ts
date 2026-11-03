import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, contentIdeas, personas } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { AiError } from '@/lib/ai/generate';
import { suggestIdeas } from '@/lib/ai/idea';
import { MAX_IDEAS_PER_RUN } from '@/lib/idea';
import { PUBLICO_ID, pathOf, translationFor } from '@/lib/territory';
import { loadTerritoryNodes } from '@/lib/territory-server';
import { loadBrandProfile } from '@/lib/video-server';
import { TOO_MANY, rateLimit } from '@/lib/rate-limit';

export const maxDuration = 120;

/** Sugere ideias de conteúdo para um par persona × território (qualquer combinação; a tradução do tema para a persona, se existir, entra como ponte). Não grava: o usuário aprova antes. */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  if (!rateLimit(`ai:${c.userId}`, 100, 10 * 60_000)) return Response.json(TOO_MANY, { status: 429 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const personaId = typeof b?.personaId === 'string' && b.personaId !== PUBLICO_ID ? b.personaId : null;
  const [persona] = personaId ? await db.select().from(personas).where(and(eq(personas.id, personaId), eq(personas.brandId, c.brandId))) : [null];
  if (personaId && !persona) return Response.json({ error: 'Persona não encontrada.' }, { status: 404 });

  let territory: { path: string[]; description: string; children: string[]; translation: string } | null = null;
  const territoryId = typeof b?.territoryId === 'string' && b.territoryId ? b.territoryId : null;
  if (territoryId) {
    const all = await loadTerritoryNodes(c.brandId);
    const me = all.find((n) => n.id === territoryId);
    if (!me) return Response.json({ error: 'Território não encontrado.' }, { status: 404 });
    territory = { path: pathOf(all, territoryId), description: me.description, children: all.filter((n) => n.parentId === territoryId).map((n) => n.name), translation: personaId ? translationFor(all, territoryId, personaId).text : '' };
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
