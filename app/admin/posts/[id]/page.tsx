import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { posts } from '@/db/schema';
import { getCtx } from '@/lib/ctx';

export default async function PostEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = (await getCtx())!;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [post] = await db.select({ id: posts.id, title: posts.title }).from(posts).where(and(eq(posts.id, id), eq(posts.brandId, c.brandId)));
  if (!post) notFound();

  return (
    <div className="editor-wrap">
      <div className="editor-bar"><Link href="/admin/posts">← Posts</Link><b>{post.title}</b></div>
      <iframe src={`/editor?post=${post.id}`} title={post.title} />
    </div>
  );
}
