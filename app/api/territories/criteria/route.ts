import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, personas } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { AiError } from '@/lib/ai/generate';
import { suggestCriteria } from '@/lib/ai/criteria';
import { priorityOf } from '@/lib/priority';
import { loadBrandProfile } from '@/lib/video-server';

export const maxDuration = 60;

/** Sugere os critérios de prioridade a partir do que a organização faz, do ICP e das personas. Não grava: o usuário revisa e salva. */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const [s] = await db.select({ icp: brandSettings.personaIcp, aud: brandSettings.aiAudience, pc: brandSettings.priorityConfig }).from(brandSettings).where(eq(brandSettings.brandId, c.brandId));
  const brand = await loadBrandProfile(c.brandId);
  if (!(brand.about ?? '').trim()) return Response.json({ error: 'Descreva antes “o que a organização faz” (faixa no topo de Territórios): é a base dos critérios.' }, { status: 400 });
  const people = await db.select({ name: personas.name, tagline: personas.tagline, data: personas.data }).from(personas).where(eq(personas.brandId, c.brandId)).limit(12);
  try {
    const criteria = await suggestCriteria({
      brand, icp: s?.icp || s?.aud || '', personas: people.map((p) => ({ name: p.name, tagline: p.tagline, pains: p.data.pains })),
      current: priorityOf(s?.pc).criteria, instructions: String(b?.instructions ?? '').slice(0, 800),
    });
    return Response.json({ criteria });
  } catch (e) {
    return Response.json({ error: e instanceof AiError ? e.message : 'Não foi possível sugerir critérios.' }, { status: e instanceof AiError && e.retryable ? 503 : 502 });
  }
}
