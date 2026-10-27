import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, personas } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { AiError } from '@/lib/ai/generate';
import { refineIdea } from '@/lib/ai/idea';
import { EMPTY_FIELDS, IDEA_FIELDS, type IdeaFields } from '@/lib/idea';
import { PUBLICO_ID } from '@/lib/territory';
import { loadBrandProfile } from '@/lib/video-server';

export const maxDuration = 90;

const toFields = (v: unknown): IdeaFields => {
  const o = (v ?? {}) as Record<string, unknown>;
  return Object.fromEntries(IDEA_FIELDS.map((f) => [f.key, String(o[f.key] ?? '').trim().slice(0, f.max)])) as IdeaFields ?? EMPTY_FIELDS;
};

/** Refina uma ideia (a versão que está na tela, mesmo sem salvar) a partir de um feedback. Não grava: o usuário aprova antes. */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const feedback = String(b?.feedback ?? '').trim().slice(0, 800);
  if (feedback.length < 3) return Response.json({ error: 'Diga o que você quer mudar nesta ideia.' }, { status: 400 });
  const current = toFields(b?.current);
  if (!current.pain) return Response.json({ error: 'Escreva ao menos a dor antes de refinar.' }, { status: 400 });
  const personaId = typeof b?.personaId === 'string' && b.personaId !== PUBLICO_ID ? b.personaId : null;
  const [persona] = personaId ? await db.select().from(personas).where(and(eq(personas.id, personaId), eq(personas.brandId, c.brandId))) : [null];
  const [s] = await db.select({ icp: brandSettings.personaIcp, aud: brandSettings.aiAudience }).from(brandSettings).where(eq(brandSettings.brandId, c.brandId));
  const brand = await loadBrandProfile(c.brandId);
  try {
    const r = await refineIdea({
      current, previous: b?.previous ? toFields(b.previous) : undefined, feedback,
      persona: persona ? { name: persona.name, tagline: persona.tagline, role: persona.data.role, data: persona.data } : null,
      territory: String(b?.territory ?? '').slice(0, 200), icp: persona ? '' : s?.icp || s?.aud || '', brand: persona ? { ...brand, audience: '' } : brand,
    });
    return Response.json({ fields: r.fields, note: r.note });
  } catch (e) {
    return Response.json({ error: e instanceof AiError ? e.message : 'Não foi possível refinar a ideia.' }, { status: e instanceof AiError && e.retryable ? 503 : 502 });
  }
}
