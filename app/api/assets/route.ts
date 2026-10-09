import { getCtx } from '@/lib/ctx';
import { ASSET_THUMB_URL, ASSET_URL, dataUrlToBuffer, markUsed, saveAsset, searchAssets } from '@/lib/assets';

/** Busca na galeria da marca: ?q=palavras&limit=24&min=1 */
export async function GET(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  const u = new URL(req.url);
  const limit = Math.min(60, Math.max(1, Number(u.searchParams.get('limit')) || 24));
  const min = Math.max(1, Number(u.searchParams.get('min')) || 1);
  const hits = await searchAssets(c.brandId, (u.searchParams.get('q') ?? '').slice(0, 1200), limit, min);
  return Response.json({
    items: hits.map((h) => ({ id: h.id, url: ASSET_URL(h.id), thumb: ASSET_THUMB_URL(h.id), description: h.description, tags: h.tags, kind: h.kind, usageCount: h.usageCount, matches: Number(h.matches) })),
  });
}

/** Envio de imagem (dataURL) para a galeria. Devolve a referência para usar no slide. */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { dataUrl?: string; description?: string; use?: string; kind?: string } | null;

  // marca uma imagem existente como usada (ranking da busca)
  if (body?.use && /^[0-9a-f-]{36}$/.test(body.use)) {
    await markUsed(c.brandId, body.use);
    return Response.json({ ok: true });
  }
  const buf = body?.dataUrl ? dataUrlToBuffer(body.dataUrl) : null;
  if (!buf) return Response.json({ error: 'Imagem inválida.' }, { status: 400 });
  try {
    const { id, reused } = await saveAsset({ brandId: c.brandId, userId: c.userId, kind: body?.kind === 'avatar' ? 'avatar' : 'upload', data: buf, description: body?.kind === 'avatar' ? 'Foto de perfil' : String(body?.description ?? '').slice(0, 300) });
    return Response.json({ id, url: ASSET_URL(id), thumb: ASSET_THUMB_URL(id), reused });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Não foi possível salvar a imagem.' }, { status: 422 });
  }
}
