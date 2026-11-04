import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { substackPosts } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { timeAgo } from '@/lib/format';
import { countWords, normStatus, plainText, readMinutes } from '@/lib/substack';
import { IconNewsletter, IconSpark } from '../../icons';
import { EmptyState, PageHead } from '../ui';
import { ArticlesView } from './articles-view';

export const metadata = { title: 'Substack' };

export default async function SubstackPage() {
  const c = (await getCtx())!;
  const rows = await db.select().from(substackPosts).where(eq(substackPosts.brandId, c.brandId)).orderBy(desc(substackPosts.updatedAt)).limit(200);
  return (
    <div className="page">
      <PageHead
        title="Artigos do Substack"
        description="Artigos e newsletters com a voz da sua marca, escritos a partir de uma ideia de conteúdo, de um tema ou de um material seu. Acompanhe cada um do rascunho até a publicação."
        actions={<Link href="/admin/substack/novo" className="btn primary"><IconSpark /> Gerar artigo</Link>}
      />
      {rows.length === 0 ? (
        <EmptyState icon={<IconNewsletter />} title="Nenhum artigo ainda" action={<Link href="/admin/substack/novo" className="btn primary"><IconSpark /> Gerar meu primeiro artigo</Link>}>
          Escolha uma ideia de conteúdo (ou um tema, ou um material), aprove o esboço e a IA escreve o artigo, com assunto do e-mail e Notes para divulgar.
        </EmptyState>
      ) : (
        <ArticlesView rows={rows.map((a) => { const w = countWords(plainText(a.body)); return { id: a.id, title: a.title, subtitle: a.subtitle, status: normStatus(a.status), words: w, minutes: readMinutes(w), ago: timeAgo(a.updatedAt) }; })} />
      )}
    </div>
  );
}
