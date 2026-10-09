import Link from 'next/link';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { posts, templates, users } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { createPost, deletePost, duplicatePost, migratePost, renamePost, setPostStatus } from '@/lib/actions';
import { timeAgo } from '@/lib/format';
import { IconCopy, IconEdit, IconMove, IconPlus, IconTrash } from '../../icons';
import { PostPreview } from '../post-preview';
import { TemplateArt } from '../template-art';

export default async function PostsPage({ searchParams }: { searchParams: Promise<{ moved?: string }> }) {
  const { moved } = await searchParams;
  const c = (await getCtx())!;

  // super-admin: lista as outras marcas (organizações do Clerk) para migrar posts
  let destinations: { id: string; name: string }[] = [];
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
              <div className="post-actions">
                <details className="rename-pop">
                  <summary className="btn small ghost" title="Renomear" aria-label="Renomear"><IconEdit /></summary>
                  <form action={renamePost} className="card-surface rename-form">
                    <input type="hidden" name="id" value={p.id} />
                    <input name="title" defaultValue={p.title} maxLength={120} required aria-label="Novo título" />
                    <button className="btn small primary">Salvar</button>
                  </form>
                </details>
                {destinations.length > 0 && (
                  <details className="rename-pop">
                    <summary className="btn small ghost" title="Migrar para outra marca" aria-label="Migrar para outra marca"><IconMove /></summary>
                    <form action={migratePost} className="card-surface rename-form migrate-form">
                      <b>Migrar para outra marca</b>
                      <input type="hidden" name="id" value={p.id} />
                      <select name="destOrgId" required defaultValue="" aria-label="Marca de destino">
                        <option value="" disabled>Escolha a marca…</option>
                        {destinations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                      <label className="mini-check"><input type="checkbox" name="applyIdentity" defaultChecked /> Aplicar nome, @ e foto da marca de destino</label>
                      <small className="muted">O post sai desta marca e chega como rascunho.</small>
                      <button className="btn small primary">Migrar</button>
                    </form>
                  </details>
                )}
                <form action={duplicatePost}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="btn small ghost" title="Duplicar" aria-label="Duplicar"><IconCopy /></button>
                </form>
                <form action={deletePost}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="btn small ghost danger" title="Excluir" aria-label="Excluir"><IconTrash /></button>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
