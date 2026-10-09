import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { generationBatches } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { kickBatch } from '@/lib/ai/worker';

/** Retoma o processamento de um lote (ex.: depois de reiniciar o servidor). */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return new Response('Não autorizado', { status: 401 });
  const { batchId } = (await req.json()) as { batchId?: string };
  if (!batchId || !/^[0-9a-f-]{36}$/.test(batchId)) return new Response('Inválido', { status: 400 });
  const [b] = await db.select({ id: generationBatches.id }).from(generationBatches).where(and(eq(generationBatches.id, batchId), eq(generationBatches.brandId, c.brandId)));
  if (!b) return new Response('Não encontrado', { status: 404 });
  kickBatch(b.id);
  return Response.json({ ok: true });
}
