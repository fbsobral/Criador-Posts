import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { assets, posts } from '@/db/schema';
import { plainText } from './format';

export const ASSET_URL = (id: string) => `/api/assets/${id}`;
export const ASSET_THUMB_URL = (id: string) => `/api/assets/${id}?thumb=1`;
export const ASSET_URL_RE = /^\/api\/assets\/([0-9a-f-]{36})$/;
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_SIDE = 2000;

const STOP = new Set(('que para com uma uns umas dos das nos nas por mais como mas foi são ser tem ter seu sua seus suas isso esse essa esses essas este esta estes estas ' +
  'ele ela eles elas você voce vocês quando onde qual quais muito muita pouco entre sobre sem até depois antes também ainda mesmo cada todo toda todos todas ' +
  'fazer feito faz pode podem deve devem está estão estar nos já aqui ali lá então assim porque pois seja fica ficar slide imagem foto cena').split(/\s+/));

/** Palavras-chave de um texto: sem artigos/preposições, ordenadas por relevância (frequência e tamanho). */
export function keywords(text: string, max = 8): string[] {
  const freq = new Map<string, number>();
  for (const raw of text.toLowerCase().normalize('NFC').split(/[^a-zà-úç0-9]+/)) {
    if (raw.length < 4 || STOP.has(raw) || /^\d+$/.test(raw)) continue;
    freq.set(raw, (freq.get(raw) ?? 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, max).map(([w]) => w);
}

export function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const m = /^data:image\/[a-z0-9.+-]+;base64,(.+)$/i.exec(dataUrl);
  return m ? Buffer.from(m[1], 'base64') : null;
}

type Saved = { id: string; reused: boolean };

/**
 * Guarda uma imagem na galeria da marca: reencoda (JPEG, ou PNG se tiver transparência), limita o tamanho,
 * gera miniatura e evita duplicatas (mesmo conteúdo na mesma marca devolve a existente).
 */
export async function saveAsset(input: {
  brandId: string; userId: string | null; kind: 'ai' | 'upload'; data: Buffer; description?: string; tags?: string[];
}): Promise<Saved> {
  if (input.data.length > MAX_UPLOAD_BYTES) throw new Error('Imagem grande demais (máximo 12 MB).');
  const base = sharp(input.data, { failOn: 'none' }).rotate();
  const meta = await base.metadata().catch(() => null);
  if (!meta?.width || !meta.height) throw new Error('Arquivo de imagem inválido.');

  const pipeline = base.clone().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true });
  const png = !!meta.hasAlpha;
  const { data: bytes, info } = await (png ? pipeline.png({ compressionLevel: 9 }) : pipeline.jpeg({ quality: 86, mozjpeg: true })).toBuffer({ resolveWithObject: true });
  const thumb = await sharp(bytes).resize({ width: 420, height: 420, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 72 }).toBuffer();

  const hash = createHash('sha256').update(bytes).digest('hex');
  const description = (input.description ?? '').trim().slice(0, 1500);
  const tags = [...new Set([...(input.tags ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean), ...keywords(description, 6)])].slice(0, 12).join(' ');

  const [existing] = await db.select({ id: assets.id, description: assets.description }).from(assets).where(and(eq(assets.brandId, input.brandId), eq(assets.contentHash, hash)));
  if (existing) {
    if (!existing.description && description) await db.update(assets).set({ description, tags }).where(eq(assets.id, existing.id));
    return { id: existing.id, reused: true };
  }
  const [row] = await db.insert(assets).values({
    brandId: input.brandId, kind: input.kind, mime: png ? 'image/png' : 'image/jpeg', bytes, thumb,
    size: bytes.length, width: info.width, height: info.height, description, tags, contentHash: hash, createdBy: input.userId,
  }).returning({ id: assets.id });
  return { id: row.id, reused: false };
}

export type AssetHit = { id: string; description: string; tags: string; kind: string; usageCount: number; width: number | null; height: number | null; createdAt: Date; matches: number };

/**
 * Busca na galeria da marca por palavras-chave (busca de texto em português).
 * Com `q` vazio devolve as mais recentes. `matches` = quantas palavras da busca a imagem contém.
 */
export async function searchAssets(brandId: string, q: string, limit = 24, minMatches = 1): Promise<AssetHit[]> {
  const terms = keywords(q, 8);
  const cols = sql`id, description, tags, kind, usage_count as "usageCount", width, height, created_at as "createdAt"`;
  if (!q.trim() || !terms.length) {
    if (q.trim()) {
      const like = `%${q.trim().replace(/[%_]/g, '')}%`;
      return (await db.execute(sql`select ${cols}, 0 as matches from assets where brand_id = ${brandId} and (description ilike ${like} or tags ilike ${like}) order by created_at desc limit ${limit}`)) as unknown as AssetHit[];
    }
    return (await db.execute(sql`select ${cols}, 0 as matches from assets where brand_id = ${brandId} order by created_at desc limit ${limit}`)) as unknown as AssetHit[];
  }
  const matchExpr = sql.join(terms.map((t) => sql`(search @@ plainto_tsquery('portuguese', ${t}))::int`), sql` + `);
  const orQuery = terms.map((t) => `'${t.replace(/'/g, '')}'`).join(' | ');
  const rows = (await db.execute(sql`
    select ${cols}, (${matchExpr}) as matches, ts_rank(search, to_tsquery('portuguese', ${orQuery})) as rank
    from assets
    where brand_id = ${brandId} and search @@ to_tsquery('portuguese', ${orQuery})
    order by matches desc, rank desc, usage_count desc, created_at desc
    limit ${limit}`)) as unknown as (AssetHit & { rank: number })[];
  return rows.filter((r) => Number(r.matches) >= minMatches);
}

export async function markUsed(brandId: string, id: string) {
  await db.update(assets).set({ usageCount: sql`${assets.usageCount} + 1`, lastUsedAt: new Date() }).where(and(eq(assets.id, id), eq(assets.brandId, brandId)));
}

/**
 * Move para a galeria as imagens embutidas (base64) nos slides dos posts da marca e troca por referências.
 * Pode rodar várias vezes: só mexe no que ainda é base64.
 */
export async function importPostImagesFor(brandId: string, userId: string | null) {
  const rows = await db.select({ id: posts.id, title: posts.title, data: posts.data }).from(posts).where(eq(posts.brandId, brandId));
  let images = 0, changed = 0;
  for (const p of rows) {
    const slides = Array.isArray(p.data.slides) ? (p.data.slides as Record<string, unknown>[]) : [];
    let dirty = false;
    for (const sl of slides) {
      const img = sl.image;
      if (typeof img !== 'string' || !img.startsWith('data:image')) continue;
      const buf = dataUrlToBuffer(img);
      if (!buf) continue;
      try {
        const text = plainText(String(sl.html ?? sl.text ?? '')).slice(0, 200);
        const { id } = await saveAsset({ brandId, userId, kind: 'upload', data: buf, description: `${p.title}. ${text}`.slice(0, 400), tags: keywords(`${p.title} ${text}`, 6) });
        sl.image = ASSET_URL(id);
        dirty = true; images++;
      } catch { /* imagem ilegível: mantém como está */ }
    }
    if (dirty) { await db.update(posts).set({ data: p.data }).where(eq(posts.id, p.id)); changed++; }
  }
  return { images, posts: changed };
}
