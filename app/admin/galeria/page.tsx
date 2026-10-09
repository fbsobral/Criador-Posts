import Link from 'next/link';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { assets } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { ASSET_THUMB_URL, ASSET_URL, searchAssets } from '@/lib/assets';
import { importPostImages } from '@/lib/actions';
import { timeAgo } from '@/lib/format';
import { DeleteAsset, UploadButton } from './gallery-actions';

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ q?: string; imported?: string; posts?: string }> }) {
  const { q = '', imported, posts: postsChanged } = await searchParams;
  const c = (await getCtx())!;
  const [{ total, ai }] = await db
    .select({ total: sql<number>`count(*)::int`, ai: sql<number>`count(*) filter (where ${assets.kind} = 'ai')::int` })
    .from(assets).where(and(eq(assets.brandId, c.brandId), sql`${assets.kind} <> 'avatar'`));
  const hits = await searchAssets(c.brandId, q.slice(0, 200), 60);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Galeria</h1>
          <p>{total === 0 ? 'As imagens da marca ficam aqui, para reaproveitar em outros posts.' : `${total} ${total === 1 ? 'imagem' : 'imagens'} em ${c.brandName} (${ai} geradas com IA).`}</p>
        </div>
        <div className="row-actions"><UploadButton /></div>
      </div>

      {imported !== undefined && (
        <div className="notice ok" style={{ marginBottom: 18 }} role="status">
          {Number(imported) > 0 ? <><b>{imported}</b> {Number(imported) === 1 ? 'imagem' : 'imagens'} de <b>{postsChanged}</b> {Number(postsChanged) === 1 ? 'post' : 'posts'} {Number(imported) === 1 ? 'foi movida' : 'foram movidas'} para a galeria.</> : 'Nenhuma imagem embutida nos posts para importar.'}
        </div>
      )}

      <form className="gal-bar" action="/admin/galeria">
        <input type="search" name="q" defaultValue={q} placeholder="Buscar por palavras (ex.: mesa, juros, dinheiro)" aria-label="Buscar imagens" />
        <button className="btn">Buscar</button>
        {q && <Link href="/admin/galeria" className="btn ghost">Limpar</Link>}
      </form>
      {c.isBrandAdmin && (
        <form action={importPostImages} className="gal-import">
          <button className="btn ghost small" title="Move as imagens que estão dentro dos posts para a galeria (deixa os posts mais leves)">Importar imagens dos posts para a galeria</button>
        </form>
      )}

      {hits.length === 0 ? (
        <div className="empty"><b>{q ? 'Nenhuma imagem encontrada' : 'Galeria vazia'}</b>{q ? 'Tente outras palavras.' : 'Envie imagens ou gere com IA dentro de um post: elas aparecem aqui automaticamente.'}</div>
      ) : (
        <div className="gal-page-grid">
          {hits.map((h) => (
            <article className="card-surface gal-card-item" key={h.id}>
              <a href={ASSET_URL(h.id)} target="_blank" rel="noreferrer" className="gal-thumb" aria-label="Abrir imagem">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ASSET_THUMB_URL(h.id)} alt={h.description || 'Imagem da galeria'} loading="lazy" />
                {h.kind === 'ai' && <span className="badge">IA</span>}
              </a>
              <div className="gal-body">
                <p className="gal-desc">{h.description || 'Sem descrição'}</p>
                {h.tags && <div className="gal-tags">{h.tags.split(' ').slice(0, 4).map((t) => <span key={t}>{t}</span>)}</div>}
                <div className="gal-meta">
                  <span className="muted">{h.usageCount > 0 ? `usada ${h.usageCount}×` : 'nunca usada'}{h.createdAt ? ` · ${timeAgo(new Date(h.createdAt))}` : ''}</span>
                  <DeleteAsset id={h.id} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
