'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { createGroup, deleteGroup, deletePersona, deletePersonas, movePersona, movePersonas, updateGroup } from '@/lib/persona-actions';
import { actionErrorMessage } from '@/lib/action-error';
import { GROUP_COLORS } from '@/lib/persona';
import { IconEdit, IconPlus, IconSpark, IconTrash } from '../../icons';
import { EmptyState, PageHead } from '../ui';
import { usePan } from '../use-pan';
import { PersonaDrawer, type GroupRow, type PersonaRow } from './persona-drawer';
import { SuggestModal } from './suggest-modal';

const NONE = 'none';
const initialsOf = (n: string) => n.replace(/,.*/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

export function PersonaBoard({ groups: g0, people: p0, icp, hasKey }: { groups: GroupRow[]; people: PersonaRow[]; icp: string; hasKey: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [groups, setGroups] = useState(g0);
  const [people, setPeople] = useState(p0);
  useEffect(() => setGroups(g0), [g0]);
  useEffect(() => setPeople(p0), [p0]);
  const [drawer, setDrawer] = useState<{ persona: PersonaRow | null; groupId: string | null; refine?: boolean } | null>(null);
  const [suggest, setSuggest] = useState(false);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [gName, setGName] = useState(''); const [gDesc, setGDesc] = useState('');
  const [adding, setAdding] = useState(false); const [newName, setNewName] = useState('');
  const [err, setErr] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  useEffect(() => setSel((s) => new Set([...s].filter((id) => p0.some((p) => p.id === id)))), [p0]);

  const ungrouped = people.filter((p) => !p.groupId);
  const cols = [...groups.map((g, i) => ({ id: g.id, name: g.name, description: g.description, color: GROUP_COLORS[i % GROUP_COLORS.length], real: true })),
    ...(ungrouped.length ? [{ id: NONE, name: 'Sem grupo', description: 'Personas fora de qualquer grupo.', color: '#8A857A', real: false }] : [])];
  const colorOf = (gid: string | null) => cols.find((c) => c.id === (gid ?? NONE))?.color ?? '#8A857A';

  const move = (id: string, to: string) => {
    const target = to === NONE ? null : to;
    const cur = people.find((p) => p.id === id); if (!cur || cur.groupId === target) return;
    const prev = people; setErr('');
    setPeople((a) => a.map((p) => (p.id === id ? { ...p, groupId: target } : p)));
    start(async () => { try { const r = await movePersona(id, target); if (r.error) { setErr(r.error); setPeople(prev); } else router.refresh(); } catch (e) { setErr(actionErrorMessage(e)); setPeople(prev); } });
  };
  const remove = (p: PersonaRow) => {
    if (!confirm(`Excluir a persona “${p.name}”?`)) return;
    const prev = people; setPeople((a) => a.filter((x) => x.id !== p.id));
    start(async () => { try { const r = await deletePersona(p.id); if (r.error) { setErr(r.error); setPeople(prev); } else router.refresh(); } catch (e) { setErr(actionErrorMessage(e)); setPeople(prev); } });
  };
  const toggleSel = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const setMany = (ids: string[], on: boolean) => setSel((s) => { const n = new Set(s); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  const bulkMove = (to: string) => {
    const ids = [...sel], target = to === NONE ? null : to; if (!ids.length) return;
    const prev = people; setErr('');
    setPeople((a) => a.map((p) => (sel.has(p.id) ? { ...p, groupId: target } : p)));
    start(async () => { try { const r = await movePersonas(ids, target); if (r.error) { setErr(r.error); setPeople(prev); } else { setSel(new Set()); router.refresh(); } } catch (e) { setErr(actionErrorMessage(e)); setPeople(prev); } });
  };
  const bulkRemove = () => {
    const ids = [...sel]; if (!ids.length) return;
    if (!confirm(`Excluir ${ids.length} ${ids.length === 1 ? 'persona' : 'personas'}? Os territórios delas também serão excluídos. Isso não pode ser desfeito.`)) return;
    const prev = people; setPeople((a) => a.filter((p) => !sel.has(p.id)));
    start(async () => { try { const r = await deletePersonas(ids); if (r.error) { setErr(r.error); setPeople(prev); } else { setSel(new Set()); router.refresh(); } } catch (e) { setErr(actionErrorMessage(e)); setPeople(prev); } });
  };
  const startRename = (g: { id: string; name: string; description: string }) => { setEditing(g.id); setGName(g.name); setGDesc(g.description); };
  const saveRename = (id: string) => {
    if (!gName.trim()) { setEditing(null); return; }
    setGroups((a) => a.map((g) => (g.id === id ? { ...g, name: gName.trim(), description: gDesc.trim() } : g))); setEditing(null);
    start(async () => { const r = await updateGroup(id, { name: gName, description: gDesc }); if (r.error) setErr(r.error); else router.refresh(); });
  };
  const removeGroup = (id: string, name: string) => {
    const n = people.filter((p) => p.groupId === id).length;
    if (!confirm(`Excluir o grupo “${name}”?${n ? ` As ${n} personas dele não serão apagadas: vão para “Sem grupo”.` : ''}`)) return;
    setGroups((a) => a.filter((g) => g.id !== id)); setPeople((a) => a.map((p) => (p.groupId === id ? { ...p, groupId: null } : p)));
    start(async () => { try { await deleteGroup(id); router.refresh(); } catch (e) { setErr(actionErrorMessage(e)); setGroups(g0); setPeople(p0); } });
  };
  const addGroup = () => {
    if (!newName.trim()) { setAdding(false); return; }
    const name = newName; setNewName(''); setAdding(false);
    start(async () => { const r = await createGroup(name); if (r.error) setErr(r.error); else router.refresh(); });
  };

  const empty = groups.length === 0 && people.length === 0;
  const boardRef = useRef<HTMLDivElement>(null);
  usePan(boardRef, !empty || adding);
  return (
    <div className="page">
      <PageHead
        title="Personas"
        description={empty ? 'Quem você quer alcançar. Descreva o seu ICP e a IA sugere personas agrupadas por segmento.' : `${people.length} ${people.length === 1 ? 'persona' : 'personas'} em ${groups.length} ${groups.length === 1 ? 'grupo' : 'grupos'}. Arraste os cartões entre os grupos.`}
        actions={<>
          <button type="button" className="btn" onClick={() => setAdding(true)}><IconPlus /> Novo grupo</button>
          <button type="button" className="btn primary" onClick={() => setSuggest(true)}><IconSpark /> Sugerir com IA</button>
        </>}
      />

      {icp && !empty && (
        <div className="card-surface pe-icp">
          <div><b>Seu ICP</b> <small className="muted">· o mesmo "Público ideal" das Configurações</small><p>{icp.length > 260 ? `${icp.slice(0, 260)}…` : icp}</p></div>
          <button type="button" className="btn small" onClick={() => setSuggest(true)}>Editar e gerar mais</button>
        </div>
      )}
      {err && <div className="notice err" style={{ marginBottom: 12 }}>{err}</div>}

      {empty && !adding ? (
        <EmptyState icon={<IconSpark />} title="Nenhuma persona ainda"
          action={<><button type="button" className="btn primary" onClick={() => setSuggest(true)}><IconSpark /> Descrever meu ICP e gerar personas</button><button type="button" className="btn" onClick={() => setDrawer({ persona: null, groupId: null })}>Criar uma persona manualmente</button></>}>
          Conte quem é o seu cliente ideal e a IA cria personas realistas, já organizadas em grupos. Você revisa antes de entrarem no quadro.
        </EmptyState>
      ) : (
        <div className="pe-board" ref={boardRef}>
          {cols.map((c) => {
            const col = people.filter((p) => (p.groupId ?? NONE) === c.id);
            return (
              <section key={c.id} className={`pe-col${over === c.id && drag ? ' over' : ''}`} aria-label={c.name}
                onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(c.id); } }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}
                onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || drag; setDrag(null); setOver(null); if (id) { if (sel.has(id) && sel.size > 1) bulkMove(c.id); else move(id, c.id); } }}>
                {editing === c.id ? (
                  <div className="pe-col-edit">
                    <input value={gName} onChange={(e) => setGName(e.target.value)} maxLength={60} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') saveRename(c.id); if (e.key === 'Escape') setEditing(null); }} aria-label="Nome do grupo" />
                    <input value={gDesc} onChange={(e) => setGDesc(e.target.value)} maxLength={200} placeholder="Descrição (opcional)" onKeyDown={(e) => { if (e.key === 'Enter') saveRename(c.id); if (e.key === 'Escape') setEditing(null); }} aria-label="Descrição do grupo" />
                    <div className="row-actions"><button type="button" className="btn small primary" onClick={() => saveRename(c.id)}>Salvar</button><button type="button" className="btn small" onClick={() => setEditing(null)}>Cancelar</button></div>
                  </div>
                ) : (
                  <header>
                    <div className="pe-col-top">
                      {col.length > 0 && <input type="checkbox" className="pe-check" checked={col.every((p) => sel.has(p.id))} onChange={(e) => setMany(col.map((p) => p.id), e.target.checked)} aria-label={`Selecionar todas de ${c.name}`} title="Selecionar todas deste grupo" />}
                      <i className="vd-dot" style={{ background: c.color }} /><b>{c.name}</b><span>{col.length}</span>
                      <div className="pe-col-tools">
                        <button type="button" className="btn small ghost" onClick={() => setDrawer({ persona: null, groupId: c.real ? c.id : null })} title="Adicionar persona" aria-label="Adicionar persona"><IconPlus /></button>
                        {c.real && <button type="button" className="btn small ghost" onClick={() => startRename(c)} title="Renomear grupo" aria-label="Renomear grupo"><IconEdit /></button>}
                        {c.real && <button type="button" className="btn small ghost danger" onClick={() => removeGroup(c.id, c.name)} title="Excluir grupo" aria-label="Excluir grupo"><IconTrash /></button>}
                      </div>
                    </div>
                    {c.description && <small>{c.description}</small>}
                  </header>
                )}
                <div className="pe-col-body">
                  {col.map((p) => (
                    <article key={p.id} className={`pe-card${drag === p.id ? ' dragging' : ''}${sel.has(p.id) ? ' selected' : ''}`} draggable
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; setDrag(p.id); }} onDragEnd={() => { setDrag(null); setOver(null); }}
                      onClick={() => { if (sel.size) toggleSel(p.id); else setDrawer({ persona: p, groupId: p.groupId }); }}>
                      <div className="pe-card-head">
                        <input type="checkbox" className="pe-check" checked={sel.has(p.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggleSel(p.id)} aria-label={`Selecionar ${p.name}`} />
                        <span className="pe-av" style={{ background: colorOf(p.groupId) }}>{initialsOf(p.name)}</span>
                        <div><b>{p.name}</b><small>{[p.data.role, p.data.age].filter(Boolean).join(' · ') || '—'}</small></div>
                        <span className="pe-card-tools">
                          <button type="button" className="btn small ghost" onClick={(e) => { e.stopPropagation(); setDrawer({ persona: p, groupId: p.groupId, refine: true }); }} aria-label="Refinar persona com IA" title="Refinar com IA"><IconSpark /></button>
                          <button type="button" className="btn small ghost" onClick={(e) => { e.stopPropagation(); setDrawer({ persona: p, groupId: p.groupId }); }} aria-label="Editar persona" title="Editar"><IconEdit /></button>
                          <button type="button" className="btn small ghost danger" onClick={(e) => { e.stopPropagation(); remove(p); }} aria-label="Excluir persona" title="Excluir"><IconTrash /></button>
                        </span>
                      </div>
                      {p.tagline && <p>{p.tagline}</p>}
                      {p.data.pains.length > 0 && <ul className="pe-chips">{p.data.pains.slice(0, 2).map((x, i) => <li key={i}>{x}</li>)}</ul>}
                      <div className="pe-move" onClick={(e) => e.stopPropagation()}>
                        <select value={p.groupId ?? NONE} onChange={(e) => move(p.id, e.target.value)} aria-label="Mover para o grupo">
                          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                          <option value={NONE}>Sem grupo</option>
                        </select>
                      </div>
                    </article>
                  ))}
                  {col.length === 0 && <div className="vd-col-empty">Solte uma persona aqui</div>}
                </div>
              </section>
            );
          })}

          <section className="pe-col pe-col-new">
            {adding ? (
              <div className="pe-col-edit">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} autoFocus placeholder="Nome do novo grupo" onKeyDown={(e) => { if (e.key === 'Enter') addGroup(); if (e.key === 'Escape') { setAdding(false); setNewName(''); } }} aria-label="Nome do novo grupo" />
                <div className="row-actions"><button type="button" className="btn small primary" onClick={addGroup}>Criar grupo</button><button type="button" className="btn small" onClick={() => { setAdding(false); setNewName(''); }}>Cancelar</button></div>
              </div>
            ) : (
              <button type="button" className="vd-add" onClick={() => setAdding(true)}><IconPlus /> Novo grupo</button>
            )}
          </section>
        </div>
      )}

      {sel.size > 0 && (
        <div className="pe-bulk" role="toolbar" aria-label="Ações em massa">
          <b>{sel.size} {sel.size === 1 ? 'selecionada' : 'selecionadas'}</b>
          <button type="button" className="btn small ghost" onClick={() => setSel(new Set(people.map((p) => p.id)))} disabled={sel.size === people.length}>Selecionar todas ({people.length})</button>
          <select value="" onChange={(e) => { if (e.target.value) bulkMove(e.target.value); }} aria-label="Mover selecionadas para o grupo">
            <option value="">Mover para o grupo…</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            <option value={NONE}>Sem grupo</option>
          </select>
          <button type="button" className="btn small danger" onClick={bulkRemove}><IconTrash /> Excluir</button>
          <button type="button" className="btn small ghost" onClick={() => setSel(new Set())}>Limpar seleção</button>
        </div>
      )}
      {drawer && <PersonaDrawer key={`${drawer.persona?.id ?? `new-${drawer.groupId}`}${drawer.refine ? '-r' : ''}`} persona={drawer.persona} defaultGroupId={drawer.groupId} groups={groups} startRefine={!!drawer.refine} onClose={() => setDrawer(null)} />}
      {suggest && <SuggestModal initialIcp={icp} existingCount={people.length} groupNames={groups.map((g) => g.name)} hasKey={hasKey} onClose={() => setSuggest(false)} />}
    </div>
  );
}
