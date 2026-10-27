'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { GROUP_COLORS } from '@/lib/persona';
import { NODE_H, NODE_W, edgePath, layoutTree, mergeTrees, type Merged, type TNode, type TreeItem } from '@/lib/territory';
import { usePan } from '../use-pan';
import type { PersonaLite } from './mind-map';

const initialsOf = (n: string) => n.replace(/,.*/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
const DEPTH_COLORS = ['#F97335', '#1D9BF0', '#8B5CF6', '#1F9D63', '#E5484D', '#F59E0B'];

const toItem = (m: Merged): TreeItem<Merged> => ({ id: m.key, data: m, children: m.children.map(toItem) });
const count = (m: Merged): number => m.children.reduce((a, c) => a + 1 + count(c), 0);

/** Visão geral (só leitura): junta os mapas de todas as personas. Nomes iguais sob o mesmo pai viram um só, com as personas que o usam. */
export function GeneralView({ personas, nodes }: { personas: PersonaLite[]; nodes: TNode[] }) {
  const [mode, setMode] = useState<'mapa' | 'matriz'>('mapa');
  const [selected, setSelected] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  usePan(wrapRef, mode === 'mapa');

  const colorOf = (id: string) => GROUP_COLORS[Math.max(0, personas.findIndex((p) => p.id === id)) % GROUP_COLORS.length];
  const personaOf = (id: string) => personas.find((p) => p.id === id);
  const merged = useMemo(() => mergeTrees(filter ? nodes.filter((n) => n.personaId === filter) : nodes), [nodes, filter]);
  const tree = useMemo(() => merged.map(toItem), [merged]);
  const lay = useMemo(() => layoutTree(tree, collapsed), [tree, collapsed]);
  const flat = useMemo(() => { const out: Merged[] = []; const walk = (a: Merged[]) => a.forEach((m) => { out.push(m); walk(m.children); }); walk(merged); return out; }, [merged]);
  const sel = flat.find((m) => m.key === selected) ?? null;
  const total = flat.length, shared = flat.filter((m) => m.personaIds.length > 1).length;
  const toggleCollapse = (k: string) => setCollapsed((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  if (!nodes.length) return <div className="empty"><b>Ainda não há territórios</b><p>Crie o mapa de pelo menos uma persona para ver a visão geral.</p></div>;

  const rows = flat.filter((m) => m.key.split('/').length <= 2);
  const depthOfKey = (k: string) => k.split('/').length - 1;
  const personaCount = (m: Merged, pid: string) => { let c = 0; const walk = (x: Merged) => x.children.forEach((k) => { if (k.personaIds.includes(pid)) c++; walk(k); }); walk(m); return c; };

  return (
    <div className="tr-layout">
      <div className="tr-main">
        <div className="tr-bar">
          <div className="vd-segmented tr-mode" role="radiogroup" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <button type="button" role="radio" aria-checked={mode === 'mapa'} className={mode === 'mapa' ? 'on' : ''} onClick={() => setMode('mapa')}>Mapa consolidado</button>
            <button type="button" role="radio" aria-checked={mode === 'matriz'} className={mode === 'matriz' ? 'on' : ''} onClick={() => setMode('matriz')}>Matriz de cobertura</button>
          </div>
          <div className="tr-legend">
            {personas.map((p) => (
              <button key={p.id} type="button" className={`tr-chip${filter === p.id ? ' on' : ''}`} onClick={() => setFilter(filter === p.id ? null : p.id)} title={`${p.name} (clique para filtrar)`}>
                <span className="pe-av sm" style={{ background: colorOf(p.id) }}>{initialsOf(p.name)}</span>{p.name.replace(/,.*/, '')}
              </button>
            ))}
          </div>
        </div>
        <p className="muted tr-sum">{total} territórios únicos · {shared} em comum entre personas{filter ? ` · filtrado por ${personaOf(filter)?.name.replace(/,.*/, '')}` : ''}</p>

        {mode === 'mapa' ? (
          <div className="tr-wrap" ref={wrapRef} onClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('tr-canvas')) setSelected(null); }}>
            <div className="tr-sizer" style={{ width: lay.width + 20, height: lay.height + 20 }}>
              <div className="tr-canvas" style={{ width: lay.width, height: lay.height }}>
                <svg className="tr-edges" width={lay.width} height={lay.height} aria-hidden>{lay.edges.map((e) => <path key={e.id} d={edgePath(e)} />)}</svg>
                <div className="tr-root" style={{ left: 0, top: lay.rootY, width: NODE_W, height: NODE_H, borderColor: '#16140F' }}>
                  <span className="pe-av" style={{ background: '#16140F' }}>M</span><div><b>Marca</b><small>visão geral</small></div>
                </div>
                {lay.placed.map((p) => {
                  const m = p.data, c = DEPTH_COLORS[(p.depth - 1) % DEPTH_COLORS.length];
                  return (
                    <div key={m.key} className={`tr-node tr-gnode${selected === m.key ? ' sel' : ''}`} style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H, borderLeftColor: c }} onClick={(e) => { e.stopPropagation(); setSelected(m.key); }}>
                      <span className="tr-name" title={m.name}>{m.name}</span>
                      <span className="tr-avs">
                        {m.personaIds.slice(0, 4).map((id) => <i key={id} style={{ background: colorOf(id) }} title={personaOf(id)?.name}>{initialsOf(personaOf(id)?.name ?? '?')}</i>)}
                        {m.personaIds.length > 4 && <i className="more">+{m.personaIds.length - 4}</i>}
                      </span>
                      {m.alsoIn.length > 0 && <span className="tr-also" title={`Também aparece em: ${m.alsoIn.join(' | ')}`}>⇄</span>}
                      {p.hasKids && <button type="button" className="tr-fold" onClick={(e) => { e.stopPropagation(); toggleCollapse(m.key); }} aria-label={p.collapsed ? 'Expandir' : 'Recolher'}>{p.collapsed ? count(m) : '‹'}</button>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="tr-matrix card-surface">
            <table>
              <thead>
                <tr><th>Território</th>{personas.map((p) => <th key={p.id} title={p.name}><span className="pe-av sm" style={{ background: colorOf(p.id) }}>{initialsOf(p.name)}</span></th>)}</tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const d = depthOfKey(m.key);
                  return (
                    <tr key={m.key} className={d === 0 ? 'top' : ''} onClick={() => { setSelected(m.key); }}>
                      <td style={{ paddingLeft: 12 + d * 22 }}><b>{m.name}</b>{m.alsoIn.length > 0 && <span className="tr-also inline" title={`Também aparece em: ${m.alsoIn.join(' | ')}`}>⇄</span>}</td>
                      {personas.map((p) => {
                        const has = m.personaIds.includes(p.id), n = d === 0 && has ? personaCount(m, p.id) : 0;
                        return <td key={p.id} className="c">{has ? <span className="dot" style={{ background: colorOf(p.id) }}>{n > 0 ? n : ''}</span> : <span className="gap" />}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="muted" style={{ padding: '10px 14px' }}>Cada ponto é uma persona que tem aquele território; nas linhas de 1º nível, o número mostra quantos territórios ela tem dentro dele. Espaços vazios são lacunas.</p>
          </div>
        )}
      </div>

      <aside className="tr-panel card-surface">
        {sel ? (
          <>
            <div className="tr-crumb">{sel.key.split('/').length > 1 ? 'Dentro de outro território' : 'Território de 1º nível'}</div>
            <b className="tr-panel-title">{sel.name}</b>
            <div className="tr-meta">{sel.personaIds.length} de {personas.length} personas · {count(sel)} {count(sel) === 1 ? 'território' : 'territórios'} dentro</div>
            <div className="tr-who">
              {sel.personaIds.map((id) => {
                const p = personaOf(id); const d = sel.descriptions.find((x) => x.personaId === id);
                return (
                  <div key={id} className="tr-who-row">
                    <span className="pe-av sm" style={{ background: colorOf(id) }}>{initialsOf(p?.name ?? '?')}</span>
                    <div><b>{p?.name.replace(/,.*/, '')}</b>{d && <small>{d.text}</small>}<Link href={`/admin/territorios?p=${id}`} className="vd-link">Abrir no mapa →</Link></div>
                  </div>
                );
              })}
            </div>
            {sel.alsoIn.length > 0 && (
              <div className="notice warn" style={{ marginTop: 12 }}><b>Também aparece em outro lugar</b><ul style={{ margin: '6px 0 0 16px' }}>{sel.alsoIn.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
            )}
          </>
        ) : (
          <>
            <b className="tr-panel-title">Visão geral</b>
            <p className="muted">Aqui os mapas de todas as personas aparecem juntos, só para leitura. Territórios com o mesmo nome sob o mesmo pai viram um só, com as fotos das personas que o usam.</p>
            <p className="muted" style={{ marginTop: 10 }}>O ícone <b>⇄</b> avisa que o mesmo tema aparece em lugares diferentes da hierarquia. Para editar, abra o mapa de uma persona.</p>
          </>
        )}
      </aside>
    </div>
  );
}
