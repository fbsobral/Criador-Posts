'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { videoFormats, videoScripts } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { MAX_PARTS, STAGES, type ScriptData, type Stage, type VideoPart } from '@/lib/video';
import { cleanSeconds } from '@/lib/video-server';

async function ctx() {
  const c = await getCtx();
  if (!c) throw new Error('Não autorizado');
  return c;
}
const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);

export type FormatInput = { id?: string; name: string; description: string; defaultSeconds: number; parts: VideoPart[] };

/** Cria ou atualiza um formato da marca (só administradores). Formatos globais não são editados: duplique para a marca. */
export async function saveFormat(input: FormatInput): Promise<{ id?: string; error?: string }> {
  const c = await ctx();
  if (!c.isBrandAdmin) return { error: 'Apenas administradores da marca editam formatos.' };
  const name = str(input.name, 80);
  if (!name) return { error: 'Dê um nome ao formato.' };
  const parts = (Array.isArray(input.parts) ? input.parts : []).slice(0, MAX_PARTS).map((p, i) => ({
    id: str(p.id, 20) || `p${i + 1}`, name: str(p.name, 60) || `Parte ${i + 1}`, instruction: str(p.instruction, 1500), percent: Math.min(100, Math.max(1, Math.round(Number(p.percent)) || 1)),
  }));
  if (!parts.length) return { error: 'O formato precisa de pelo menos uma parte.' };
  const values = { name, description: str(input.description, 300), defaultSeconds: cleanSeconds(input.defaultSeconds), parts, updatedAt: new Date() };
  if (input.id) {
    const [r] = await db.update(videoFormats).set(values).where(and(eq(videoFormats.id, input.id), eq(videoFormats.brandId, c.brandId))).returning({ id: videoFormats.id });
    if (!r) return { error: 'Formato não encontrado (formatos globais não podem ser editados; duplique para a sua marca).' };
    revalidatePath('/admin/videos/formatos');
    return { id: r.id };
  }
  const [r] = await db.insert(videoFormats).values({ ...values, brandId: c.brandId, createdBy: c.userId }).returning({ id: videoFormats.id });
  revalidatePath('/admin/videos/formatos');
  return { id: r.id };
}

/** Copia um formato (global ou da marca) para a marca, para poder editar. */
export async function duplicateFormat(id: string): Promise<{ id?: string; error?: string }> {
  const c = await ctx();
  if (!c.isBrandAdmin) return { error: 'Apenas administradores da marca criam formatos.' };
  const [f] = await db.select().from(videoFormats).where(eq(videoFormats.id, id));
  if (!f || (f.brandId && f.brandId !== c.brandId)) return { error: 'Formato não encontrado.' };
  const [r] = await db.insert(videoFormats).values({
    brandId: c.brandId, name: `${f.name} (cópia)`.slice(0, 80), description: f.description, defaultSeconds: f.defaultSeconds, parts: f.parts, createdBy: c.userId,
  }).returning({ id: videoFormats.id });
  revalidatePath('/admin/videos/formatos');
  return { id: r.id };
}

export async function deleteFormat(id: string): Promise<{ error?: string }> {
  const c = await ctx();
  if (!c.isBrandAdmin) return { error: 'Apenas administradores da marca excluem formatos.' };
  await db.delete(videoFormats).where(and(eq(videoFormats.id, id), eq(videoFormats.brandId, c.brandId)));
  revalidatePath('/admin/videos/formatos');
  return {};
}

/** Salva o roteiro editado (título, partes, legenda, hashtags e status). */
export async function saveScript(input: { id: string; title: string; data: ScriptData; status?: Stage }): Promise<{ error?: string }> {
  const c = await ctx();
  const d = input.data;
  const parts = (Array.isArray(d?.parts) ? d.parts : []).slice(0, MAX_PARTS).map((p) => ({
    name: str(p.name, 60), seconds: Math.max(1, Math.round(Number(p.seconds)) || 1), speech: str(p.speech, 2000), onScreen: str(p.onScreen, 200), visual: str(p.visual, 600),
  }));
  const data: ScriptData = { parts, caption: str(d?.caption, 2200), hashtags: (d?.hashtags ?? []).map((h) => str(h, 40)).filter(Boolean).slice(0, 15), notes: (d?.notes ?? []).map((n) => str(n, 300)).filter(Boolean).slice(0, 10) };
  const set: Partial<typeof videoScripts.$inferInsert> = { title: str(input.title, 120) || 'Sem título', data, updatedAt: new Date() };
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
