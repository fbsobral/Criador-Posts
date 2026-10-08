import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { posts, type PostData } from '@/db/schema';
import { getCtx } from '@/lib/ctx';

/** Auto-save do editor. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCtx();
  if (!c) return new Response('Não autorizado', { status: 401 });
  const { id } = await params;
  const data = (await req.json()) as PostData;
  if (!data || !Array.isArray(data.slides)) return new Response('Dados inválidos', { status: 400 });

  const res = await db
    .update(posts)
    .set({ data, updatedBy: c.userId, updatedAt: new Date() })
    .where(and(eq(posts.id, id), eq(posts.brandId, c.brandId)))
    .returning({ id: posts.id });
  return res.length ? Response.json({ ok: true }) : new Response('Post não encontrado', { status: 404 });
}
