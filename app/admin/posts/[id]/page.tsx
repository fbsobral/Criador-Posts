import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { posts, templates } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { IconBack } from '../../../icons';
import { EditorFrame } from './editor-frame';
import { RenameTitle } from './rename-title';
import { ConvertButton } from '../convert-button';

export default async function PostEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = (await getCtx())!;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [post] = await db
    .select({
      id: posts.id, title: posts.title, status: posts.status, editor: templates.editor, sourcePostId: posts.sourcePostId,
      slides: sql<number>`case when jsonb_typeof(${posts.data}->'slides') = 'array' then jsonb_array_length(${posts.data}->'slides') else 0 end`,
    })
    .from(posts)
    .leftJoin(templates, eq(templates.id, posts.templateId))
    .where(and(eq(posts.id, id), eq(posts.brandId, c.brandId)));
  if (!post) notFound();

  return (
    <div className="editor-wrap">
      <div className="editor-bar">
        <Link href="/admin/posts"><IconBack /> Posts</Link>
        <RenameTitle id={post.id} title={post.title} />
        <span className={`pill ${post.status}`}>{post.status === 'draft' ? 'Rascunho' : 'Publicado'}</span>
        {post.sourcePostId && <Link href={`/admin/posts/${post.sourcePostId}`} className="pill" title="Abrir o post de origem">Derivado de outro post ↗</Link>}
        {(post.editor === 'carrossel' || post.editor === 'tweet') && process.env.ANTHROPIC_API_KEY && (
          <div className="post-actions in-list bar-actions"><ConvertButton id={post.id} editor={post.editor} slides={post.slides} /></div>
        )}
      </div>
      <EditorFrame src={`/editor?post=${post.id}`} title={post.title} />
    </div>
  );
}
