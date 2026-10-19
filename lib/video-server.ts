import { and, count, eq, gte, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { brandSettings, brands, videoFormats, videoScripts } from '@/db/schema';
import type { BrandProfile } from '@/lib/ai/generate';
import { MAX_SECONDS, MIN_SECONDS, PLATFORMS, type Platform } from '@/lib/video';

export const VIDEO_DAILY_LIMIT = Number(process.env.AI_VIDEO_DAILY_LIMIT) || 60;

/** Formato da marca ou global. */
export async function loadFormat(brandId: string, id: string) {
  const [f] = await db.select().from(videoFormats).where(and(eq(videoFormats.id, id), or(isNull(videoFormats.brandId), eq(videoFormats.brandId, brandId))));
  return f ?? null;
}

export async function loadBrandProfile(brandId: string): Promise<BrandProfile> {
  const [[s], [b]] = await Promise.all([
    db.select().from(brandSettings).where(eq(brandSettings.brandId, brandId)),
    db.select().from(brands).where(eq(brands.id, brandId)),
  ]);
  return {
    brandName: s?.displayName || b?.name || '', niche: s?.aiNiche ?? '', audience: s?.aiAudience ?? '', voice: s?.aiVoice ?? '',
    rules: s?.aiRules ?? '', cta: s?.aiCta ?? '', examples: s?.aiExamples ?? '', captionRules: s?.aiCaptionRules ?? '',
  };
}

export async function scriptsToday(brandId: string): Promise<number> {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [{ n }] = await db.select({ n: count() }).from(videoScripts).where(and(eq(videoScripts.brandId, brandId), gte(videoScripts.createdAt, start)));
  return n;
}

export const cleanSeconds = (v: unknown) => Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(Number(v)) || 45));
export const cleanPlatform = (v: unknown): Platform => (PLATFORMS.some((p) => p.id === v) ? (v as Platform) : 'reels');
