'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { deleteArticle, duplicateArticle, setArticleStatus } from '@/lib/substack-actions';
import { ARTICLE_STATUS, type ArticleStatus } from '@/lib/substack';
import { actionErrorMessage } from '@/lib/action-error';
import { IconCopy, IconTrash } from '../../icons';

export type ArticleRow = { id: string; title: string; subtitle: string; status: ArticleStatus; words: number; minutes: number; ago: string };
const stOf = (s: ArticleStatus) => ARTICLE_STATUS.find((x) => x.id === s)!;

/** Lista de artigos: mesmo padrão da lista de roteiros (filtro por etapa, busca, tabela e seletor de etapa). */
export function ArticlesView({ rows }: { rows: ArticleRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(rows);
  useEffect(() => setItems(rows), [rows]);
  const [err, setErr] = useState('');
  const [, start] = useTransition();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<ArticleStatus | 'all'>('all');

  const counts = useMemo(() => Object.fromEntries(ARTICLE_STATUS.map((s) => [s.id, items.filter((x) => x.status === s.id).length])) as Record<ArticleStatus, number>, [items]);
  const shown = items.filter((x) => (filter === 'all' || x.status === filter) && (!q.trim() || `${x.title} ${x.subtitle}`.toLowerCase().includes(q.trim().toLowerCase())));

  const move = (id: string, status: ArticleStatus) => {
    const prev = items.find((x) => x.id === id)?.status;
    if (!prev || prev === status) return;
    setErr(''); setItems((a) => a.map((x) => (x.id === id ? { ...x, status } : x)));
    start(async () => {
      try { const r = await setArticleStatus(id, status); if (r.error) throw new Error(r.error); }
      catch (e) { setItems((a) => a.map((x) => (x.id === id ? { ...x, status: prev } : x))); setErr(actionErrorMessage(e)); }
    });
  };
  const duplicate = (id: string) => start(async () => { try { const r = await duplicateArticle(id); if (r.error) setErr(r.error); else router.refresh(); } catch (e) { setErr(actionErrorMessage(e)); } });
  const remove = (id: string, title: string) => {
    if (!confirm(`Excluir o artigo “${title}”? Isso não pode ser desfeito.`)) return;
    start(async () => { try { const r = await deleteArticle(id); if (r.error) setErr(r.error); else { setItems((a) => a.filter((x) => x.id !== id)); router.refresh(); } } catch (e) { setErr(actionErrorMessage(e)); } });
  };

  return (
    <>
      {err && <div className="notice err" style={{ marginBottom: 12 }}>{err}</div>}
      <div className="vd-filters">
        <div className="vd-chips">
          <button type="button" className={`vd-chip${filter === 'all' ? ' on' : ''}`} onClick={() => setFilter('all')}>Todos <b>{items.length}</b></button>
          {ARTICLE_STATUS.map((s) => (
            <button key={s.id} type="button" className={`vd-chip${filter === s.id ? ' on' : ''}`} onClick={() => setFilter(s.id)}><i className="vd-dot" style={{ background: s.color }} />{s.label} <b>{counts[s.id]}</b></button>
          ))}
        </div>
        <input className="vd-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar artigo…" aria-label="Buscar artigo" />
      </div>

      <div className="card-surface vd-list sb-tbl" role="table">
        <div className="vd-row head" role="row"><span>Artigo</span><span>Palavras</span><span>Leitura</span><span>Etapa</span><span>Atualizado</span><span /></div>
        {shown.map((x) => (
          <div key={x.id} className="vd-row" role="row">
            <Link href={`/admin/substack/${x.id}`} className="vd-row-main">
              <b>{x.title}</b>
              {x.subtitle && <small>{x.subtitle.length > 130 ? `${x.subtitle.slice(0, 130)}…` : x.subtitle}</small>}
            </Link>
            <span className="vd-cell" data-l="Palavras">{x.words.toLocaleString('pt-BR')}</span>
            <span className="vd-cell" data-l="Leitura">{x.minutes} min</span>
            <span className="vd-cell">
              <select className="vd-stage-select" value={x.status} onChange={(e) => move(x.id, e.target.value as ArticleStatus)} style={{ '--c': stOf(x.status).color } as React.CSSProperties} aria-label="Etapa">
                {ARTICLE_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </span>
            <span className="vd-cell muted" data-l="Atualizado">{x.ago}</span>
            <span className="vd-actions">
              <button type="button" className="btn small ghost" onClick={() => duplicate(x.id)} title="Duplicar" aria-label="Duplicar artigo"><IconCopy /></button>
              <button type="button" className="btn small ghost danger" onClick={() => remove(x.id, x.title)} title="Excluir" aria-label="Excluir artigo"><IconTrash /></button>
            </span>
          </div>
        ))}
        {shown.length === 0 && <div className="vd-none">Nenhum artigo {filter !== 'all' ? `na etapa “${stOf(filter).label}”` : 'encontrado'}.</div>}
      </div>
    </>
  );
}
