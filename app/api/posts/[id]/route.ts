import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { posts, type PostData } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { MAX_POST_BYTES, sanitizePostData } from '@/lib/post-sanitize';
import { rateLimit } from '@/lib/rate-limit';

/** Auto-save do editor. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCtx();
  if (!c) return new Response('Não autorizado', { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Inválido', { status: 400 });
  if (!rateLimit(`save:${c.userId}`, 600, 60_000)) return new Response('Muitas gravações seguidas. Aguarde um instante.', { status: 429 });
  if (Number(req.headers.get('content-length') ?? 0) > MAX_POST_BYTES) return new Response('Post grande demais', { status: 413 });
  const raw = (await req.json().catch(() => null)) as PostData | null;
  if (!raw || !Array.isArray(raw.slides) || typeof raw.g !== 'object' || raw.g === null) return new Response('Dados inválidos', { status: 400 });
  const data = sanitizePostData(raw);

  const res = await db
    .update(posts)
    .set({ data, updatedBy: c.userId, updatedAt: new Date() })
    .where(and(eq(posts.id, id), eq(posts.brandId, c.brandId)))
    .returning({ id: posts.id });
  return res.length ? Response.json({ ok: true }) : new Response('Post não encontrado', { status: 404 });
}

/** Renomeia o post. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCtx();
  if (!c) return new Response('Não autorizado', { status: 401 });
  const { id } = await params;
  const { title } = (await req.json()) as { title?: string };
  const clean = (title ?? '').trim().slice(0, 120);
  if (!clean) return new Response('Título vazio', { status: 400 });

  const res = await db
    .update(posts)
    .set({ title: clean, updatedBy: c.userId, updatedAt: new Date() })
    .where(and(eq(posts.id, id), eq(posts.brandId, c.brandId)))
    .returning({ id: posts.id, title: posts.title });
  return res.length ? Response.json(res[0]) : new Response('Post não encontrado', { status: 404 });
}
