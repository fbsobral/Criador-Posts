import Link from 'next/link';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { posts, templates, users } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { createPost, setPostStatus } from '@/lib/actions';
import { timeAgo } from '@/lib/format';
import { IconPlus } from '../../icons';
import { PostPreview } from '../post-preview';
import { TemplateArt } from '../template-art';
import { PostActions, type Destination } from './post-actions';
import { ViewToggle, type PostsView } from './view-toggle';

export default async function PostsPage({ searchParams }: { searchParams: Promise<{ moved?: string; v?: string }> }) {
  const { moved, v } = await searchParams;
  const saved = (await cookies()).get('posts_view')?.value;
  const view: PostsView = (v ?? saved) === 'lista' ? 'lista' : 'cards';
  const c = (await getCtx())!;

  // super-admin: lista as outras marcas (organizações do Clerk) para migrar posts
  let destinations: Destination[] = [];
  if (c.isPlatformAdmin) {
    const { orgId } = await auth();
    const orgs = await (await clerkClient()).organizations.getOrganizationList({ limit: 100, orderBy: 'name' });
    destinations = orgs.data.filter((o) => o.id !== orgId).map((o) => ({ id: o.id, name: o.name }));
  }
  const rows = await db
    .select({
      p: { id: posts.id, title: posts.title, status: posts.status, updatedAt: posts.updatedAt },
      slides: sql<number>`case when jsonb_typeof(${posts.data}->'slides') = 'array' then jsonb_array_length(${posts.data}->'slides') else 0 end`,
      theme: sql<Record<string, string> | null>`${posts.data}->'g'->'theme'`,
      colors: sql<Record<string, string> | null>`${posts.data}->'g'->'colors'`,
      text: sql<string | null>`coalesce(left(${posts.data}->'slides'->0->>'html', 900), left(${posts.data}->'slides'->0->>'text', 400))`,
      author: users.name,
      format: templates.name,
      editor: templates.editor,
    })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.updatedBy))
    .leftJoin(templates, eq(templates.id, posts.templateId))
    .where(eq(posts.brandId, c.brandId))
    .orderBy(desc(posts.updatedAt));

  const formats = await db.select().from(templates).where(or(isNull(templates.brandId), eq(templates.brandId, c.brandId))).orderBy(templates.name);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Posts</h1>
          <p>{rows.length === 0 ? 'Crie o primeiro post da marca.' : `${rows.length} ${rows.length === 1 ? 'post' : 'posts'} em ${c.brandName}.`}</p>
        </div>
        {rows.length > 0 && <ViewToggle view={view} />}
      </div>

      {moved && <div className="notice ok" style={{ marginBottom: 20 }} role="status">Post migrado para <b>{moved}</b>. Ele chegou lá como rascunho.</div>}

      <form action={createPost} className="card-surface new-post">
        <h2>Novo post</h2>
        <p className="muted">Escolha o formato e dê um nome. Você edita o conteúdo no passo seguinte.</p>
        <div className="tpl-opts" style={{ marginTop: 14 }}>
          {formats.map((t, i) => (
            <label className="tpl-opt" key={t.id}>
              <input type="radio" name="templateId" value={t.id} defaultChecked={i === 0} required />
              <TemplateArt editor={t.editor} className="art" />
              <span><b>{t.name}</b><small>{t.description || 'Formato de post'}</small></span>
            </label>
          ))}
        </div>
        <div className="row1" style={{ margin: 0, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input name="title" placeholder="Título do post (ex.: 5 erros ao financiar um imóvel)" required style={{ flex: 1, minWidth: 220 }} />
          <button className="btn primary"><IconPlus /> Criar post</button>
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="empty"><b>Nenhum post ainda</b>Use o formulário acima para criar o primeiro.</div>
      ) : view === 'lista' ? (
        <div className="card-surface table-card list-posts">
          <table>
            <thead><tr><th>Post</th><th className="hide-s">Formato</th><th>Status</th><th className="hide-s">Slides</th><th className="hide-s">Atualizado</th><th className="right"></th></tr></thead>
            <tbody>
              {rows.map(({ p, slides, theme, colors, author, format, editor }) => {
                const bg = (editor === 'tweet' ? colors?.bg : theme?.bg) ?? '#EDEAE5';
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/posts/${p.id}`} className="list-title">
                        <span className="chip" style={{ background: bg }} aria-hidden />
                        <span className="t">{p.title}</span>
                      </Link>
                    </td>
                    <td className="hide-s muted">{format ?? 'Carrossel'}</td>
                    <td>
                      <form action={setPostStatus}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="status" value={p.status === 'draft' ? 'published' : 'draft'} />
                        <button className={`pill ${p.status}`} title="Clique para alternar entre rascunho e publicado">{p.status === 'draft' ? 'Rascunho' : 'Publicado'}</button>
                      </form>
                    </td>
                    <td className="hide-s muted">{slides || 1}</td>
                    <td className="hide-s muted">{timeAgo(p.updatedAt)}{author ? ` · ${author}` : ''}</td>
                    <td className="right"><div className="post-actions in-list"><PostActions id={p.id} title={p.title} destinations={destinations} editor={editor ?? 'carrossel'} slides={slides} /></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid-posts">
          {rows.map(({ p, slides, theme, colors, text, author, format, editor }) => (
            <article className="card-surface post-card" key={p.id}>
              <Link href={`/admin/posts/${p.id}`} className="post-thumb" aria-label={`Abrir ${p.title}`}>
                <span className="badge">{slides || 1} {slides === 1 || !slides ? 'slide' : 'slides'}</span>
                <PostPreview editor={editor ?? 'carrossel'} theme={theme} colors={colors} text={text} />
              </Link>
              <div className="post-body">
                <Link href={`/admin/posts/${p.id}`} className="post-title">{p.title}</Link>
                <div className="post-meta">
                  <span>{format ?? 'Carrossel'}</span><span>·</span><span>{timeAgo(p.updatedAt)}</span>
                  {author && <><span>·</span><span>{author}</span></>}
                </div>
                <form action={setPostStatus} className="status-form">
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="status" value={p.status === 'draft' ? 'published' : 'draft'} />
                  <button className={`pill ${p.status}`} title="Clique para alternar entre rascunho e publicado">{p.status === 'draft' ? 'Rascunho' : 'Publicado'}</button>
                </form>
              </div>
              <div className="post-actions"><PostActions id={p.id} title={p.title} destinations={destinations} editor={editor ?? 'carrossel'} slides={slides} /></div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
