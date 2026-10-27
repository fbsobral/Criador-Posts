'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createNode, deleteNode, moveNode, updateNode } from '@/lib/territory-actions';
import { GROUP_COLORS, splitPersonaName } from '@/lib/persona';
import { NODE_H, NODE_W, buildTree, descendantIds, edgePath, layoutTree, pathOf, type TNode } from '@/lib/territory';
import { IconEdit, IconPlus, IconSpark, IconTrash } from '../../icons';
import { usePan } from '../use-pan';
import { TerritoryModal } from './territory-modal';

export type PersonaLite = { id: string; name: string; tagline: string; role: string; /** cor do grupo da persona */ color?: string; group?: string };

const DEPTH_COLORS = ['#F97335', '#1D9BF0', '#8B5CF6', '#1F9D63', '#E5484D', '#F59E0B'];
const initialsOf = (n: string) => n.replace(/,.*/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

/** Mapa mental horizontal dos territórios de UMA persona: criar irmão/filho, arrastar para mudar o pai, recolher e gerar com IA. */
export function MindMap({ persona, color, nodes: n0, hasKey, hasAbout }: { persona: PersonaLite; color: string; nodes: TNode[]; hasKey: boolean; hasAbout: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [nodes, setNodes] = useState(n0);
  useEffect(() => setNodes(n0), [n0]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [ai, setAi] = useState<{ parent: TNode | null } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  usePan(wrapRef);

  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const lay = useMemo(() => layoutTree(tree, collapsed), [tree, collapsed]);
  const sel = nodes.find((x) => x.id === selected) ?? null;
  const kidsCount = (id: string) => descendantIds(nodes, id).size - 1;

  // se o nó selecionado foi apagado/movido para fora, limpa a seleção
  useEffect(() => { if (selected && !nodes.some((x) => x.id === selected)) setSelected(null); }, [nodes, selected]);
  // traz o nó selecionado para a vista
  useEffect(() => {
    if (!selected || !wrapRef.current) return;
    const p = lay.placed.find((x) => x.id === selected); if (!p) return;
    const w = wrapRef.current, x = p.x * zoom, y = p.y * zoom;
    if (x < w.scrollLeft + 20 || x + NODE_W * zoom > w.scrollLeft + w.clientWidth - 20) w.scrollTo({ left: Math.max(0, x - 80), behavior: 'smooth' });
    if (y < w.scrollTop + 20 || y + NODE_H * zoom > w.scrollTop + w.clientHeight - 20) w.scrollTo({ top: Math.max(0, y - w.clientHeight / 2), behavior: 'smooth' });
  }, [selected, lay.placed, zoom]);

  const startEdit = (id: string, name: string) => { setSelected(id); setEditing(id); setDraft(name); };
  const commitEdit = (id: string) => {
    const cur = nodes.find((x) => x.id === id); setEditing(null);
    const name = draft.trim();
    if (!cur || !name || name === cur.name) return;
    setNodes((a) => a.map((x) => (x.id === id ? { ...x, name } : x)));
    start(async () => { const r = await updateNode(id, { name, description: cur.description }); if (r.error) { setErr(r.error); setNodes((a) => a.map((x) => (x.id === id ? cur : x))); } });
  };

  async function add(parentId: string | null, afterId?: string) {
    setErr('');
    const r = await createNode(persona.id, parentId, 'Novo território', afterId);
    if (r.error || !r.node) { setErr(r.error ?? 'Não foi possível criar.'); return; }
    setNodes((a) => [...a.map((x) => (afterId && x.parentId === r.node!.parentId && x.position >= r.node!.position ? { ...x, position: x.position + 1 } : x)), r.node!]);
    if (parentId) setCollapsed((s) => { const n = new Set(s); n.delete(parentId); return n; });
    startEdit(r.node.id, r.node.name);
  }
  const addChild = (id: string) => add(id);
  const addSibling = (n: TNode) => add(n.parentId, n.id);

  const remove = (n: TNode) => {
    const k = kidsCount(n.id);
    if (!confirm(`Excluir “${n.name}”${k ? ` e os ${k} territórios dentro dele` : ''}?`)) return;
    const ids = descendantIds(nodes, n.id); const prev = nodes;
    setNodes((a) => a.filter((x) => !ids.has(x.id))); setSelected(null);
    start(async () => { const r = await deleteNode(n.id); if (r.error) { setErr(r.error); setNodes(prev); } });
  };

  const move = (id: string, parentId: string | null) => {
    const cur = nodes.find((x) => x.id === id); if (!cur || cur.parentId === parentId) return;
    if (parentId && descendantIds(nodes, id).has(parentId)) { setErr('Não dá para mover um território para dentro dele mesmo.'); return; }
    const prev = nodes; setErr('');
    setNodes((a) => a.map((x) => (x.id === id ? { ...x, parentId } : x)));
    if (parentId) setCollapsed((s) => { const n = new Set(s); n.delete(parentId); return n; });
    start(async () => { const r = await moveNode(id, parentId); if (r.error) { setErr(r.error); setNodes(prev); } else router.refresh(); });
  };

  const saveDesc = (n: TNode, description: string) => {
    if (description === n.description) return;
    setNodes((a) => a.map((x) => (x.id === n.id ? { ...x, description } : x)));
    start(async () => { await updateNode(n.id, { name: n.name, description }); });
  };
  const saveName = (n: TNode, name: string) => {
    const v = name.trim(); if (!v || v === n.name) return;
    setNodes((a) => a.map((x) => (x.id === n.id ? { ...x, name: v } : x)));
    start(async () => { await updateNode(n.id, { name: v, description: n.description }); });
  };

  const toggleCollapse = (id: string) => setCollapsed((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const parents = nodes.filter((x) => nodes.some((c) => c.parentId === x.id)).map((x) => x.id);

  const onKey = (e: React.KeyboardEvent) => {
    if (editing || !sel || (e.target as HTMLElement).closest('input, textarea')) return;
    if (e.key === 'Enter') { e.preventDefault(); addSibling(sel); }
    else if (e.key === 'Tab') { e.preventDefault(); addChild(sel.id); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(sel); }
    else if (e.key === 'F2') { e.preventDefault(); startEdit(sel.id, sel.name); }
    else if (e.key === ' ') { e.preventDefault(); toggleCollapse(sel.id); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); if (sel.parentId) setSelected(sel.parentId); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); const k = tree.length ? nodes.filter((x) => x.parentId === sel.id).sort((a, b) => a.position - b.position)[0] : null; if (k) { setCollapsed((s) => { const n = new Set(s); n.delete(sel.id); return n; }); setSelected(k.id); } }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const me = lay.placed.find((p) => p.id === sel.id); if (!me) return;
      const same = lay.placed.filter((p) => p.depth === me.depth && p.id !== me.id && (e.key === 'ArrowUp' ? p.y < me.y : p.y > me.y)).sort((a, b) => Math.abs(a.y - me.y) - Math.abs(b.y - me.y))[0];
      if (same) setSelected(same.id);
    }
  };

  const rootY = lay.rootY;
  const personaColor = color;
  return (
    <div className="tr-layout">
      <div className="tr-main">
        <div className="tr-bar">
          <div className="row-actions">
            <button type="button" className="btn small primary" onClick={() => setAi({ parent: null })}><IconSpark /> Gerar com IA</button>
            <button type="button" className="btn small" onClick={() => add(null)}><IconPlus /> Área de 1º nível</button>
          </div>
          <div className="row-actions">
            <button type="button" className="btn small ghost" onClick={() => setCollapsed(new Set(parents))} disabled={!parents.length}>Recolher tudo</button>
            <button type="button" className="btn small ghost" onClick={() => setCollapsed(new Set())} disabled={!collapsed.size}>Expandir tudo</button>
            <div className="tr-zoom" role="group" aria-label="Zoom">
              <button type="button" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} aria-label="Diminuir">−</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(2)))} aria-label="Aumentar">+</button>
            </div>
          </div>
        </div>
        {err && <div className="notice err" style={{ margin: '0 0 10px' }}>{err}</div>}

        <div className="tr-wrap" ref={wrapRef} tabIndex={0} onKeyDown={onKey} onClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('tr-canvas')) setSelected(null); }}>
          <div className="tr-sizer" style={{ width: (lay.width + 20) * zoom, height: (lay.height + 20) * zoom }}>
            <div className="tr-canvas" style={{ width: lay.width, height: lay.height, transform: `scale(${zoom})` }}>
              <svg className="tr-edges" width={lay.width} height={lay.height} aria-hidden>
                {lay.edges.map((e) => <path key={e.id} d={edgePath(e)} />)}
              </svg>

              <div className={`tr-root${over === 'root' ? ' over' : ''}`} style={{ left: 0, top: rootY, width: NODE_W, height: NODE_H, borderColor: personaColor }}
                onDragOver={(e) => { if (drag) { e.preventDefault(); setOver('root'); } }} onDragLeave={() => setOver(null)}
                onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || drag; setDrag(null); setOver(null); if (id) move(id, null); }}>
                <span className="pe-av" style={{ background: personaColor }}>{initialsOf(persona.name)}</span>
                <div title={`${persona.name} · ${nodes.length} ${nodes.length === 1 ? 'território' : 'territórios'}`}><b>{splitPersonaName(persona.name).first}</b><small>{splitPersonaName(persona.name).label || persona.role || `${nodes.length} territórios`}</small></div>
              </div>

              {lay.placed.map((p) => {
                const n = p.data, c = DEPTH_COLORS[(p.depth - 1) % DEPTH_COLORS.length];
                const isSel = selected === n.id;
                return (
                  <div key={n.id} className={`tr-node${isSel ? ' sel' : ''}${drag === n.id ? ' dragging' : ''}${over === n.id ? ' over' : ''}`}
                    style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H, borderLeftColor: c }}
                    draggable={editing !== n.id}
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', n.id); e.dataTransfer.effectAllowed = 'move'; setDrag(n.id); }}
                    onDragEnd={() => { setDrag(null); setOver(null); }}
                    onDragOver={(e) => { if (drag && drag !== n.id && !descendantIds(nodes, drag).has(n.id)) { e.preventDefault(); setOver(n.id); } }}
                    onDragLeave={() => setOver((o) => (o === n.id ? null : o))}
                    onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || drag; setDrag(null); setOver(null); if (id && id !== n.id) move(id, n.id); }}
                    onClick={(e) => { e.stopPropagation(); setSelected(n.id); wrapRef.current?.focus(); }}
                    onDoubleClick={(e) => { e.stopPropagation(); startEdit(n.id, n.name); }}>
                    {editing === n.id ? (
                      <input className="tr-edit" autoFocus value={draft} maxLength={80} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => commitEdit(n.id)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') commitEdit(n.id); if (e.key === 'Escape') setEditing(null); }} aria-label="Nome do território" />
                    ) : (
                      <span className="tr-name" title={n.description || n.name}>{n.name}</span>
                    )}
                    {p.hasKids && (
                      <button type="button" className="tr-fold" onClick={(e) => { e.stopPropagation(); toggleCollapse(n.id); }} aria-label={p.collapsed ? 'Expandir' : 'Recolher'} title={p.collapsed ? 'Expandir' : 'Recolher'}>
                        {p.collapsed ? kidsCount(n.id) : '‹'}
                      </button>
                    )}
                    {isSel && editing !== n.id && (
                      <div className="tr-tools" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => addChild(n.id)} title="Adicionar filho (Tab)" aria-label="Adicionar filho">↳ filho</button>
                        <button type="button" onClick={() => addSibling(n)} title="Adicionar irmão (Enter)" aria-label="Adicionar irmão">↓ irmão</button>
                        <button type="button" onClick={() => setAi({ parent: n })} title="Gerar filhos com IA" aria-label="Gerar com IA"><IconSpark /></button>
                      </div>
                    )}
                  </div>
                );
              })}
              {nodes.length === 0 && (
                <div className="tr-empty" style={{ left: NODE_W + 72, top: rootY - 10 }}>
                  <b>Mapa vazio</b>
                  <p>Gere com IA ou crie a primeira área de 1º nível.</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="tr-keys">Dica: clique num território e use <kbd>Tab</kbd> para criar um filho, <kbd>Enter</kbd> para um irmão, <kbd>F2</kbd> para renomear, <kbd>Espaço</kbd> para recolher. Arraste um território sobre outro para mudar o pai.</p>
      </div>

      <aside className="tr-panel card-surface">
        {sel ? (
          <>
            <div className="tr-crumb">{pathOf(nodes, sel.id).map((x, i, a) => <span key={i}>{x}{i < a.length - 1 ? ' › ' : ''}</span>)}</div>
            <div className="field"><label htmlFor="tn">Nome</label><input id="tn" key={sel.id + sel.name} defaultValue={sel.name} maxLength={80} onBlur={(e) => saveName(sel, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></div>
            <div className="field"><label htmlFor="td">Descrição</label><textarea id="td" key={sel.id} rows={4} defaultValue={sel.description} maxLength={400} placeholder="O que entra neste território e por que importa para a persona" onBlur={(e) => saveDesc(sel, e.target.value)} /></div>
            <div className="tr-meta">{kidsCount(sel.id)} {kidsCount(sel.id) === 1 ? 'território dentro' : 'territórios dentro'} · {sel.source === 'ai' ? 'criado pela IA' : 'criado à mão'}</div>
            <div className="tr-actions">
              <button type="button" className="btn small" onClick={() => addChild(sel.id)}><IconPlus /> Filho</button>
              <button type="button" className="btn small" onClick={() => addSibling(sel)}><IconPlus /> Irmão</button>
              <button type="button" className="btn small primary" onClick={() => setAi({ parent: sel })}><IconSpark /> Gerar com IA</button>
              <button type="button" className="btn small" onClick={() => startEdit(sel.id, sel.name)}><IconEdit /> Renomear</button>
              <button type="button" className="btn small ghost danger" onClick={() => remove(sel)}><IconTrash /> Excluir</button>
            </div>
          </>
        ) : (
          <>
            <b className="tr-panel-title">{persona.name}</b>
            {persona.role && <div className="tr-meta">{persona.role}</div>}
            <p className="muted">{persona.tagline}</p>
            <div className="tr-meta">{nodes.length} {nodes.length === 1 ? 'território' : 'territórios'} no mapa</div>
            <p className="muted" style={{ marginTop: 10 }}>Selecione um território para editar, criar filhos e irmãos ou gerar mais com IA. A IA sempre considera o que essa persona já tem no mapa.</p>
            <div className="tr-actions">
              <button type="button" className="btn small primary" onClick={() => setAi({ parent: null })}><IconSpark /> Gerar com IA</button>
              <button type="button" className="btn small" onClick={() => add(null)}><IconPlus /> Área de 1º nível</button>
            </div>
          </>
        )}
      </aside>

      {ai && <TerritoryModal persona={persona} parent={ai.parent ? { id: ai.parent.id, name: ai.parent.name } : null} existingCount={nodes.length} hasKey={hasKey} hasAbout={hasAbout} onClose={() => setAi(null)} />}
    </div>
  );
}

export { GROUP_COLORS };
