import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { colorPalettes } from '@/db/schema';
import { getCtx } from '@/lib/ctx';

/** Exclui cores salvas: o autor ou um admin da marca. */
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCtx();
  if (!c) return new Response('Não autorizado', { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response('Inválido', { status: 400 });

  const [row] = await db.select().from(colorPalettes).where(and(eq(colorPalettes.id, id), eq(colorPalettes.brandId, c.brandId)));
  if (!row) return new Response('Não encontrado', { status: 404 });
  if (row.createdBy !== c.userId && !c.isBrandAdmin) return new Response('Sem permissão', { status: 403 });

  await db.delete(colorPalettes).where(eq(colorPalettes.id, id));
  return Response.json({ ok: true });
}
