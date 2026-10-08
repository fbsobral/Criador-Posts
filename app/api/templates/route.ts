import { db } from '@/db';
import { templates, type Style } from '@/db/schema';
import { getCtx } from '@/lib/ctx';

/** "Salvar como template" a partir do editor (por marca; global só para admin da plataforma). */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return new Response('Não autorizado', { status: 401 });
  if (!c.isBrandAdmin && !c.isPlatformAdmin) return new Response('Apenas admins', { status: 403 });
  const { name, style, global } = (await req.json()) as { name: string; style: Style; global?: boolean };
  if (!name?.trim() || !style?.theme) return new Response('Dados inválidos', { status: 400 });
  if (global && !c.isPlatformAdmin) return new Response('Apenas admin da plataforma', { status: 403 });

  const [t] = await db
    .insert(templates)
    .values({ name: name.trim(), style, brandId: global ? null : c.brandId, createdBy: c.userId })
    .returning();
  return Response.json(t);
}
