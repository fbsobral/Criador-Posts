import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { substackPosts } from '@/db/schema';
import { getCtx, getBrandSettings } from '@/lib/ctx';
import { EMPTY_META, normStatus } from '@/lib/substack';
import { IconBack } from '../../../icons';
import Link from 'next/link';
import { ArticleEditor } from './article-editor';

export const metadata = { title: 'Artigo · Substack' };

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = (await getCtx())!;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [a] = await db.select().from(substackPosts).where(and(eq(substackPosts.id, id), eq(substackPosts.brandId, c.brandId)));
  if (!a) notFound();
  const settings = await getBrandSettings(c.brandId);
  return (
    <div className="page sb-page">
      <Link href="/admin/substack" className="back"><IconBack /> Artigos do Substack</Link>
      <ArticleEditor
        id={a.id} brandName={settings?.displayName || c.brandName} hasKey={!!process.env.ANTHROPIC_API_KEY || process.env.AI_MOCK === '1'}
        initial={{ title: a.title, subtitle: a.subtitle, body: a.body, status: normStatus(a.status), meta: { ...EMPTY_META, ...a.meta } }}
      />
    </div>
  );
}
