import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, personaGroups, personas } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { AiError } from '@/lib/ai/generate';
import { suggestPersonas } from '@/lib/ai/persona';
import { MAX_PERSONAS_PER_RUN } from '@/lib/persona';
import { loadBrandProfile } from '@/lib/video-server';

export const maxDuration = 120;

/** Sugere personas a partir do ICP, considerando as que já existem. Não grava as personas: o usuário aprova antes. */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const icp = String(b?.icp ?? '').trim().slice(0, 4000);
  if (icp.length < 20) return Response.json({ error: 'Descreva o seu ICP com um pouco mais de detalhe (quem é, o que faz, o que busca).' }, { status: 400 });
  const count = Math.min(MAX_PERSONAS_PER_RUN, Math.max(1, Math.round(Number(b?.count)) || 3));

  const [rows, groups] = await Promise.all([
    db.select().from(personas).where(eq(personas.brandId, c.brandId)).limit(150),
    db.select().from(personaGroups).where(eq(personaGroups.brandId, c.brandId)),
  ]);
  const gname = new Map(groups.map((g) => [g.id, g.name]));
  await db.update(brandSettings).set({ personaIcp: icp, aiAudience: icp.slice(0, 1200) }).where(eq(brandSettings.brandId, c.brandId)); // lembra o ICP para a próxima vez
  try {
    const r = await suggestPersonas({
      icp, count, instructions: String(b?.instructions ?? '').slice(0, 1200), brand: await loadBrandProfile(c.brandId),
      existing: rows.map((p) => ({ name: p.name, tagline: p.tagline, role: p.data.role, group: p.groupId ? (gname.get(p.groupId) ?? '') : '', pains: p.data.pains })),
    });
    return Response.json({ groups: r.groups, existingGroups: groups.map((g) => g.name) });
  } catch (e) {
    return Response.json({ error: e instanceof AiError ? e.message : 'Não foi possível sugerir personas.' }, { status: e instanceof AiError && e.retryable ? 503 : 502 });
  }
}
