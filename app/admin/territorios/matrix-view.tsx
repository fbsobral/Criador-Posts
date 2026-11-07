'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { splitPersonaName } from '@/lib/persona';
import { buildTree, effectivePersonas, type TNode, type TreeItem } from '@/lib/territory';
import { linkPersona } from '@/lib/territory-actions';
import type { PersonaLite } from './mind-map';

const initialsOf = (n: string) => n.replace(/,.*/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

/** Matriz território × persona: onde cada tema já tem ideias para cada persona e onde ainda há lacuna. Clicar numa dupla abre o gerador de ideias para ela. */
export function MatrixView({ personas, nodes, ideaCounts, hasKey, hasAbout }: {
  personas: PersonaLite[]; nodes: TNode[]; /** "territoryId|personaId" → nº de ideias */ ideaCounts: Record<string, number>; hasKey: boolean; hasAbout: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [err, setErr] = useState('');
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [depth, setDepth] = useState<1 | 2>(2);

  const rows = useMemo(() => {
    const out: { node: TNode; d: number }[] = [];
    const walk = (items: TreeItem<TNode>[], d: number) => { for (const it of items) { if (d < depth) { out.push({ node: it.data, d }); walk(it.children, d + 1); } } };
    walk(buildTree(nodes), 0);
    return out;
  }, [nodes, depth]);
  const cell = (id: string, pid: string) => {
    const linked = effectivePersonas(nodes, id).includes(pid);
    return { linked, ideas: ideaCounts[`${id}|${pid}`] ?? 0, own: nodes.find((n) => n.id === id)?.links.some((l) => l.personaId === pid) ?? false };
  };
  const total = rows.length * personas.length;
  const done = rows.reduce((a, r) => a + personas.filter((p) => cell(r.node.id, p.id).ideas > 0).length, 0);
  const shownRows = onlyGaps ? rows.filter((r) => personas.some((p) => !cell(r.node.id, p.id).ideas)) : rows;

  if (!nodes.length) return <div className="empty"><b>Ainda não há territórios</b><p>Crie temas no mapa (de uma persona ou macro) para ver a cobertura por persona.</p></div>;
  if (!personas.length) return <div className="empty"><b>Ainda não há personas</b><p>Crie personas para ligá-las aos territórios.</p></div>;

  return (
    <div className="tr-main">
      <div className="tr-bar">
        <div className="tr-legend muted">
          <span><i className="mx-dot full" /> já tem ideias</span>
          <span><i className="mx-dot half" /> ligada, sem ideias (clique para gerar)</span>
          <span><i className="mx-dot none" /> sem ligação (clique para ligar)</span>
        </div>
        <div className="row-actions">
          <div className="vd-segmented" role="radiogroup" aria-label="Níveis" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <button type="button" role="radio" aria-checked={depth === 1} className={depth === 1 ? 'on' : ''} onClick={() => setDepth(1)}>1º nível</button>
            <button type="button" role="radio" aria-checked={depth === 2} className={depth === 2 ? 'on' : ''} onClick={() => setDepth(2)}>até o 2º</button>
          </div>
          <button type="button" className={`vd-chip${onlyGaps ? ' on' : ''}`} onClick={() => setOnlyGaps((v) => !v)}>Só com lacunas</button>
        </div>
      </div>
      <p className="muted tr-sum">{done} de {total} duplas território × persona já têm ideias de conteúdo.</p>
      {err && <div className="notice err" style={{ margin: '0 0 10px' }}>{err}</div>}
      <div className="tr-matrix card-surface">
        <table>
          <thead>
            <tr><th>Território</th>{personas.map((p) => <th key={p.id} title={p.name}><span className="pe-av sm" style={{ background: p.color ?? '#8A857A' }}>{initialsOf(p.name)}</span><small className="tr-th-name">{splitPersonaName(p.name).first}</small></th>)}</tr>
          </thead>
          <tbody>
            {shownRows.map(({ node: n, d }) => (
              <tr key={n.id} className={d === 0 ? 'top' : ''}>
                <td style={{ paddingLeft: 12 + d * 22 }}>
                  <b>{n.name}</b>{n.personaId === 'publico' && d === 0 && <span className="tr-also inline" title="Tema macro: nasceu sem persona">macro</span>}
                  <Link href={`/admin/territorios?n=${n.id}`} className="vd-link" style={{ marginLeft: 8 }} title="Abrir no mapa">mapa →</Link>
                </td>
                {personas.map((p) => {
                  const c = cell(n.id, p.id);
                  const color = p.color ?? '#8A857A';
                  return (
                    <td key={p.id} className="c">
                      {c.linked ? (
                        <button type="button" className="mx-btn" onClick={() => router.push(`/admin/ideias?t=${n.id}&p=${p.id}`)} title={c.ideas ? `${c.ideas} ${c.ideas === 1 ? 'ideia' : 'ideias'}. Clique para gerar mais.` : 'Sem ideias ainda. Clique para gerar ideias deste tema para esta persona.'}>
                          <span className={`mx-dot ${c.ideas ? 'full' : 'half'}`} style={{ ['--c' as string]: color }}>{c.ideas > 0 ? c.ideas : ''}</span>
                        </button>
                      ) : (
                        <button type="button" className="mx-btn" onClick={() => start(async () => { const r = await linkPersona(n.id, p.id); if (r.error) setErr(r.error); else router.refresh(); })} title={`Ligar ${splitPersonaName(p.name).first} a este tema`}>
                          <span className="mx-dot none">＋</span>
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {shownRows.length === 0 && <tr><td colSpan={personas.length + 1} className="muted" style={{ padding: 16 }}>Nenhuma lacuna nesses níveis. 🎉</td></tr>}
          </tbody>
        </table>
        <p className="muted" style={{ padding: '10px 14px' }}>O número dentro do ponto é a quantidade de ideias de conteúdo já criadas para aquela dupla. Filhos herdam as personas ligadas ao pai.</p>
      </div>
    </div>
  );
}
