import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { posts, templates, users } from '@/db/schema';
import { isNull, or } from 'drizzle-orm';
import { getCtx } from '@/lib/ctx';
import { createPost, deletePost, duplicatePost, setPostStatus } from '@/lib/actions';

export default async function PostsPage() {
  const c = (await getCtx())!;
  const rows = await db
    .select({ p: posts, author: users.name, format: templates.name })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.updatedBy))
    .leftJoin(templates, eq(templates.id, posts.templateId))
    .where(eq(posts.brandId, c.brandId))
    .orderBy(desc(posts.updatedAt));

  const formats = await db.select().from(templates).where(or(isNull(templates.brandId), eq(templates.brandId, c.brandId))).orderBy(templates.name);

  return (
    <>
      <div className="page-head">
        <h1>Posts</h1>
        <form action={createPost} className="inline">
          <input name="title" placeholder="Título do novo post" required />
          <select name="templateId" required title="Template (formato do post)">
            {formats.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button className="btn primary">+ Novo post</button>
        </form>
      </div>
      {rows.length === 0 ? (
        <p className="muted">Nenhum post ainda. Crie o primeiro acima.</p>
      ) : (
        <table>
          <thead><tr><th>Título</th><th>Template</th><th>Status</th><th>Slides</th><th>Atualizado</th><th></th></tr></thead>
          <tbody>
            {rows.map(({ p, author, format }) => (
              <tr key={p.id}>
                <td><Link href={`/admin/posts/${p.id}`}><b>{p.title}</b></Link></td>
                <td className="muted">{format ?? '—'}</td>
                <td>
                  <form action={setPostStatus}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="status" value={p.status === 'draft' ? 'published' : 'draft'} />
                    <button className={`pill ${p.status}`} title="Alternar status">{p.status === 'draft' ? 'Rascunho' : 'Publicado'}</button>
                  </form>
                </td>
                <td>{p.data.slides?.length ?? 0}</td>
                <td className="muted">{p.updatedAt.toLocaleString('pt-BR')}{author ? ` · ${author}` : ''}</td>
                <td className="right actions">
                  <form action={duplicatePost}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="btn small">Duplicar</button>
                  </form>
                  <form action={deletePost}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="btn small danger">Excluir</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
