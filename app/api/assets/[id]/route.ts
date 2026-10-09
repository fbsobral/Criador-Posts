import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { assets, posts } from '@/db/schema';
import { getCtx } from '@/lib/ctx';

const UUID = /^[0-9a-f-]{36}$/;

/** Bytes da imagem (ou da miniatura com ?thumb=1). Só para quem está na marca dona da imagem. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCtx();
  if (!c) return new Response('Não autorizado', { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return new Response('Inválido', { status: 400 });
  const thumb = new URL(req.url).searchParams.get('thumb') === '1';
  const [a] = await db
    .select({ bytes: thumb ? sql<Buffer>`coalesce(${assets.thumb}, ${assets.bytes})` : assets.bytes, mime: thumb ? sql<string>`case when ${assets.thumb} is null then ${assets.mime} else 'image/jpeg' end` : assets.mime })
    .from(assets)
    .where(and(eq(assets.id, id), eq(assets.brandId, c.brandId)));
  if (!a) return new Response('Não encontrada', { status: 404 });
  // o conteúdo de uma imagem nunca muda (o id é fixo), então pode ficar em cache
  return new Response(new Uint8Array(a.bytes), {
    headers: { 'content-type': a.mime, 'cache-control': 'private, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' },
  });
}

/** Exclui da galeria. Recusa se algum post ainda usa a imagem. */
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: 'Inválido' }, { status: 400 });
  const [a] = await db.select({ createdBy: assets.createdBy }).from(assets).where(and(eq(assets.id, id), eq(assets.brandId, c.brandId)));
  if (!a) return Response.json({ error: 'Não encontrada' }, { status: 404 });
  if (!c.isBrandAdmin && a.createdBy !== c.userId) return Response.json({ error: 'Sem permissão' }, { status: 403 });
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(posts).where(and(eq(posts.brandId, c.brandId), sql`${posts.data}::text like ${'%/api/assets/' + id + '%'}`));
  if (n > 0) return Response.json({ error: `Esta imagem é usada em ${n} ${n === 1 ? 'post' : 'posts'}. Remova-a dos posts antes de excluir.` }, { status: 409 });
  await db.delete(assets).where(eq(assets.id, id));
  return Response.json({ ok: true });
}
