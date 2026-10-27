import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, personas, territories } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { AiError } from '@/lib/ai/generate';
import { scoreTerritories, type Scored } from '@/lib/ai/priority';
import { priorityOf } from '@/lib/priority';
import { PUBLICO_ID, descendantIds, pathOf, type TNode } from '@/lib/territory';
import { loadBrandProfile } from '@/lib/video-server';

export const maxDuration = 300;
const CHUNK = 50;

/** Reclassifica (score 1–100) os territórios: da marca toda, de um mapa (persona/público geral) ou de um território e seus filhos. Grava direto. */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const scope = b?.scope === 'all' ? 'all' : b?.scope === 'node' ? 'node' : 'persona';

  const rows = await db.select({ id: territories.id, personaId: territories.personaId, parentId: territories.parentId, name: territories.name, description: territories.description, position: territories.position, source: territories.source })
    .from(territories).where(eq(territories.brandId, c.brandId));
  const all = rows.map((r) => ({ ...r, personaId: r.personaId ?? PUBLICO_ID })) as TNode[];

  // quais territórios entram, agrupados por mapa
  let targets: TNode[];
  if (scope === 'all') targets = all;
  else if (scope === 'node') {
    const me = all.find((n) => n.id === b?.nodeId);
    if (!me) return Response.json({ error: 'Território não encontrado.' }, { status: 404 });
    const ids = descendantIds(all.filter((n) => n.personaId === me.personaId), me.id);
    targets = all.filter((n) => ids.has(n.id));
  } else {
    const pid = String(b?.personaId ?? '');
    targets = all.filter((n) => n.personaId === pid);
  }
  if (!targets.length) return Response.json({ updated: 0, scores: {} });

  const [s] = await db.select({ icp: brandSettings.personaIcp, aud: brandSettings.aiAudience, pc: brandSettings.priorityConfig }).from(brandSettings).where(eq(brandSettings.brandId, c.brandId));
  const config = priorityOf(s?.pc);
  if (!config.criteria.length) return Response.json({ error: 'Defina os critérios de prioridade antes de classificar.' }, { status: 400 });
  const brand = await loadBrandProfile(c.brandId);
  const mapIds = [...new Set(targets.map((n) => n.personaId))];
  const people = await db.select().from(personas).where(and(eq(personas.brandId, c.brandId), inArray(personas.id, mapIds.filter((x) => x !== PUBLICO_ID).length ? mapIds.filter((x) => x !== PUBLICO_ID) : ['00000000-0000-0000-0000-000000000000'])));

  try {
    const results = await Promise.all(mapIds.map(async (mid): Promise<Scored[]> => {
      const mine = all.filter((n) => n.personaId === mid);
      const todo = targets.filter((n) => n.personaId === mid);
      const p = people.find((x) => x.id === mid);
      const out: Scored[] = [];
      for (let i = 0; i < todo.length; i += CHUNK) {
        out.push(...await scoreTerritories({
          items: todo.slice(i, i + CHUNK).map((n) => ({ id: n.id, path: pathOf(mine, n.id).join(' › '), description: n.description })),
          persona: p ? { name: p.name, tagline: p.tagline, data: p.data } : null,
          icp: p ? '' : s?.icp || s?.aud || '',
          brand: p ? { ...brand, audience: '' } : brand, config,
        }));
      }
      return out;
    }));
    const flat = results.flat();
    if (!flat.length) throw new AiError('A IA não devolveu nenhuma classificação. Tente de novo.', true);
    await Promise.all(flat.map((x) => db.update(territories).set({ score: x.score, scoreReason: x.reason, updatedAt: new Date() }).where(and(eq(territories.id, x.id), eq(territories.brandId, c.brandId)))));
    return Response.json({ updated: flat.length, total: targets.length, scores: Object.fromEntries(flat.map((x) => [x.id, { score: x.score, reason: x.reason }])) });
  } catch (e) {
    return Response.json({ error: e instanceof AiError ? e.message : 'Não foi possível classificar.' }, { status: e instanceof AiError && e.retryable ? 503 : 502 });
  }
}
