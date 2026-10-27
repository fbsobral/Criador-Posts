'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { IDEA_STATUS, territoryOptions, type Idea, type IdeaStatus } from '@/lib/idea';
import { deleteIdea, setIdeaStatus } from '@/lib/idea-actions';
import { PUBLICO_ID, type TNode } from '@/lib/territory';
import { IconEdit, IconPlus, IconPosts, IconSpark, IconTrash, IconVideo } from '../../icons';
import { EmptyState } from '../ui';
import { IdeaBody, ideaText } from './idea-body';
import { IdeaConvertModal, type PostTemplateLite, type VideoFormatLite } from './idea-convert-modal';
import { IdeaDrawer } from './idea-drawer';
import { IdeaModal } from './idea-modal';

type P = { id: string; name: string };

export function IdeasView({ ideas, personas, nodes, hasKey, hasAbout, initial, formats, templates }: {
  ideas: Idea[]; personas: P[]; nodes: TNode[]; hasKey: boolean; hasAbout: boolean; formats: VideoFormatLite[]; templates: PostTemplateLite[]; initial: { persona: string; territory: string; generate: boolean };
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const opts = useMemo(() => territoryOptions(nodes), [nodes]);
  const initialTerritory = opts.find((o) => o.id === initial.territory);
  const [persona, setPersona] = useState(initialTerritory?.personaId ?? initial.persona);
  const [territory, setTerritory] = useState(initialTerritory?.id ?? '');
  const [status, setStatus] = useState<IdeaStatus | ''>('');
  const [q, setQ] = useState('');
  const [ai, setAi] = useState<{ persona: string; territory: string } | null>(initial.generate ? { persona: initialTerritory?.personaId ?? initial.persona ?? '', territory: initialTerritory?.id ?? '' } : null);
  const [edit, setEdit] = useState<Idea | 'new' | null>(null);
  const [copied, setCopied] = useState('');
  const [convert, setConvert] = useState<{ idea: Idea; mode: 'script' | 'post' } | null>(null);
  const [local, setLocal] = useState<Record<string, IdeaStatus>>({});

  const shown = ideas.filter((i) => {
    if (persona && (persona === PUBLICO_ID ? i.personaId !== null : i.personaId !== persona)) return false;
    if (territory && i.territoryId !== territory) return false;
    if (status && (local[i.id] ?? i.status) !== status) return false;
    if (q.trim() && !`${i.pain} ${i.impact} ${i.cause} ${i.guide} ${i.plan} ${i.gain} ${i.desire} ${i.cta} ${i.territory}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
    return true;
  });
  const count = (s: IdeaStatus) => ideas.filter((i) => (local[i.id] ?? i.status) === s).length;

  const changeStatus = (i: Idea, s: IdeaStatus) => { setLocal((l) => ({ ...l, [i.id]: s })); start(async () => { await setIdeaStatus(i.id, s); router.refresh(); }); };
  const remove = (i: Idea) => { if (!confirm('Excluir esta ideia?')) return; start(async () => { await deleteIdea(i.id); router.refresh(); }); };
  const copy = async (i: Idea) => {
    const t = ideaText(i, i.personaName, i.territory);
    try { await navigator.clipboard.writeText(t); setCopied(i.id); setTimeout(() => setCopied(''), 1600); } catch { /* sem clipboard */ }
  };
  const personaOpts = [...personas, { id: PUBLICO_ID, name: 'Público geral' }];
  const terrOpts = opts.filter((o) => !persona || o.personaId === persona);

  return (
    <>
      <div className="id-bar">
        <div className="id-filters">
          <select value={persona} onChange={(e) => { setPersona(e.target.value); setTerritory(''); }} aria-label="Filtrar por persona">
            <option value="">Todas as personas</option>
            {personaOpts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={territory} onChange={(e) => setTerritory(e.target.value)} aria-label="Filtrar por território">
            <option value="">Todos os territórios</option>
            {terrOpts.map((o) => <option key={o.id} value={o.id}>{'  '.repeat(o.depth)}{o.label}</option>)}
          </select>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nas ideias…" aria-label="Buscar" />
        </div>
        <div className="row-actions">
          <button type="button" className="btn" onClick={() => setEdit('new')}><IconPlus /> Nova ideia</button>
          <button type="button" className="btn primary" onClick={() => setAi({ persona, territory })}><IconSpark /> Gerar com IA</button>
        </div>
      </div>
      <div className="vd-chips id-status">
        <button type="button" className={`vd-chip${status === '' ? ' on' : ''}`} onClick={() => setStatus('')}>Todas · {ideas.length}</button>
        {IDEA_STATUS.map((s) => <button key={s.id} type="button" className={`vd-chip${status === s.id ? ' on' : ''}`} onClick={() => setStatus(s.id)}>{s.label} · {count(s.id)}</button>)}
      </div>

      {ideas.length === 0 ? (
        <EmptyState icon={<IconSpark />} title="Nenhuma ideia ainda"
          action={<div className="row-actions"><button type="button" className="btn primary" onClick={() => setAi({ persona, territory })}><IconSpark /> Gerar com IA</button><button type="button" className="btn" onClick={() => setEdit('new')}><IconPlus /> Nova ideia</button></div>}>
          Escolha uma persona e um território e a IA cria ideias com dor, guia, argumentos e CTA indireta. Você revisa antes de salvar.
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState title="Nada com esses filtros">Tire algum filtro para ver as ideias.</EmptyState>
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
                  <button type="button" className="btn small" onClick={() => setEdit(i)}><IconEdit /> Editar</button>
                  <button type="button" className="btn small ghost danger" onClick={() => remove(i)} aria-label="Excluir ideia"><IconTrash /></button>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {ai && <IdeaModal personas={personas} options={opts} initialPersona={ai.persona} initialTerritory={ai.territory} hasKey={hasKey} hasAbout={hasAbout} onClose={() => setAi(null)} />}
      {convert && <IdeaConvertModal idea={convert.idea} mode={convert.mode} formats={formats} templates={templates} hasKey={hasKey} onClose={() => setConvert(null)} />}
      {edit && <IdeaDrawer idea={edit === 'new' ? null : edit} personas={personas} options={opts} defaults={{ persona, territory }} onClose={() => setEdit(null)} />}
    </>
  );
}
