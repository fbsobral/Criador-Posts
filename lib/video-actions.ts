'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { videoScripts } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { MAX_PARTS, MAX_SECONDS, STAGES, totalSeconds, type ScriptData, type Stage } from '@/lib/video';
import { cleanSeconds } from '@/lib/video-server';

async function ctx() {
  const c = await getCtx();
  if (!c) throw new Error('Não autorizado');
  return c;
}
const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);


/** Salva o roteiro editado (título, partes, legenda, hashtags e status). */
export async function saveScript(input: { id: string; title: string; data: ScriptData; status?: Stage }): Promise<{ error?: string }> {
  const c = await ctx();
  const d = input.data;
  const parts = (Array.isArray(d?.parts) ? d.parts : []).slice(0, MAX_PARTS).map((p) => ({
    name: str(p.name, 60), seconds: Math.max(1, Math.round(Number(p.seconds)) || 1), speech: str(p.speech, 2000), onScreen: str(p.onScreen, 200), visual: str(p.visual, 600),
  }));
  const data: ScriptData = { parts, caption: str(d?.caption, 2200), hashtags: (d?.hashtags ?? []).map((h) => str(h, 40)).filter(Boolean).slice(0, 15), notes: (d?.notes ?? []).map((n) => str(n, 300)).filter(Boolean).slice(0, 10) };
  // notas de produção e o texto original da IA: guardados como vieram (só texto, com limite de tamanho)
  if (d?.production) data.production = { rhythm: str(d.production.rhythm, 1500), sources: (Array.isArray(d.production.sources) ? d.production.sources : []).map((x) => str(x, 200)).filter(Boolean).slice(0, 10), shortVersion: str(d.production.shortVersion, 1500) };
  if (d?.markdown) data.markdown = str(d.markdown, 20000);
  // o vídeo dura a soma dos blocos (muda quando o usuário aumenta ou diminui um bloco ao refinar)
  const set: Partial<typeof videoScripts.$inferInsert> = { title: str(input.title, 120) || 'Sem título', data, updatedAt: new Date() };
  const total = totalSeconds(data);
  if (total > 0) set.seconds = Math.min(MAX_SECONDS, total);
  if (STAGES.some((x) => x.id === input.status)) set.status = input.status;
  await db.update(videoScripts).set(set).where(and(eq(videoScripts.id, input.id), eq(videoScripts.brandId, c.brandId)));
  return {};
}

export async function duplicateScript(id: string): Promise<{ id?: string; error?: string }> {
  const c = await ctx();
  const [s] = await db.select().from(videoScripts).where(and(eq(videoScripts.id, id), eq(videoScripts.brandId, c.brandId)));
  if (!s) return { error: 'Roteiro não encontrado.' };
  const [r] = await db.insert(videoScripts).values({
    brandId: c.brandId, formatId: s.formatId, formatName: s.formatName, title: `${s.title} (cópia)`.slice(0, 120), platform: s.platform, seconds: s.seconds, angle: s.angle,
    data: s.data, createdBy: c.userId,
  }).returning({ id: videoScripts.id });
  revalidatePath('/admin/videos');
  return { id: r.id };
}

export async function deleteScript(id: string): Promise<{ error?: string }> {
  const c = await ctx();
  await db.delete(videoScripts).where(and(eq(videoScripts.id, id), eq(videoScripts.brandId, c.brandId)));
  revalidatePath('/admin/videos');
  return {};
}

/** Move o roteiro para outra etapa do fluxo (kanban e lista). */
export async function setScriptStatus(id: string, status: Stage): Promise<{ error?: string }> {
  const c = await ctx();
  if (!STAGES.some((x) => x.id === status)) return { error: 'Etapa inválida.' };
  await db.update(videoScripts).set({ status, updatedAt: new Date() }).where(and(eq(videoScripts.id, id), eq(videoScripts.brandId, c.brandId)));
  revalidatePath('/admin/videos');
  return {};
}
