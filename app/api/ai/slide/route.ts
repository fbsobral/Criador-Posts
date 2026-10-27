import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, brands } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { AiError } from '@/lib/ai/generate';
import { adjustSlideText } from '@/lib/ai/slide-text';

export const maxDuration = 60;

/** Sugere um novo texto para um slide a partir de um feedback. Só sugere: quem aplica é o usuário, no editor. */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });

  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
  const feedback = str(b?.feedback, 800);
  if (feedback.length < 3) return Response.json({ error: 'Diga o que você quer mudar neste slide.' }, { status: 400 });
  const editor = b?.editor === 'tweet' ? 'tweet' : 'carrossel';

  const [[s], [brand]] = await Promise.all([
    db.select().from(brandSettings).where(eq(brandSettings.brandId, c.brandId)),
    db.select().from(brands).where(eq(brands.id, c.brandId)),
  ]);
  try {
    const r = await adjustSlideText({
      editor, current: str(b?.current, 4000), format: str(b?.format, 40) || 'slide',
      slideIndex: Number(b?.slideIndex) || 1, total: Number(b?.total) || 1,
      outline: (Array.isArray(b?.outline) ? b!.outline as unknown[] : []).slice(0, 14).map((l) => str(l, 650)),
      title: str(b?.title, 120), topic: str(b?.topic, 80), feedback, previous: str(b?.previous, 4000) || undefined, tight: !!b?.tight,
      brand: {
        brandName: s?.displayName || brand?.name || '', niche: s?.aiNiche ?? '', audience: s?.aiAudience ?? '', voice: s?.aiVoice ?? '',
        rules: s?.aiRules ?? '', cta: s?.aiCta ?? '', examples: s?.aiExamples ?? '', captionRules: s?.aiCaptionRules ?? '', about: s?.aiAbout ?? '',
      },
    });
    return Response.json({ text: r.text, note: r.note });
  } catch (e) {
    const status = e instanceof AiError ? (e.retryable ? 503 : 502) : 500;
    return Response.json({ error: e instanceof AiError ? e.message : 'Não foi possível ajustar o texto.' }, { status });
  }
}
