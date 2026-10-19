'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { setScriptStatus } from '@/lib/video-actions';
import { PLATFORMS, STAGES, fmtSecs, stageOf, type Stage } from '@/lib/video';
import { IconGrid, IconList } from '../../icons';
import { PartsBar } from './parts-bar';

export type VideoRow = { id: string; title: string; hook: string; formatName: string; seconds: number; platform: string; status: Stage; ago: string; parts: { name: string; seconds: number }[] };
export type VideosMode = 'lista' | 'kanban';

const platformLabel = (p: string) => PLATFORMS.find((x) => x.id === p)?.label ?? 'Reels';

/** Alterna entre lista e kanban e lembra a escolha (cookie). */
export function ModeToggle({ mode }: { mode: VideosMode }) {
  const router = useRouter();
  const set = (m: VideosMode) => {
    if (m === mode) return;
    document.cookie = `videos_view=${m}; path=/; max-age=31536000; samesite=lax`;
    router.replace(`/admin/videos?v=${m}`); router.refresh();
  };
  return (
    <div className="view-toggle" role="group" aria-label="Modo de exibição">
      <button type="button" className={mode === 'lista' ? 'on' : ''} onClick={() => set('lista')} aria-pressed={mode === 'lista'}><IconList /> <span>Lista</span></button>
      <button type="button" className={mode === 'kanban' ? 'on' : ''} onClick={() => set('kanban')} aria-pressed={mode === 'kanban'}><IconGrid /> <span>Kanban</span></button>
    </div>
  );
}

function StageSelect({ value, onChange }: { value: Stage; onChange: (s: Stage) => void }) {
  return (
    <select className="vd-stage-select" value={value} onChange={(e) => onChange(e.target.value as Stage)} style={{ '--c': stageOf(value).color } as React.CSSProperties} aria-label="Etapa" onClick={(e) => e.stopPropagation()}>
      {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
    </select>
  );
}

export function VideosView({ rows, mode }: { rows: VideoRow[]; mode: VideosMode }) {
  const [items, setItems] = useState(rows);
  const [err, setErr] = useState('');
  const [, start] = useTransition();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Stage | 'all'>('all');
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);

  const move = (id: string, status: Stage) => {
    const prev = items.find((x) => x.id === id)?.status;
    if (!prev || prev === status) return;
    setErr(''); setItems((a) => a.map((x) => (x.id === id ? { ...x, status } : x)));
    start(async () => {
      const r = await setScriptStatus(id, status);
      if (r.error) { setErr(r.error); setItems((a) => a.map((x) => (x.id === id ? { ...x, status: prev } : x))); }
    });
  };
  const counts = useMemo(() => Object.fromEntries(STAGES.map((s) => [s.id, items.filter((x) => x.status === s.id).length])) as Record<Stage, number>, [items]);
  const shown = items.filter((x) => (filter === 'all' || x.status === filter) && (!q.trim() || `${x.title} ${x.hook}`.toLowerCase().includes(q.trim().toLowerCase())));

  return (
    <>
      {err && <div className="notice err" style={{ marginBottom: 12 }}>{err}</div>}

      {mode === 'lista' ? (
        <>
          <div className="vd-filters">
            <div className="vd-chips">
              <button type="button" className={`vd-chip${filter === 'all' ? ' on' : ''}`} onClick={() => setFilter('all')}>Todos <b>{items.length}</b></button>
              {STAGES.map((s) => (
                <button key={s.id} type="button" className={`vd-chip${filter === s.id ? ' on' : ''}`} onClick={() => setFilter(s.id)}><i className="vd-dot" style={{ background: s.color }} />{s.label} <b>{counts[s.id]}</b></button>
              ))}
            </div>
            <input className="vd-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar roteiro…" aria-label="Buscar roteiro" />
          </div>

          <div className="card-surface vd-list" role="table">
            <div className="vd-row head" role="row"><span>Roteiro</span><span>Formato</span><span>Duração</span><span>Plataforma</span><span>Etapa</span><span>Atualizado</span></div>
            {shown.map((x) => (
              <div key={x.id} className="vd-row" role="row">
                <Link href={`/admin/videos/${x.id}`} className="vd-row-main">
                  <b>{x.title}</b>
                  {x.hook && <small>“{x.hook.length > 130 ? `${x.hook.slice(0, 130)}…` : x.hook}”</small>}
                </Link>
                <span className="vd-cell" data-l="Formato">{x.formatName || '—'}</span>
                <span className="vd-cell" data-l="Duração">{fmtSecs(x.seconds)}</span>
                <span className="vd-cell" data-l="Plataforma">{platformLabel(x.platform)}</span>
                <span className="vd-cell"><StageSelect value={x.status} onChange={(s) => move(x.id, s)} /></span>
                <span className="vd-cell muted" data-l="Atualizado">{x.ago}</span>
              </div>
            ))}
            {shown.length === 0 && <div className="vd-none">Nenhum roteiro {filter !== 'all' ? `na etapa “${stageOf(filter).label}”` : 'encontrado'}.</div>}
          </div>
        </>
      ) : (
        <>
          <div className="vd-hint muted">Arraste os cartões entre as colunas para mudar a etapa. No celular, use o seletor de cada cartão.</div>
          <div className="vd-board">
            {STAGES.map((s) => {
              const col = items.filter((x) => x.status === s.id);
              return (
                <section
                  key={s.id} className={`vd-col${over === s.id && drag ? ' over' : ''}`} aria-label={s.label}
                  onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(s.id); } }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}
                  onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || drag; setDrag(null); setOver(null); if (id) move(id, s.id); }}
                >
                  <header><i className="vd-dot" style={{ background: s.color }} /><b>{s.label}</b><span>{col.length}</span></header>
                  <div className="vd-col-body">
                    {col.map((x) => (
                      <article key={x.id} className={`vd-kcard${drag === x.id ? ' dragging' : ''}`} draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', x.id); e.dataTransfer.effectAllowed = 'move'; setDrag(x.id); }} onDragEnd={() => { setDrag(null); setOver(null); }}>
                        <Link href={`/admin/videos/${x.id}`} draggable={false}><b>{x.title}</b></Link>
                        {x.hook && <p>“{x.hook.length > 90 ? `${x.hook.slice(0, 90)}…` : x.hook}”</p>}
                        <PartsBar parts={x.parts} small />
                        <div className="vd-kmeta"><span>{fmtSecs(x.seconds)}</span><i>·</i><span>{platformLabel(x.platform)}</span><i>·</i><span>{x.ago}</span></div>
                        <div className="vd-kmove"><StageSelect value={x.status} onChange={(st) => move(x.id, st)} /></div>
                      </article>
                    ))}
                    {col.length === 0 && <div className="vd-col-empty">Solte um roteiro aqui</div>}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
