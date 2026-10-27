import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { videoScripts } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { AiError } from '@/lib/ai/generate';
import { refineVideoScript } from '@/lib/ai/video';
import type { ScriptData } from '@/lib/video';
import { cleanPlatform, loadBrandProfile, loadFormat } from '@/lib/video-server';

export const maxDuration = 120;

const s = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
/** Aceita o roteiro da tela só se tiver as mesmas partes do salvo (nomes e tempos vêm do banco). */
function toData(v: unknown, base: ScriptData): ScriptData | null {
  const d = (v ?? {}) as { parts?: { speech?: unknown; onScreen?: unknown; visual?: unknown }[]; caption?: unknown; hashtags?: unknown };
  if (!Array.isArray(d.parts) || d.parts.length !== base.parts.length) return null;
  return {
    parts: base.parts.map((p, k) => ({ ...p, speech: s(d.parts![k]?.speech, 1200), onScreen: s(d.parts![k]?.onScreen, 160), visual: s(d.parts![k]?.visual, 400) })),
    caption: s(d.caption, 2200), hashtags: (Array.isArray(d.hashtags) ? d.hashtags : []).map((h) => s(h, 40).replace(/^#/, '')).filter(Boolean).slice(0, 12), notes: base.notes,
  };
}

/** Refina um roteiro (a versão que está na tela, mesmo sem salvar). Não grava: o usuário aprova antes. */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const feedback = s(b?.feedback, 800);
  if (feedback.length < 3) return Response.json({ error: 'Diga o que você quer mudar neste roteiro.' }, { status: 400 });
  const id = String(b?.id ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: 'Roteiro inválido.' }, { status: 400 });
  const [row] = await db.select().from(videoScripts).where(and(eq(videoScripts.id, id), eq(videoScripts.brandId, c.brandId)));
  if (!row) return Response.json({ error: 'Roteiro não encontrado.' }, { status: 404 });
  const current = toData(b?.current, row.data);
  if (!current) return Response.json({ error: 'O roteiro mudou de estrutura. Recarregue a página.' }, { status: 400 });
  const prev = b?.previous as { title?: unknown; data?: unknown } | undefined;
  const previousData = prev ? toData(prev.data, row.data) : null;
  const scope = Number.isInteger(b?.scope) && Number(b?.scope) >= 0 && Number(b?.scope) < current.parts.length ? Number(b?.scope) : null;
  const format = row.formatId ? await loadFormat(c.brandId, row.formatId) : null;
  try {
    const r = await refineVideoScript({
      title: s(b?.title, 120) || row.title, data: current, previous: previousData ? { title: s(prev?.title, 120), data: previousData } : undefined,
      instructions: current.parts.map((_, k) => format?.parts[k]?.instruction ?? ''), formatName: row.formatName, seconds: row.seconds, platform: cleanPlatform(row.platform), angle: row.angle,
      feedback, scope, brand: await loadBrandProfile(c.brandId),
    });
    return Response.json({ title: r.title, data: r.data, note: r.note });
  } catch (e) {
    return Response.json({ error: e instanceof AiError ? e.message : 'Não foi possível refinar o roteiro.', retryable: e instanceof AiError && e.retryable }, { status: e instanceof AiError && e.retryable ? 503 : 502 });
  }
}
