import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, personaGroups, personas } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { AiError } from '@/lib/ai/generate';
import { suggestPersonas } from '@/lib/ai/persona';
import { MAX_PERSONAS_PER_RUN } from '@/lib/persona';
import { loadBrandProfile } from '@/lib/video-server';
import { TOO_MANY, rateLimit } from '@/lib/rate-limit';

export const maxDuration = 120;

/** Sugere personas a partir do ICP, considerando as que já existem. Não grava as personas: o usuário aprova antes. */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  if (!rateLimit(`ai:${c.userId}`, 100, 10 * 60_000)) return Response.json(TOO_MANY, { status: 429 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const typedIcp = String(b?.icp ?? '').trim().slice(0, 4000);
  const groupId = typeof b?.groupId === 'string' && b.groupId ? b.groupId : null;
  if (!groupId && typedIcp.length < 20) return Response.json({ error: 'Descreva o seu ICP com um pouco mais de detalhe (quem é, o que faz, o que busca).' }, { status: 400 });
  const count = Math.min(MAX_PERSONAS_PER_RUN, Math.max(1, Math.round(Number(b?.count)) || 3));

  const [rows, groups] = await Promise.all([
    db.select().from(personas).where(eq(personas.brandId, c.brandId)).limit(150),
    db.select().from(personaGroups).where(eq(personaGroups.brandId, c.brandId)),
  ]);
  const gname = new Map(groups.map((g) => [g.id, g.name]));
  const target = groupId ? groups.find((g) => g.id === groupId) : null;
  if (groupId && !target) return Response.json({ error: 'Grupo não encontrado.' }, { status: 404 });
  // sem ICP digitado, dentro de um grupo o contexto vem do próprio grupo e das personas dele
  const icp = typedIcp.length >= 20 ? typedIcp : `Grupo "${target!.name}"${target!.description ? `: ${target!.description}` : ''}`;
  if (typedIcp.length >= 20) await db.update(brandSettings).set({ personaIcp: icp, aiAudience: icp.slice(0, 1200) }).where(eq(brandSettings.brandId, c.brandId)); // lembra o ICP para a próxima vez
  try {
    const r = await suggestPersonas({
      icp, count, group: target ? { name: target.name, description: target.description } : undefined, instructions: String(b?.instructions ?? '').slice(0, 1200), brand: await loadBrandProfile(c.brandId),
      existing: rows.map((p) => ({ name: p.name, tagline: p.tagline, role: p.data.role, group: p.groupId ? (gname.get(p.groupId) ?? '') : '', pains: p.data.pains })),
    });
    return Response.json({ groups: r.groups, existingGroups: groups.map((g) => g.name) });
  } catch (e) {
    return Response.json({ error: e instanceof AiError ? e.message : 'Não foi possível sugerir personas.' }, { status: e instanceof AiError && e.retryable ? 503 : 502 });
  }
}
