import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { colorPalettes, posts, templates } from '@/db/schema';
import { editorFile } from '@/lib/editors';
import { getCtx } from '@/lib/ctx';

const HOST_MARKS = ['<!--HOST-->', '<script>\n/* =============== ícones'];

/** Serve o editor para um post da marca ativa, injetando dados e URLs de save. */
export async function GET(req: Request) {
  const c = await getCtx();
  if (!c) return new Response('Não autenticado ou sem marca ativa', { status: 401 });

  const postId = new URL(req.url).searchParams.get('post') ?? '';
  if (!/^[0-9a-f-]{36}$/.test(postId)) return new Response('Post inválido', { status: 400 });
  const [post] = await db.select().from(posts).where(and(eq(posts.id, postId), eq(posts.brandId, c.brandId)));
  if (!post) return new Response('Post não encontrado', { status: 404 });

  const [tpl] = post.templateId ? await db.select().from(templates).where(eq(templates.id, post.templateId)) : [];

  const editorKey = tpl?.editor ?? 'carrossel';
  const palettes = await db
    .select()
    .from(colorPalettes)
    .where(and(eq(colorPalettes.brandId, c.brandId), eq(colorPalettes.editor, editorKey)))
    .orderBy(colorPalettes.name);

  const host = {
    initial: post.data,
    saveUrl: `/api/posts/${post.id}`,
    palettesUrl: '/api/palettes',
    editor: editorKey,
    palettes: palettes.map((p) => ({ id: p.id, name: p.name, theme: p.theme, canDelete: c.isBrandAdmin || p.createdBy === c.userId })),
  };
  // "<" escapado para o JSON não conseguir fechar a tag <script>
  const json = JSON.stringify(host).replace(/</g, '\\u003c');

  let html = await readFile(join(process.cwd(), 'private', editorFile(tpl?.editor)), 'utf8');
  const mark = HOST_MARKS.find((m) => html.includes(m));
  if (!mark) return new Response('Template do editor inválido', { status: 500 });
  html = html.replace(mark, () => `<script>window.CARROSSEL = ${json};</script>\n${mark}`);

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store' },
  });
}
