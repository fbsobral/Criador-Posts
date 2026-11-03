import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, personaGroups } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { AiError } from '@/lib/ai/generate';
import { suggestPersonaGroups } from '@/lib/ai/persona';
import { loadBrandProfile } from '@/lib/video-server';
import { TOO_MANY, rateLimit } from '@/lib/rate-limit';

export const maxDuration = 60;
const MAX_GROUPS_PER_RUN = 8;

/** Sugere grupos de personas (nome e descrição) a partir do ICP, sem repetir os existentes. Não grava: o usuário aprova antes. */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  if (!rateLimit(`ai:${c.userId}`, 100, 10 * 60_000)) return Response.json(TOO_MANY, { status: 429 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const [s] = await db.select({ icp: brandSettings.personaIcp }).from(brandSettings).where(eq(brandSettings.brandId, c.brandId));
  const typed = String(b?.icp ?? '').trim().slice(0, 4000);
  const icp = typed.length >= 20 ? typed : (s?.icp ?? '').trim();
  if (icp.length < 20) return Response.json({ error: 'Descreva o seu ICP com um pouco mais de detalhe (quem é, o que faz, o que busca).' }, { status: 400 });
  const count = Math.min(MAX_GROUPS_PER_RUN, Math.max(1, Math.round(Number(b?.count)) || 4));
  const groups = await db.select().from(personaGroups).where(eq(personaGroups.brandId, c.brandId));
  if (typed.length >= 20) await db.update(brandSettings).set({ personaIcp: icp, aiAudience: icp.slice(0, 1200) }).where(eq(brandSettings.brandId, c.brandId));
  try {
    const r = await suggestPersonaGroups({ icp, count, instructions: String(b?.instructions ?? '').slice(0, 1200), brand: await loadBrandProfile(c.brandId), existing: groups.map((g) => ({ name: g.name, description: g.description })) });
    return Response.json({ groups: r.groups });
  } catch (e) {
    return Response.json({ error: e instanceof AiError ? e.message : 'Não foi possível sugerir grupos.' }, { status: e instanceof AiError && e.retryable ? 503 : 502 });
  }
}
