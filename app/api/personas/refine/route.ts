import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, personas } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { AiError, type BrandProfile } from '@/lib/ai/generate';
import { refinePersona } from '@/lib/ai/persona';
import { emptyPersonaData, type PersonaData } from '@/lib/persona';
import { loadBrandProfile } from '@/lib/video-server';

export const maxDuration = 90;

const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const lst = (v: unknown) => (Array.isArray(v) ? v.map((x) => str(x, 240)).filter(Boolean).slice(0, 8) : []);
const toData = (v: unknown): PersonaData => {
  const d = (v ?? {}) as Record<string, unknown>;
  return { ...emptyPersonaData(), age: str(d.age, 30), role: str(d.role, 100), location: str(d.location, 100), bio: str(d.bio, 900), goals: lst(d.goals), pains: lst(d.pains), objections: lst(d.objections), triggers: lst(d.triggers), channels: lst(d.channels), quote: str(d.quote, 300) };
};
const toPersona = (v: unknown) => { const p = (v ?? {}) as Record<string, unknown>; return { name: str(p.name, 80), tagline: str(p.tagline, 200), data: toData(p.data) }; };

/** Refina uma persona (a versão que está na tela, mesmo sem salvar) a partir de um feedback. Não grava: o usuário aprova antes. */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const feedback = str(b?.feedback, 800);
  if (feedback.length < 3) return Response.json({ error: 'Diga o que você quer mudar nesta persona.' }, { status: 400 });
  const current = toPersona(b?.current);
  if (!current.name) return Response.json({ error: 'A persona precisa de um nome.' }, { status: 400 });
  const personaId = typeof b?.personaId === 'string' ? b.personaId : '';

  const [others, [s], brand] = await Promise.all([
    db.select({ name: personas.name, tagline: personas.tagline }).from(personas).where(personaId ? and(eq(personas.brandId, c.brandId), ne(personas.id, personaId)) : eq(personas.brandId, c.brandId)).limit(40),
    db.select({ icp: brandSettings.personaIcp, aud: brandSettings.aiAudience }).from(brandSettings).where(eq(brandSettings.brandId, c.brandId)),
    loadBrandProfile(c.brandId) as Promise<BrandProfile>,
  ]);
  try {
    const r = await refinePersona({ current, feedback, previous: b?.previous ? toPersona(b.previous) : undefined, others, icp: s?.icp || s?.aud || '', brand: { ...brand, audience: '' } });
    return Response.json({ name: r.name, tagline: r.tagline, data: r.data, note: r.note });
  } catch (e) {
    return Response.json({ error: e instanceof AiError ? e.message : 'Não foi possível refinar a persona.' }, { status: e instanceof AiError && e.retryable ? 503 : 502 });
  }
}
