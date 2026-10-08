import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { posts } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { IconBack } from '../../../icons';

export default async function PostEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = (await getCtx())!;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [post] = await db.select({ id: posts.id, title: posts.title, status: posts.status }).from(posts).where(and(eq(posts.id, id), eq(posts.brandId, c.brandId)));
  if (!post) notFound();

  return (
    <div className="editor-wrap">
      <div className="editor-bar">
        <Link href="/admin/posts"><IconBack /> Posts</Link>
        <b>{post.title}</b>
        <span className={`pill ${post.status}`}>{post.status === 'draft' ? 'Rascunho' : 'Publicado'}</span>
      </div>
      <iframe src={`/editor?post=${post.id}`} title={post.title} />
    </div>
  );
}
