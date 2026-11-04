import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { substackPosts } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { ARTICLE_STATUS, countWords, normStatus, plainText, readMinutes } from '@/lib/substack';
import { IconNewsletter, IconPlus } from '../../icons';
import { PageHead } from '../ui';
import { ArticleMenu } from './article-menu';

export const metadata = { title: 'Substack' };

export default async function SubstackPage() {
  const c = (await getCtx())!;
  const rows = await db.select().from(substackPosts).where(eq(substackPosts.brandId, c.brandId)).orderBy(desc(substackPosts.updatedAt)).limit(200);
  const fmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
  return (
    <div className="page">
      <PageHead title="Substack" description="Artigos e newsletters com a voz da sua marca. Nascem de uma ideia de conteúdo, de um tema ou de um material seu." actions={<Link href="/admin/substack/novo" className="btn primary"><IconPlus /> Novo artigo</Link>} />
      {rows.length === 0 ? (
        <div className="sb-hero">
          <div className="sb-hero-ic"><IconNewsletter /></div>
          <h2>Seu ateliê de newsletter</h2>
          <p>Transforme uma ideia de conteúdo em um artigo completo: título, subtítulo, texto, assunto do e-mail e Notes para divulgar. Você aprova o esboço, a IA escreve, você lapida.</p>
          <div className="sb-hero-steps"><span><b>1</b> Escolha a ideia</span><span><b>2</b> Aprove o esboço</span><span><b>3</b> Lapide e copie para o Substack</span></div>
          <Link href="/admin/substack/novo" className="btn primary">Escrever meu primeiro artigo</Link>
        </div>
      ) : (
        <div className="sb-list">
          {rows.map((a) => {
            const st = ARTICLE_STATUS.find((x) => x.id === normStatus(a.status))!;
            const w = countWords(plainText(a.body));
            return (
              <article key={a.id} className="sb-item card-surface">
                <Link href={`/admin/substack/${a.id}`} className="sb-item-main">
                  <span className="sb-st" style={{ color: st.color }}><i style={{ background: st.color }} />{st.label}</span>
                  <h3>{a.title}</h3>
                  {a.subtitle && <p>{a.subtitle}</p>}
                  <small>{w} palavras · {readMinutes(w)} min de leitura · {fmt.format(a.updatedAt)}</small>
                </Link>
                <ArticleMenu id={a.id} />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
