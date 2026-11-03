'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { actionErrorMessage } from '@/lib/action-error';
import { createNode, deleteNode, linkPersona, moveNode, saveTranslations, setScore, unlinkPersona, updateNode } from '@/lib/territory-actions';
import { GROUP_COLORS, splitPersonaName } from '@/lib/persona';
import { NODE_H, NODE_W, PUBLICO_ID, buildTree, descendantIds, edgePath, effectivePersonas, layoutTree, lensNodes, pathOf, translationFor, type TNode } from '@/lib/territory';
import { IconEdit, IconPlus, IconSpark, IconTrash } from '../../icons';
import { usePan } from '../use-pan';
import { levelOf, type PriorityConfig } from '@/lib/priority';
import { Menu } from './menu';
import { ReclassifyButton } from './reclassify-button';
import { TerritoryModal } from './territory-modal';
import { TranslateModal } from './translate-modal';

export type PersonaLite = { id: string; name: string; tagline: string; role: string; /** cor do grupo da persona */ color?: string; group?: string };

const DEPTH_COLORS = ['#F97335', '#1D9BF0', '#8B5CF6', '#1F9D63', '#E5484D', '#F59E0B'];
const initialsOf = (n: string) => n.replace(/,.*/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

/** Mapa mental horizontal dos territórios da MARCA (uma árvore só). Com uma persona na "lente", mostra só o que ela enxerga; sem lente, mostra tudo, com as personas ligadas em cada tema. Criar irmão/filho, arrastar para mudar o pai, recolher, traduzir para as personas e gerar com IA. */
export function MindMap({ lens, personas, brandName, nodes: n0, hasKey, hasAbout, priority, approved = {}, initialSelected = null }: {
  lens: PersonaLite | null; personas: PersonaLite[]; brandName: string; nodes: TNode[]; hasKey: boolean; hasAbout: boolean; priority: PriorityConfig; approved?: Record<string, number>; initialSelected?: string | null;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [nodes, setNodes] = useState(n0);
  useEffect(() => setNodes(n0), [n0]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(initialSelected && n0.some((x) => x.id === initialSelected) ? initialSelected : null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [ai, setAi] = useState<{ parent: TNode | null } | null>(null);
  const [tr, setTr] = useState<{ node: TNode; preselect?: string[] } | null>(null);
  // celular: o painel do território vira uma folha (abre pelo "detalhes" da barra do nó) e o arraste vira "Mover para…"
  const [sheet, setSheet] = useState(false);
  const [ptab, setPtab] = useState<'tema' | 'personas' | 'ideias'>('tema');
  const [fine, setFine] = useState(true);
  useEffect(() => setFine(window.matchMedia('(pointer: fine)').matches), []);
  // celular: abre um pouco afastado e já com os primeiros temas à vista (o cartão da marca fica logo à esquerda)
  useEffect(() => { if (window.matchMedia('(max-width: 900px)').matches) { setZoom(0.85); requestAnimationFrame(() => wrapRef.current?.scrollTo({ left: 150 })); } }, []);
  const wrapRef = useRef<HTMLDivElement>(null);
  usePan(wrapRef);

  // lente: só o que a persona enxerga (ligado a ela ou herdado) + os ancestrais, como contexto esmaecido
  const vis = useMemo(() => (lens ? lensNodes(nodes, lens.id) : { nodes, context: new Set<string>() }), [nodes, lens]);
  const tree = useMemo(() => buildTree(vis.nodes), [vis]);
  const colorOf = (id: string) => personas.find((x) => x.id === id)?.color ?? '#8A857A';
  const personaOf = (id: string) => personas.find((x) => x.id === id);
  const lay = useMemo(() => layoutTree(tree, collapsed), [tree, collapsed]);
  const sel = nodes.find((x) => x.id === selected) ?? null;
  const kidsCount = (id: string) => descendantIds(nodes, id).size - 1;

  // se o nó selecionado foi apagado/movido para fora, limpa a seleção
  useEffect(() => { if (selected && !nodes.some((x) => x.id === selected)) setSelected(null); }, [nodes, selected]);
  useEffect(() => { if (!selected) setSheet(false); }, [selected]);
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
    const r = await createNode(lens?.id ?? null, parentId, 'Novo território', afterId);
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
    start(async () => { try { const r = await deleteNode(n.id); if (r.error) { setErr(r.error); setNodes(prev); } else router.refresh(); } catch (e) { setErr(actionErrorMessage(e)); setNodes(prev); } });
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

  const saveScore = (n: TNode, raw: string) => {
    const v = raw.trim() === '' ? null : Math.min(100, Math.max(1, Math.round(Number(raw)) || 1));
    if (v === (n.score ?? null)) return;
    setNodes((a) => a.map((x) => (x.id === n.id ? { ...x, score: v, scoreReason: v ? 'Definido à mão.' : '' } : x)));
    start(async () => { const r = await setScore(n.id, v); if (r.error) setErr(r.error); });
  };
  const setLinks = (id: string, fn: (l: TNode['links']) => TNode['links']) => setNodes((a) => a.map((x) => (x.id === id ? { ...x, links: fn(x.links) } : x)));
  const link = (n: TNode, pid: string) => {
    if (!pid) return;
    setLinks(n.id, (l) => (l.some((x) => x.personaId === pid) ? l : [...l, { personaId: pid, translation: '' }]));
    start(async () => { const r = await linkPersona(n.id, pid); if (r.error) { setErr(r.error); setLinks(n.id, (l) => l.filter((x) => x.personaId !== pid)); } else router.refresh(); });
  };
  const unlink = (n: TNode, pid: string) => {
    const prev = n.links;
    if (prev.find((x) => x.personaId === pid)?.translation && !confirm('Desligar esta persona também apaga a tradução do tema para ela. Continuar?')) return;
    setLinks(n.id, (l) => l.filter((x) => x.personaId !== pid));
    start(async () => { const r = await unlinkPersona(n.id, pid); if (r.error) { setErr(r.error); setLinks(n.id, () => prev); } else router.refresh(); });
  };
  const saveTr = (n: TNode, pid: string, text: string) => {
    const v = text.trim(); const own = n.links.find((x) => x.personaId === pid);
    if (v === (own?.translation ?? '').trim() || (!own && !v)) return;
    setLinks(n.id, (l) => (l.some((x) => x.personaId === pid) ? l.map((x) => (x.personaId === pid ? { ...x, translation: v } : x)) : [...l, { personaId: pid, translation: v }]));
    start(async () => { const r = await saveTranslations(n.id, [{ personaId: pid, translation: v, source: 'manual' }]); if (r.error) setErr(r.error); else router.refresh(); });
  };
  const toggleCollapse = (id: string) => setCollapsed((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const parents = vis.nodes.filter((x) => vis.nodes.some((c) => c.parentId === x.id)).map((x) => x.id);

  const onKey = (e: React.KeyboardEvent) => {
    if (editing || !sel || (e.target as HTMLElement).closest('input, textarea')) return;
    if (e.key === 'Enter') { e.preventDefault(); addSibling(sel); }
    else if (e.key === 'Tab') { e.preventDefault(); addChild(sel.id); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(sel); }
    else if (e.key === 'F2') { e.preventDefault(); startEdit(sel.id, sel.name); }
    else if (e.key === ' ') { e.preventDefault(); toggleCollapse(sel.id); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); if (sel.parentId) setSelected(sel.parentId); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); const k = tree.length ? vis.nodes.filter((x) => x.parentId === sel.id).sort((a, b) => a.position - b.position)[0] : null; if (k) { setCollapsed((s) => { const n = new Set(s); n.delete(sel.id); return n; }); setSelected(k.id); } }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const me = lay.placed.find((p) => p.id === sel.id); if (!me) return;
      const same = lay.placed.filter((p) => p.depth === me.depth && p.id !== me.id && (e.key === 'ArrowUp' ? p.y < me.y : p.y > me.y)).sort((a, b) => Math.abs(a.y - me.y) - Math.abs(b.y - me.y))[0];
      if (same) setSelected(same.id);
    }
  };

  const rootY = lay.rootY;
  const personaColor = lens ? colorOf(lens.id) : '#16140F';
  return (
    <div className="tr-layout">
      <div className="tr-main">
        <div className="tr-bar">
          <div className="row-actions">
            <button type="button" className="btn small primary" onClick={() => setAi({ parent: null })}><IconSpark /> Gerar territórios</button>
            <button type="button" className="btn small" onClick={() => add(null)}><IconPlus /> Área de 1º nível</button>
          </div>
          <div className="row-actions">
            <Menu label="Mais" align="right">
              <ReclassifyButton className="tr-menu-item" target={lens ? { scope: 'persona', personaId: lens.id } : { scope: 'all' }} count={vis.nodes.length - vis.context.size} label={lens ? 'Reclassificar o que esta persona enxerga' : 'Reclassificar o mapa todo'} disabled={!hasKey || !priority.criteria.length} onError={setErr} />
              <button type="button" className="tr-menu-item" data-close onClick={() => setCollapsed(new Set(parents))} disabled={!parents.length}>Recolher tudo</button>
              <button type="button" className="tr-menu-item" data-close onClick={() => setCollapsed(new Set())} disabled={!collapsed.size}>Expandir tudo</button>
              <p className="tr-menu-note"><kbd>Tab</kbd> filho · <kbd>Enter</kbd> irmão · <kbd>F2</kbd> renomear · <kbd>Espaço</kbd> recolher. Arraste um território sobre outro para mudar o pai.</p>
            </Menu>
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
                {lens ? (
                  <><span className="pe-av" style={{ background: personaColor }}>{initialsOf(lens.name)}</span>
                  <div title={`${lens.name} · ${vis.nodes.length - vis.context.size} ${vis.nodes.length - vis.context.size === 1 ? 'território' : 'territórios'}`}><b>{splitPersonaName(lens.name).first}</b><small>{splitPersonaName(lens.name).label || lens.role || 'visão desta persona'}</small></div></>
                ) : (
                  <><span className="pe-av" style={{ background: personaColor }}>{initialsOf(brandName) || 'M'}</span>
                  <div title={brandName}><b>{brandName}</b><small>{nodes.length} {nodes.length === 1 ? 'território' : 'territórios'} no mapa</small></div></>
                )}
              </div>

              {lay.placed.map((p) => {
                const n = p.data, c = DEPTH_COLORS[(p.depth - 1) % DEPTH_COLORS.length];
                const isSel = selected === n.id;
                return (
                  <div key={n.id} className={`tr-node tr-gnode${vis.context.has(n.id) ? ' ctx' : ''}${isSel ? ' sel' : ''}${drag === n.id ? ' dragging' : ''}${over === n.id ? ' over' : ''}`}
                    style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H, borderLeftColor: c }}
                    draggable={fine && editing !== n.id}
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
                    {n.links.length > 0 && (
                      <span className="tr-avs">
                        {n.links.slice(0, 3).map((l) => <i key={l.personaId} style={{ background: colorOf(l.personaId), opacity: l.translation ? 1 : .55 }} title={`${personaOf(l.personaId)?.name ?? ''}${l.translation ? ' · traduzido' : ' · ligada, sem tradução'}`}>{initialsOf(personaOf(l.personaId)?.name ?? '?')}</i>)}
                        {n.links.length > 3 && <i className="more">+{n.links.length - 3}</i>}
                      </span>
                    )}
                    {approved[n.id] ? <span className="tr-check" title={`${approved[n.id]} ${approved[n.id] === 1 ? 'ideia aprovada' : 'ideias aprovadas'} neste tema`}>✓</span> : null}
                    {n.score ? <span className="tr-score" style={{ ['--c' as string]: levelOf(n.score, priority.levels)?.color }} title={`${levelOf(n.score, priority.levels)?.name ?? ''} · ${n.scoreReason || 'score'}`}>{n.score}</span> : null}
                    {p.hasKids && (
                      <button type="button" className="tr-fold" onClick={(e) => { e.stopPropagation(); toggleCollapse(n.id); }} aria-label={p.collapsed ? 'Expandir' : 'Recolher'} title={p.collapsed ? 'Expandir' : 'Recolher'}>
                        {p.collapsed ? kidsCount(n.id) : '‹'}
                      </button>
                    )}
                    {isSel && editing !== n.id && (
                      <div className="tr-tools" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => addChild(n.id)} title="Adicionar subtema (Tab)" aria-label="Adicionar subtema">↳ subtema</button>
                        <button type="button" onClick={() => addSibling(n)} title="Adicionar irmão (Enter)" aria-label="Adicionar irmão">↓ irmão</button>
                        <button type="button" onClick={() => setAi({ parent: n })} title="Gerar subtemas com IA" aria-label="Gerar subtemas com IA"><IconSpark /> subtemas</button>
                        <button type="button" onClick={() => setTr({ node: n })} title="Traduzir este tema para as personas" aria-label="Traduzir para as personas">🔁 traduzir</button>
                        <Link href={`/admin/ideias?t=${n.id}${lens ? `&p=${lens.id}` : ''}`} title="Gerar ideias de conteúdo para este tema" aria-label="Gerar ideias de conteúdo">💡 ideias</Link>
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
      </div>

      {sel && editing !== sel.id && !sheet && (
        <div className="tr-mbar" role="toolbar" aria-label={`Ações em “${sel.name}”`}>
          <button type="button" onClick={() => setSheet(true)}><IconEdit /><span>Detalhes</span></button>
          <button type="button" onClick={() => addChild(sel.id)}><IconPlus /><span>Subtema</span></button>
          <button type="button" onClick={() => addSibling(sel)}><IconPlus /><span>Irmão</span></button>
          <button type="button" onClick={() => setAi({ parent: sel })}><IconSpark /><span>Subtemas</span></button>
          <button type="button" onClick={() => setTr({ node: sel })}><span aria-hidden>🔁</span><span>Traduzir</span></button>
          <Link href={`/admin/ideias?t=${sel.id}${lens ? `&p=${lens.id}` : ''}`}><span aria-hidden>💡</span><span>Ideias</span></Link>
        </div>
      )}
      {sheet && sel && <div className="tr-sheet-back" onMouseDown={() => setSheet(false)} />}
      <aside className={`tr-panel card-surface${sheet && sel ? ' m-open' : ''}`}>
        {sel ? (
          <>
            <button type="button" className="btn small ghost tr-sheet-close" onClick={() => setSheet(false)} aria-label="Fechar detalhes">✕ Fechar</button>
            <div className="tr-crumb">{pathOf(nodes, sel.id).map((x, i, a) => <span key={i}>{x}{i < a.length - 1 ? ' › ' : ''}</span>)}</div>
            <div className="field"><label htmlFor="tn">Nome</label><input id="tn" key={sel.id + sel.name} defaultValue={sel.name} maxLength={80} onBlur={(e) => saveName(sel, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></div>
            <div className="tr-ptabs" role="tablist" aria-label="Seções do território">
              {([['tema', 'Tema', ''], ['personas', 'Personas', effectivePersonas(nodes, sel.id).length ? String(effectivePersonas(nodes, sel.id).length) : ''], ['ideias', 'Ideias', approved[sel.id] ? `✓${approved[sel.id]}` : '']] as const).map(([k, label, badge]) => (
                <button key={k} type="button" role="tab" aria-selected={ptab === k} className={ptab === k ? 'on' : ''} onClick={() => setPtab(k)}>{label}{badge && <i>{badge}</i>}</button>
              ))}
            </div>
            {ptab === 'tema' && (<>
            <div className="field"><label htmlFor="td">Descrição</label><textarea id="td" key={sel.id} rows={4} defaultValue={sel.description} maxLength={400} placeholder="O que entra neste território e por que importa" onBlur={(e) => saveDesc(sel, e.target.value)} /></div>
            <div className="field">
              <label htmlFor="ts">Prioridade (score 1 a 100)</label>
              <div className="tr-score-box" style={{ ['--c' as string]: levelOf(sel.score, priority.levels)?.color }}>
                <input id="ts" type="number" min={1} max={100} key={sel.id + String(sel.score)} defaultValue={sel.score ?? ''} placeholder="—" onBlur={(e) => saveScore(sel, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                {levelOf(sel.score, priority.levels) && <span className="tr-score-lvl">{levelOf(sel.score, priority.levels)!.name}</span>}
              </div>
              {sel.scoreReason && <p className="tr-score-why">{sel.scoreReason}</p>}
            </div>
            <div className="field">
              <label htmlFor="tmv">Mover para</label>
              <select id="tmv" value={sel.parentId ?? ''} onChange={(e) => move(sel.id, e.target.value || null)}>
                <option value="">Raiz do mapa (1º nível)</option>
                {moveTargets(nodes, sel.id).map((o) => <option key={o.id} value={o.id}>{'\u00A0\u00A0'.repeat(o.depth)}{o.name}</option>)}
              </select>
            </div>
            {sheet && err && <div className="notice err">{err}</div>}
            </>)}
            {ptab === 'personas' && (<>
            {(() => {
              const eff = effectivePersonas(nodes, sel.id);
              const free = personas.filter((x) => !eff.includes(x.id));
              return (
                <div className="tr-bridge">
                  <div className="tr-bridge-head"><b>Personas deste tema</b><small>{eff.length ? `${eff.length} de ${personas.length} · cada uma com a tradução do tema para o dia a dia dela` : 'Nenhuma persona ligada ainda'}</small></div>
                  {eff.map((pid) => {
                    const p = personaOf(pid); const own = sel.links.find((x) => x.personaId === pid); const inh = translationFor(nodes, sel.id, pid);
                    return (
                      <div key={pid} className="tr-bridge-row">
                        <div className="tr-bridge-who">
                          <span className="pe-av sm" style={{ background: colorOf(pid) }}>{initialsOf(p?.name ?? '?')}</span>
                          <b title={p?.name}>{p ? splitPersonaName(p.name).first : 'Persona'}</b>
                          {!own && <em title="Herdada de um território acima">herdada</em>}
                          <span className="grow" />
                          <Link href={`/admin/ideias?t=${sel.id}&p=${pid}`} className="tr-mini" title="Gerar ideias para esta persona neste tema">💡</Link>
                          {own && <button type="button" className="tr-mini" onClick={() => unlink(sel, pid)} title="Desligar esta persona deste tema" aria-label="Desligar persona">×</button>}
                        </div>
                        <textarea key={sel.id + pid + (own?.translation ?? '')} rows={3} defaultValue={own?.translation ?? ''} maxLength={1200}
                          placeholder={inh.text ? `Herdada${inh.from ? ` de “${inh.from}”` : ''}: ${inh.text}` : 'Como este tema aparece no dia a dia dela (cena, linguagem, o que ela já sente)…'}
                          onBlur={(e) => saveTr(sel, pid, e.target.value)} />
                      </div>
                    );
                  })}
                  <div className="row-actions">
                    {free.length > 0 && (
                      <select className="tr-bridge-add" value="" onChange={(e) => link(sel, e.target.value)} aria-label="Ligar persona a este tema">
                        <option value="">＋ Ligar persona…</option>
                        {free.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    )}
                    <button type="button" className="btn small" onClick={() => setTr({ node: sel })} disabled={!personas.length}>🔁 Traduzir com IA</button>
                  </div>
                </div>
              );
            })()}
            </>)}
            {ptab === 'ideias' && (<>
            <div className="tr-ideas-box">
              <div><b>Ideias de conteúdo</b><small>{approved[sel.id] ? `✓ ${approved[sel.id]} ${approved[sel.id] === 1 ? 'aprovada' : 'aprovadas'} neste tema` : 'Nenhuma aprovada neste tema ainda'}</small></div>
              <div className="row-actions">
                <Link href={`/admin/ideias?t=${sel.id}${lens ? `&p=${lens.id}` : ''}`} className="btn small primary">💡 Gerar ideias</Link>
                <Link href={`/admin/ideias?t=${sel.id}&ver=1`} className="btn small">Ver</Link>
              </div>
            </div>
              <p className="muted tr-hint">Cada ideia combina este tema com uma persona. Para escolher a persona, use o 💡 ao lado dela na aba Personas, ou abra o gerador e escolha lá.</p>
            </>)}
            <div className="tr-meta">{kidsCount(sel.id)} {kidsCount(sel.id) === 1 ? 'território dentro' : 'territórios dentro'} · {sel.source === 'ai' ? 'criado pela IA' : 'criado à mão'}</div>
            <div className="tr-actions">
              <button type="button" className="btn small" onClick={() => setAi({ parent: sel })}><IconSpark /> Subtemas com IA</button>
              <button type="button" className="btn small" onClick={() => addChild(sel.id)}><IconPlus /> Subtema</button>
              <button type="button" className="btn small" onClick={() => addSibling(sel)}><IconPlus /> Irmão</button>
              <Menu label="Mais" align="right">
                <ReclassifyButton className="tr-menu-item" target={{ scope: 'node', nodeId: sel.id }} count={kidsCount(sel.id) + 1} label={kidsCount(sel.id) ? 'Reclassificar este e filhos' : 'Reclassificar'} disabled={!hasKey || !priority.criteria.length} onError={setErr} />
                <button type="button" className="tr-menu-item" data-close onClick={() => startEdit(sel.id, sel.name)}><IconEdit /> Renomear</button>
                <button type="button" className="tr-menu-item danger" data-close onClick={() => remove(sel)}><IconTrash /> Excluir</button>
              </Menu>
            </div>
          </>
        ) : (
          <>
            <b className="tr-panel-title">{lens ? lens.name : brandName}</b>
            {lens?.role && <div className="tr-meta">{lens.role}</div>}
            <p className="muted tr-tagline">{lens ? lens.tagline : 'O mapa de temas da marca. Cada tema pode nascer das dores de uma persona ou de um debate macro; depois, ligue as personas e traduza o tema para o dia a dia de cada uma.'}</p>
            <div className="tr-meta">{lens ? <>{vis.nodes.length - vis.context.size} {vis.nodes.length - vis.context.size === 1 ? 'território' : 'territórios'} que esta persona enxerga, de {nodes.length} no mapa</> : <>{nodes.length} {nodes.length === 1 ? 'território' : 'territórios'} no mapa</>}</div>
            <p className="muted">Selecione um território para editar, ligar personas, traduzir o tema e gerar ideias.</p>
            <div className="tr-actions">
              <button type="button" className="btn small primary" onClick={() => setAi({ parent: null })}><IconSpark /> Gerar territórios</button>
              <button type="button" className="btn small" onClick={() => add(null)}><IconPlus /> Área de 1º nível</button>
            </div>
          </>
        )}
      </aside>

      {ai && <TerritoryModal personas={personas} initialPersona={lens?.id ?? PUBLICO_ID} parent={ai.parent ? { id: ai.parent.id, name: ai.parent.name } : null} existingCount={nodes.length} hasKey={hasKey} hasAbout={hasAbout} onClose={() => setAi(null)} />}
      {tr && <TranslateModal node={{ id: tr.node.id, name: tr.node.name, path: pathOf(nodes, tr.node.id).join(' › ') }} personas={personas} linked={effectivePersonas(nodes, tr.node.id)} translated={effectivePersonas(nodes, tr.node.id).filter((pid) => translationFor(nodes, tr.node.id, pid).text)} preselect={tr.preselect} hasKey={hasKey} hasAbout={hasAbout} onClose={() => setTr(null)} />}
    </div>
  );
}

/** Destinos possíveis para mover um território (qualquer outro, menos ele mesmo e o que está dentro dele), em ordem de árvore. */
function moveTargets(nodes: TNode[], id: string) {
  const bad = descendantIds(nodes, id);
  const out: { id: string; name: string; depth: number }[] = [];
  const walk = (items: ReturnType<typeof buildTree>, depth: number) => { for (const it of items) { if (bad.has(it.id)) continue; out.push({ id: it.id, name: it.data.name, depth }); walk(it.children, depth + 1); } };
  walk(buildTree(nodes), 0);
  return out;
}

export { GROUP_COLORS };
