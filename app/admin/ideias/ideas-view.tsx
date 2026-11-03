'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { actionErrorMessage } from '@/lib/action-error';
import { IDEA_STATUS, territoryOptions, type Idea, type IdeaStatus } from '@/lib/idea';
import { deleteIdea, setIdeaStatus } from '@/lib/idea-actions';
import { PUBLICO_ID, type TNode } from '@/lib/territory';
import { TerritorySelect } from './territory-select';
import { IconBoard, IconEdit, IconGrid, IconPlus, IconPosts, IconSpark, IconTrash, IconVideo } from '../../icons';
import { usePan } from '../use-pan';
import { EmptyState } from '../ui';
import { IdeaBody, ideaText } from './idea-body';
import { IdeaConvertModal, type PostTemplateLite, type VideoFormatLite } from './idea-convert-modal';
import { IdeaDrawer } from './idea-drawer';
import { IdeaModal } from './idea-modal';

import { PersonaOptions, type PersonaOpt } from './persona-options';
type P = PersonaOpt;

export function IdeasView({ ideas, personas, nodes, hasKey, hasAbout, initial, formats, templates }: {
  ideas: Idea[]; personas: P[]; nodes: TNode[]; hasKey: boolean; hasAbout: boolean; formats: VideoFormatLite[]; templates: PostTemplateLite[]; initial: { persona: string; territory: string; generate: boolean };
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const opts = useMemo(() => territoryOptions(nodes), [nodes]);
  const initialTerritory = opts.find((o) => o.id === initial.territory);
  const [persona, setPersona] = useState(initial.persona);
  const [territory, setTerritory] = useState(initialTerritory?.id ?? '');
  const [status, setStatus] = useState<IdeaStatus | ''>('');
  const [q, setQ] = useState('');
  const [ai, setAi] = useState<{ persona: string; territory: string } | null>(initial.generate ? { persona: initial.persona ?? '', territory: initialTerritory?.id ?? '' } : null);
  const [edit, setEdit] = useState<Idea | 'new' | null>(null);
  const [refining, setRefining] = useState(false);
  const [copied, setCopied] = useState('');
  const [convert, setConvert] = useState<{ idea: Idea; mode: 'script' | 'post' } | null>(null);
  const [local, setLocal] = useState<Record<string, IdeaStatus>>({});
  // visão: quadro (colunas = estágios, arrastar e soltar) ou cards; lembra a escolha neste navegador
  const [view, setView] = useState<'board' | 'cards'>('board');
  useEffect(() => { try { const v = localStorage.getItem('ideas_view'); if (v === 'cards' || v === 'board') setView(v); } catch { /* sem storage */ } }, []);
  const chooseView = (v: 'board' | 'cards') => { setView(v); try { localStorage.setItem('ideas_view', v); } catch { /* sem storage */ } };
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<IdeaStatus | null>(null);
  const [err, setErr] = useState('');
  const boardRef = useRef<HTMLDivElement>(null);
  usePan(boardRef, view === 'board');

  const shown = ideas.filter((i) => {
    if (persona && (persona === PUBLICO_ID ? i.personaId !== null : i.personaId !== persona)) return false;
    if (territory && i.territoryId !== territory) return false;
    if (status && (local[i.id] ?? i.status) !== status) return false;
    if (q.trim() && !`${i.pain} ${i.impact} ${i.cause} ${i.guide} ${i.plan} ${i.gain} ${i.desire} ${i.cta} ${i.territory}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
    return true;
  });
  const count = (s: IdeaStatus) => ideas.filter((i) => (local[i.id] ?? i.status) === s).length;

  const changeStatus = (i: Idea, s: IdeaStatus) => {
    const prev = local[i.id] ?? i.status;
    if (prev === s) return;
    setErr(''); setLocal((l) => ({ ...l, [i.id]: s }));
    start(async () => {
      try {
        const r = await setIdeaStatus(i.id, s);
        if (r.error) { setErr(r.error); setLocal((l) => ({ ...l, [i.id]: prev })); } else router.refresh();
      } catch (e) { setErr(actionErrorMessage(e)); setLocal((l) => ({ ...l, [i.id]: prev })); }
    });
  };
  const remove = (i: Idea) => { if (!confirm('Excluir esta ideia?')) return; start(async () => { try { const r = await deleteIdea(i.id); if (r.error) alert(r.error); router.refresh(); } catch (e) { alert(actionErrorMessage(e)); } }); };
  const copy = async (i: Idea) => {
    const t = ideaText(i, i.personaName, i.territory);
    try { await navigator.clipboard.writeText(t); setCopied(i.id); setTimeout(() => setCopied(''), 1600); } catch { /* sem clipboard */ }
  };
  const personaOpts = [...personas, { id: PUBLICO_ID, name: 'Público geral' }];

  return (
    <>
      <div className="id-bar">
        <div className="id-filters">
          <select value={persona} onChange={(e) => setPersona(e.target.value)} aria-label="Filtrar por persona">
            <option value="">Todas as personas</option>
            <PersonaOptions personas={personas} />
          </select>
          <TerritorySelect options={opts} persona="" value={territory} onChange={setTerritory} empty="Todos os territórios" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nas ideias…" aria-label="Buscar" />
        </div>
        <div className="row-actions">
          <div className="view-toggle" role="group" aria-label="Modo de exibição">
            <button type="button" className={view === 'board' ? 'on' : ''} onClick={() => chooseView('board')} aria-pressed={view === 'board'} title="Ver em quadro, por estágio"><IconBoard /> <span>Quadro</span></button>
            <button type="button" className={view === 'cards' ? 'on' : ''} onClick={() => chooseView('cards')} aria-pressed={view === 'cards'} title="Ver em cards"><IconGrid /> <span>Cards</span></button>
          </div>
          <button type="button" className="btn" onClick={() => { setRefining(false); setEdit('new'); }}><IconPlus /> Nova ideia</button>
          <button type="button" className="btn primary" onClick={() => setAi({ persona, territory })}><IconSpark /> Gerar com IA</button>
        </div>
      </div>
      {err && <div className="notice err" style={{ marginBottom: 12 }}>{err}</div>}
      {view === 'cards' && <div className="vd-chips id-status">
        <button type="button" className={`vd-chip${status === '' ? ' on' : ''}`} onClick={() => setStatus('')}>Todas · {ideas.length}</button>
        {IDEA_STATUS.map((s) => <button key={s.id} type="button" className={`vd-chip${status === s.id ? ' on' : ''}`} onClick={() => setStatus(s.id)}>{s.label} · {count(s.id)}</button>)}
      </div>}

      {ideas.length === 0 ? (
        <EmptyState icon={<IconSpark />} title="Nenhuma ideia ainda"
          action={<div className="row-actions"><button type="button" className="btn primary" onClick={() => setAi({ persona, territory })}><IconSpark /> Gerar com IA</button><button type="button" className="btn" onClick={() => { setRefining(false); setEdit('new'); }}><IconPlus /> Nova ideia</button></div>}>
          Escolha uma persona e um território e a IA cria ideias com dor, guia, argumentos e CTA indireta. Você revisa antes de salvar.
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState title="Nada com esses filtros">Tire algum filtro para ver as ideias.</EmptyState>
      ) : view === 'board' ? (
        <>
          <div className="vd-hint muted">Arraste as ideias entre as colunas para mudar o estágio. No celular, use o seletor de cada cartão.</div>
          <div className="vd-board id-board" ref={boardRef}>
            {IDEA_STATUS.map((s) => {
              const col = shown.filter((i) => (local[i.id] ?? i.status) === s.id);
              return (
                <section key={s.id} className={`vd-col${over === s.id && drag ? ' over' : ''}`} aria-label={s.label}
                  onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(s.id); } }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}
                  onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || drag; setDrag(null); setOver(null); const it = ideas.find((x) => x.id === id); if (it) changeStatus(it, s.id); }}>
                  <header><i className="vd-dot" style={{ background: s.color }} /><b>{s.label}</b><span>{col.length}</span></header>
                  <div className="vd-col-body">
                    {col.map((i) => (
                      <article key={i.id} className={`id-kcard${drag === i.id ? ' dragging' : ''}`} draggable tabIndex={0}
                        onDragStart={(e) => { e.dataTransfer.setData('text/plain', i.id); e.dataTransfer.effectAllowed = 'move'; setDrag(i.id); }} onDragEnd={() => { setDrag(null); setOver(null); }}
                        onClick={() => { setRefining(false); setEdit(i); }} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) { setRefining(false); setEdit(i); } }}>
                        <div className="id-tags">
                          <span className="id-tag persona" title="Persona relacionada">{i.personaName || 'Público geral'}</span>
                          {i.territory && <span className="id-tag" title={i.territory}>{i.territory.split(' › ').at(-1)}</span>}
                          {i.source === 'ai' && <span className="id-tag ai">IA</span>}
                        </div>
                        <p className="id-kpain">{i.pain}</p>
                        {i.cta && <p className="id-kcta"><b>CTA</b> {i.cta}</p>}
                        <div className="id-kfoot" onClick={(e) => e.stopPropagation()}>
                          <select className="id-st vd-kmove" value={local[i.id] ?? i.status} onChange={(e) => changeStatus(i, e.target.value as IdeaStatus)} aria-label="Estágio da ideia">
                            {IDEA_STATUS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                          </select>
                          <span className="id-ktools">
                            <button type="button" className="btn small ghost" onClick={() => setConvert({ idea: i, mode: 'script' })} title="Criar roteiro de vídeo" aria-label="Criar roteiro de vídeo"><IconVideo /></button>
                            <button type="button" className="btn small ghost" onClick={() => setConvert({ idea: i, mode: 'post' })} title="Criar post de imagem" aria-label="Criar post de imagem"><IconPosts /></button>
                            <button type="button" className="btn small ghost" onClick={() => { setRefining(true); setEdit(i); }} title="Refinar com IA" aria-label="Refinar com IA"><IconSpark /></button>
                            <button type="button" className="btn small ghost danger" onClick={() => remove(i)} title="Excluir" aria-label="Excluir ideia"><IconTrash /></button>
                          </span>
                        </div>
                      </article>
                    ))}
                    {col.length === 0 && <div className="vd-col-empty">{s.hint}</div>}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      ) : (
        <div className="id-grid">
          {shown.map((i) => {
            const st = local[i.id] ?? i.status;
            return (
              <article key={i.id} className={`id-card st-${st}`}>
                <header>
                  <div className="id-tags">
                    <span className="id-tag persona" title="Persona relacionada">{i.personaName || 'Público geral'}</span>
                    {i.territory && <span className="id-tag" title="Território">{i.territory}</span>}
                    {i.source === 'ai' && <span className="id-tag ai">IA</span>}
                  </div>
                  <select className="id-st" value={st} onChange={(e) => changeStatus(i, e.target.value as IdeaStatus)} aria-label="Status da ideia">
                    {IDEA_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </header>
                <IdeaBody f={i} />
                <div className="id-make">
                  <button type="button" className="btn small primary" onClick={() => setConvert({ idea: i, mode: 'script' })} title="Gera um roteiro de vídeo a partir desta ideia"><IconVideo /> Criar roteiro</button>
                  <button type="button" className="btn small primary" onClick={() => setConvert({ idea: i, mode: 'post' })} title="Gera um post de imagem a partir desta ideia"><IconPosts /> Criar post</button>
                </div>
                <footer>
                  <button type="button" className="btn small ghost" onClick={() => copy(i)}>{copied === i.id ? 'Copiado ✓' : 'Copiar'}</button>
                  <button type="button" className="btn small ghost" onClick={() => { setRefining(true); setEdit(i); }} title="Refinar com IA" aria-label="Refinar ideia com IA"><IconSpark /> Refinar</button>
                  <button type="button" className="btn small" onClick={() => { setRefining(false); setEdit(i); }}><IconEdit /> Editar</button>
                  <button type="button" className="btn small ghost danger" onClick={() => remove(i)} aria-label="Excluir ideia"><IconTrash /></button>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {ai && <IdeaModal personas={personas} options={opts} initialPersona={ai.persona} initialTerritory={ai.territory} hasKey={hasKey} hasAbout={hasAbout} onClose={() => setAi(null)} />}
      {convert && <IdeaConvertModal idea={convert.idea} mode={convert.mode} formats={formats} templates={templates} hasKey={hasKey} onClose={() => setConvert(null)} />}
      {edit && <IdeaDrawer key={`${edit === 'new' ? 'new' : edit.id}${refining ? '-r' : ''}`} startRefine={refining} hasKey={hasKey} idea={edit === 'new' ? null : edit} personas={personas} options={opts} defaults={{ persona, territory }} onClose={() => setEdit(null)} />}
    </>
  );
}
