import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { generationBatches, generationItems, posts, templates } from '@/db/schema';
import { getCtx } from '@/lib/ctx';
import { costUsd, fmtUsd } from '@/lib/ai/constants';
import { deleteBatch, regenerateItem, retryFailed } from '@/lib/actions';
import { IconBack, IconTrash } from '../../../icons';
import { PostPreview } from '../../post-preview';
import { AutoRefresh } from './auto-refresh';

const LABEL = { queued: 'Na fila', running: 'Gerando…', done: 'Pronto', error: 'Erro' } as const;

export default async function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = (await getCtx())!;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [batch] = await db.select().from(generationBatches).where(and(eq(generationBatches.id, id), eq(generationBatches.brandId, c.brandId)));
  if (!batch) notFound();
  const [tpl] = batch.templateId ? await db.select().from(templates).where(eq(templates.id, batch.templateId)) : [];

  const items = await db
    .select({
      it: generationItems,
      theme: sql<Record<string, string> | null>`${posts.data}->'g'->'theme'`,
      colors: sql<Record<string, string> | null>`${posts.data}->'g'->'colors'`,
      text: sql<string | null>`coalesce(left(${posts.data}->'slides'->0->>'html', 900), left(${posts.data}->'slides'->0->>'text', 400))`,
      title: posts.title,
      slides: sql<number>`case when jsonb_typeof(${posts.data}->'slides') = 'array' then jsonb_array_length(${posts.data}->'slides') else 0 end`,
    })
    .from(generationItems)
    .leftJoin(posts, eq(posts.id, generationItems.postId))
    .where(eq(generationItems.batchId, id))
    .orderBy(asc(generationItems.createdAt), asc(generationItems.id));

  const done = items.filter((x) => x.it.status === 'done').length;
  const failed = items.filter((x) => x.it.status === 'error').length;
  const pending = items.some((x) => x.it.status === 'queued' || x.it.status === 'running');
  const cost = costUsd(items.reduce((a, x) => a + x.it.inputTokens, 0), items.reduce((a, x) => a + x.it.outputTokens, 0));
  const pct = items.length ? Math.round(((done + failed) / items.length) * 100) : 0;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link href="/admin/gerar" className="back"><IconBack /> Gerar com IA</Link>
          <h1 style={{ marginTop: 6 }}>{batch.mode === 'roteiro' ? 'Roteiros' : 'Temas'} · {tpl?.name ?? 'Lote'}</h1>
          <p>{done} de {items.length} prontos · custo {fmtUsd(cost)} <AutoRefresh batchId={id} active={pending} /></p>
        </div>
        <div className="row-actions">
          {failed > 0 && !pending && (
            <form action={retryFailed}><input type="hidden" name="batchId" value={id} /><button className="btn">Repetir {failed} com erro</button></form>
          )}
          <form action={deleteBatch}><input type="hidden" name="id" value={id} /><button className="btn ghost danger" title="Remove o lote do histórico (os posts ficam em Posts)"><IconTrash /> Excluir lote</button></form>
        </div>
      </div>

      <div className="progress" aria-label={`${pct}% concluído`}><span style={{ width: `${pct}%` }} /></div>

      <div className="gen-items">
        {items.map(({ it, theme, colors, text, title, slides }) => (
          <article className={`card-surface gen-item ${it.status}`} key={it.id}>
            <div className="gen-thumb">
              {it.status === 'done' && it.postId
                ? <Link href={`/admin/posts/${it.postId}`} aria-label="Abrir post"><PostPreview editor={tpl?.editor ?? 'carrossel'} theme={theme} colors={colors} text={text} /></Link>
                : <div className={`gen-wait ${it.status}`}>{it.status === 'error' ? '!' : <div className="spinner" />}</div>}
            </div>
            <div className="gen-body">
              <div className="gen-top">
                <span className={`pill st-${it.status}`}>{LABEL[it.status]}{it.status === 'queued' && it.attempts > 0 ? ' (nova tentativa)' : ''}</span>
                {it.status === 'done' && <span className="muted">{slides} slides · {fmtUsd(costUsd(it.inputTokens, it.outputTokens))}</span>}
              </div>
              {it.status === 'done' && title ? <b className="gen-title">{title}</b> : null}
              <p className="gen-brief">{it.brief}</p>
              {it.status === 'error' && <p className="gen-err">{it.error}</p>}
              {it.notes && it.notes.length > 0 && (
                <ul className="gen-notes">{it.notes.map((n, i) => <li key={i} className={n.startsWith('Conferir') ? 'check' : ''}>{n}</li>)}</ul>
              )}
              <div className="gen-actions">
                {it.status === 'done' && it.postId && <Link href={`/admin/posts/${it.postId}`} className="btn small primary">Abrir no editor</Link>}
                {(it.status === 'done' || it.status === 'error') && (
                  <form action={regenerateItem}><input type="hidden" name="id" value={it.id} /><button className="btn small">Gerar de novo</button></form>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
