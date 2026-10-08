import { db } from '@/db';
import { colorPalettes, type Theme } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { EDITORS } from '@/lib/editors';

/** Salva as cores atuais do editor como "cores do template" da marca. */
export async function POST(req: Request) {
  const c = await getCtx();
  if (!c) return new Response('Não autorizado', { status: 401 });
  const { name, theme, editor } = (await req.json()) as { name: string; theme: Theme; editor?: string };
  const editorKey = editor && editor in EDITORS ? editor : 'carrossel';
  if (!name?.trim() || !theme || typeof theme !== 'object' || typeof theme.bg !== 'string') return new Response('Dados inválidos', { status: 400 });

  const clean = Object.fromEntries(Object.entries(theme).filter(([, v]) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)));
  const [row] = await db
    .insert(colorPalettes)
    .values({ brandId: c.brandId, editor: editorKey, name: name.trim().slice(0, 60), theme: clean, createdBy: c.userId })
    .returning();
  return Response.json({ id: row.id, name: row.name, theme: row.theme, canDelete: true });
}
