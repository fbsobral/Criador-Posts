import { and, arrayOverlaps, desc, eq, inArray, isNull, or, type SQL } from 'drizzle-orm';
import { loadPersonas, personaIdsFromBody } from '@/lib/idea-server';
import { db } from '@/db';
import { brandSettings, contentIdeas } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { AiError } from '@/lib/ai/generate';
import { suggestIdeas, type ExistingIdea } from '@/lib/ai/idea';
import { IDEA_OBJECTIVES, MAX_IDEAS_PER_RUN } from '@/lib/idea';
import { descendantIds, pathOf, translationFor } from '@/lib/territory';
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
  // uma persona, várias (público amplo) ou nenhuma (público geral); a primeira é a principal
  const wanted = personaIdsFromBody(b);
  const persons = await loadPersonas(c.brandId, wanted);
  if (persons.length < new Set(wanted).size) return Response.json({ error: 'Persona não encontrada.' }, { status: 404 });
  const persona = persons[0] ?? null;
  const ids = persons.map((p) => p.id);

  let territory: { path: string[]; description: string; children: string[]; translation: string } | null = null;
  let territoryIds: string[] = []; // o território e o que está dentro dele
  const territoryId = typeof b?.territoryId === 'string' && b.territoryId ? b.territoryId : null;
  if (territoryId) {
    const all = await loadTerritoryNodes(c.brandId);
    const me = all.find((n) => n.id === territoryId);
    if (!me) return Response.json({ error: 'Território não encontrado.' }, { status: 404 });
    territoryIds = [...descendantIds(all, territoryId)];
    territory = { path: pathOf(all, territoryId), description: me.description, children: all.filter((n) => n.parentId === territoryId).map((n) => n.name), translation: persons.map((p) => { const t = translationFor(all, territoryId, p.id).text; return t ? (persons.length > 1 ? `${p.name}: ${t}` : t) : ''; }).filter(Boolean).join('\n') };
  }

  // ideias já criadas da MESMA persona (em qualquer território) e/ou do MESMO território (com qualquer persona): a IA lê tudo para não repetir e complementar
  const byPersona: SQL = ids.length ? or(inArray(contentIdeas.personaId, ids), arrayOverlaps(contentIdeas.personaIds, ids))! : isNull(contentIdeas.personaId);
  const conds: SQL[] = [byPersona];
  if (territoryIds.length) conds.push(inArray(contentIdeas.territoryId, territoryIds));
  const rows = await db.select({ pain: contentIdeas.pain, guide: contentIdeas.guide, cta: contentIdeas.cta, personaId: contentIdeas.personaId, personaName: contentIdeas.personaName, territoryId: contentIdeas.territoryId, territory: contentIdeas.territory })
    .from(contentIdeas).where(and(eq(contentIdeas.brandId, c.brandId), or(...conds))).orderBy(desc(contentIdeas.createdAt)).limit(120);
  const tset = new Set(territoryIds);
  const tagged: ExistingIdea[] = rows.map((x) => {
    const samePersona = ids.length ? !!x.personaId && ids.includes(x.personaId) : x.personaId === null, sameTerritory = !!x.territoryId && tset.has(x.territoryId);
    return { pain: x.pain, guide: x.guide, cta: x.cta, persona: x.personaName || 'Público geral', territory: x.territory, scope: samePersona && (sameTerritory || !territoryIds.length) ? 'same' : samePersona ? 'persona' : 'territory' };
  });
  const rank = { same: 0, persona: 1, territory: 2 } as const;
  const existing = tagged.sort((p, q) => rank[p.scope] - rank[q.scope]).slice(0, 45);
  const [s] = await db.select({ icp: brandSettings.personaIcp, aud: brandSettings.aiAudience }).from(brandSettings).where(eq(brandSettings.brandId, c.brandId));
  const brand = await loadBrandProfile(c.brandId);
  try {
    const r = await suggestIdeas({
      persona, personas: persons.length > 1 ? persons : undefined,
      icp: persona ? '' : s?.icp || s?.aud || '',
      brand: persona ? { ...brand, audience: '' } : brand,
      territory, existingPains: existing.map((x) => x.pain), existing,
      count: Math.min(MAX_IDEAS_PER_RUN, Math.max(1, Math.round(Number(b?.count)) || 3)),
      instructions: String(b?.instructions ?? '').slice(0, 1200),
      objective: IDEA_OBJECTIVES.some((o) => o.id === b?.objective) ? String(b?.objective) : 'auto',
    });
    return Response.json({ ideas: r.ideas });
  } catch (e) {
    return Response.json({ error: e instanceof AiError ? e.message : 'Não foi possível sugerir ideias.' }, { status: e instanceof AiError && e.retryable ? 503 : 502 });
  }
}
